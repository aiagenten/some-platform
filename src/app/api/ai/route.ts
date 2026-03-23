// ── POST /api/ai — Streaming AI Chat Endpoint ─────────────────────────────────
// Powers the Video Studio agent tabs: Director, Scripter, Editor
// Returns a streaming SSE response (text/event-stream)

import { NextRequest } from 'next/server'
import {
  SYSTEM_PROMPTS,
  buildContextBlock,
  type AiChatRequest,
  type AgentId,
} from '@/lib/ai-agents'

export const runtime = 'edge'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const VALID_AGENTS: AgentId[] = ['director', 'scripter', 'editor']

// ── Helper: build SSE data line ───────────────────────────────────────────────
function sseData(data: string): string {
  return `data: ${data}\n\n`
}

function sseError(message: string): string {
  return sseData(JSON.stringify({ error: message }))
}

function sseDone(): string {
  return sseData('[DONE]')
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // ── Parse & validate request ──────────────────────────────────────────────
  let body: AiChatRequest
  try {
    body = await request.json()
  } catch {
    return new Response(sseError('Invalid JSON body'), {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const { agent, messages, context } = body

  if (!agent || !VALID_AGENTS.includes(agent)) {
    return new Response(
      JSON.stringify({ error: `Invalid agent. Must be one of: ${VALID_AGENTS.join(', ')}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!messages?.length) {
    return new Response(
      JSON.stringify({ error: 'messages array is required and cannot be empty' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const apiKey = OPENROUTER_API_KEY || OPENAI_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'No AI API key configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // ── Build messages for the LLM ────────────────────────────────────────────
  const systemPrompt = SYSTEM_PROMPTS[agent]

  // Inject context into the last user message if context is provided
  const contextBlock = buildContextBlock(context)
  const enrichedMessages = messages.map((msg, idx) => {
    // Prepend context to the first user message if available
    if (idx === 0 && msg.role === 'user' && contextBlock) {
      return { ...msg, content: contextBlock + msg.content }
    }
    return msg
  })

  // ── Call AI API with streaming ────────────────────────────────────────────
  let upstreamResponse: Response

  if (OPENROUTER_API_KEY) {
    // OpenRouter (project's primary AI provider)
    upstreamResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://some.aiagenten.no',
        'X-Title': 'SoMe Video Studio',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-5',
        messages: [
          { role: 'system', content: systemPrompt },
          ...enrichedMessages,
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    })
  } else {
    // OpenAI direct fallback
    upstreamResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...enrichedMessages,
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    })
  }

  if (!upstreamResponse.ok) {
    const errText = await upstreamResponse.text()
    console.error('[/api/ai] upstream error:', upstreamResponse.status, errText)
    return new Response(
      JSON.stringify({ error: `AI API error ${upstreamResponse.status}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // ── Pipe the SSE stream through to the client ─────────────────────────────
  // We transform the upstream SSE stream, extracting text deltas and
  // forwarding them in a clean format for the frontend to consume.
  const reader = upstreamResponse.body?.getReader()
  if (!reader) {
    return new Response(
      JSON.stringify({ error: 'No response body from AI API' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          // Keep the last (potentially incomplete) line in buffer
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed === ':') continue // heartbeat / empty

            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6)

              if (data === '[DONE]') {
                controller.enqueue(encoder.encode(sseDone()))
                continue
              }

              try {
                const parsed = JSON.parse(data)
                const delta = parsed.choices?.[0]?.delta?.content
                if (delta) {
                  // Forward the text chunk
                  controller.enqueue(
                    encoder.encode(sseData(JSON.stringify({ content: delta, agent }))),
                  )
                }
              } catch {
                // Not valid JSON — skip (can be ping/keep-alive lines)
              }
            }
          }
        }

        // Flush any remaining buffer
        if (buffer.trim().startsWith('data: ')) {
          const data = buffer.trim().slice(6)
          if (data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                controller.enqueue(
                  encoder.encode(sseData(JSON.stringify({ content: delta, agent }))),
                )
              }
            } catch { /* ignore */ }
          }
        }

        controller.enqueue(encoder.encode(sseDone()))
      } catch (err) {
        console.error('[/api/ai] stream error:', err)
        controller.enqueue(encoder.encode(sseError(`Stream error: ${String(err)}`)))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
      'Connection': 'keep-alive',
    },
  })
}
