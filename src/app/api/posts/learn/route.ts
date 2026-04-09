import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

// POST: Analyze feedback and generate learnings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, post_id, org_id, comment, original_text, edited_text } = body

    if (!org_id) {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    switch (action) {
      case 'rejection': {
        // When post is rejected with a comment → analyze and create learning
        if (!post_id || !comment) {
          return NextResponse.json({ error: 'post_id and comment are required for rejection' }, { status: 400 })
        }

        const learning = await analyzeRejection(comment)

        // Save feedback
        await supabase.from('content_feedback').insert({
          post_id,
          org_id,
          action: 'rejected',
          rejection_reason: comment,
          comment,
        })

        // Save learning
        const { data: learningData, error: learningError } = await supabase
          .from('brand_learnings')
          .insert({
            org_id,
            learning_type: learning.type,
            rule: learning.rule,
            source: 'rejection',
            source_post_id: post_id,
            confidence: 0.6,
            active: true,
          })
          .select()
          .single()

        if (learningError) {
          console.error('Learning insert error:', learningError)
          return NextResponse.json({ error: 'Failed to save learning' }, { status: 500 })
        }

        return NextResponse.json({ success: true, learning: learningData })
      }

      case 'edit': {
        // When post is edited → analyze diff and extract pattern
        if (!post_id || !original_text || !edited_text) {
          return NextResponse.json(
            { error: 'post_id, original_text, and edited_text are required for edit' },
            { status: 400 }
          )
        }

        const diff = generateSimpleDiff(original_text, edited_text)
        const learning = await analyzeEdit(original_text, edited_text, diff)

        // Save feedback with diff
        await supabase.from('content_feedback').insert({
          post_id,
          org_id,
          action: 'edited',
          edit_diff: { original: original_text, edited: edited_text, diff },
        })

        // Save learning if meaningful
        if (learning.rule) {
          const { data: learningData } = await supabase
            .from('brand_learnings')
            .insert({
              org_id,
              learning_type: learning.type,
              rule: learning.rule,
              source: 'edit',
              source_post_id: post_id,
              confidence: 0.5,
              active: true,
            })
            .select()
            .single()

          return NextResponse.json({ success: true, learning: learningData, diff })
        }

        return NextResponse.json({ success: true, diff, learning: null })
      }

      case 'high_engagement': {
        // When post has high engagement → save as positive learning
        if (!post_id) {
          return NextResponse.json({ error: 'post_id is required' }, { status: 400 })
        }

        // Fetch the post
        const { data: post } = await supabase
          .from('social_posts')
          .select('caption, platform, format, content_text, hashtags')
          .eq('id', post_id)
          .single()

        if (!post) {
          return NextResponse.json({ error: 'Post not found' }, { status: 404 })
        }

        const learning = await analyzeHighEngagement(post)

        const { data: learningData } = await supabase
          .from('brand_learnings')
          .insert({
            org_id,
            learning_type: learning.type,
            rule: learning.rule,
            source: 'analytics',
            source_post_id: post_id,
            confidence: 0.8,
            active: true,
          })
          .select()
          .single()

        return NextResponse.json({ success: true, learning: learningData })
      }

      case 'manual': {
        // When user manually adds a learning
        const { rule, learning_type } = body
        if (!rule || !learning_type) {
          return NextResponse.json({ error: 'rule and learning_type are required for manual' }, { status: 400 })
        }

        const { data: learningData, error: learningError } = await supabase
          .from('brand_learnings')
          .insert({
            org_id,
            learning_type,
            rule,
            source: 'manual',
            confidence: 1.0,
            active: true,
          })
          .select()
          .single()

        if (learningError) {
          console.error('Manual learning insert error:', learningError)
          return NextResponse.json({ error: 'Failed to save learning' }, { status: 500 })
        }

        return NextResponse.json({ success: true, learning: learningData })
      }

      default:
        return NextResponse.json({ error: 'Invalid action. Use: rejection, edit, high_engagement, manual' }, { status: 400 })
    }
  } catch (err) {
    console.error('Learn error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: Fetch all active learnings for an org
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    if (!orgId) {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: learnings, error } = await supabase
      .from('brand_learnings')
      .select('*')
      .eq('org_id', orgId)
      .order('confidence', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fetch learnings error:', error)
      return NextResponse.json({ error: 'Failed to fetch learnings' }, { status: 500 })
    }

    return NextResponse.json({ learnings: learnings || [] })
  } catch (err) {
    console.error('Get learnings error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Toggle active status of a learning
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { learning_id, active } = body

    if (!learning_id || active === undefined) {
      return NextResponse.json({ error: 'learning_id and active are required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('brand_learnings')
      .update({ active })
      .eq('id', learning_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update learning' }, { status: 500 })
    }

    return NextResponse.json({ success: true, learning: data })
  } catch (err) {
    console.error('Patch learning error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Remove a learning by id
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { learning_id } = body

    if (!learning_id) {
      return NextResponse.json({ error: 'learning_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('brand_learnings')
      .delete()
      .eq('id', learning_id)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete learning' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete learning error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// AI Analysis helpers
// ============================================================

async function analyzeRejection(comment: string) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'system',
            content: `Du er en ekspert på merkevarebygging. Analyser avvisningskommentaren og lag én kort, handlingsbar regel.
Svar i JSON: { "type": "style"|"tone"|"topic"|"format"|"timing", "rule": "kort regel på norsk" }
Bare JSON, ingen annen tekst.`
          },
          {
            role: 'user',
            content: `Avvisningskommentar: "${comment}"\n\nLag en læringsregel basert på dette.`
          }
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const text = data.choices?.[0]?.message?.content || ''
      const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
      return {
        type: parsed.type || 'style',
        rule: parsed.rule || comment,
      }
    }
  } catch (e) {
    console.error('AI analysis failed, using fallback:', e)
  }

  return { type: 'style' as const, rule: `Unngå: ${comment.substring(0, 100)}` }
}

async function analyzeEdit(original: string, edited: string, diff: string) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'system',
            content: `Analyser redigeringen og identifiser mønsteret. Hva ble konsekvent endret?
Svar i JSON: { "type": "style"|"tone"|"topic"|"format"|"timing", "rule": "kort regel på norsk" }
Bare JSON, ingen annen tekst. Hvis endringen er ubetydelig, returner { "type": "style", "rule": "" }`
          },
          {
            role: 'user',
            content: `Original:\n${original.substring(0, 500)}\n\nRedigert:\n${edited.substring(0, 500)}\n\nEndringer:\n${diff}`
          }
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const text = data.choices?.[0]?.message?.content || ''
      const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
      return {
        type: parsed.type || 'style',
        rule: parsed.rule || '',
      }
    }
  } catch (e) {
    console.error('AI edit analysis failed:', e)
  }

  return { type: 'style' as const, rule: '' }
}

async function analyzeHighEngagement(post: {
  caption: string | null
  platform: string
  format: string
  content_text: string | null
  hashtags: string[] | null
}) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'system',
            content: `Analyser denne høyt-engasjerende posten og identifiser hva som fungerte bra.
Svar i JSON: { "type": "style"|"tone"|"topic"|"format"|"timing", "rule": "positiv regel på norsk, f.eks. 'Bruk spørsmål i caption'" }
Bare JSON, ingen annen tekst.`
          },
          {
            role: 'user',
            content: `Plattform: ${post.platform}\nFormat: ${post.format}\nCaption: ${post.caption || 'Ingen'}\nHashtags: ${(post.hashtags || []).join(' ')}\nInnhold: ${(post.content_text || '').substring(0, 500)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const text = data.choices?.[0]?.message?.content || ''
      const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
      return {
        type: parsed.type || 'style',
        rule: parsed.rule || 'Høyt engasjement registrert',
      }
    }
  } catch (e) {
    console.error('AI engagement analysis failed:', e)
  }

  return { type: 'style' as const, rule: 'Denne innholdstypen genererer høyt engasjement' }
}

function generateSimpleDiff(original: string, edited: string): string {
  const origLines = original.split('\n')
  const editLines = edited.split('\n')
  const diffs: string[] = []

  const maxLen = Math.max(origLines.length, editLines.length)
  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i] || ''
    const e = editLines[i] || ''
    if (o !== e) {
      if (o) diffs.push(`- ${o}`)
      if (e) diffs.push(`+ ${e}`)
    }
  }

  // Detect common patterns
  // eslint-disable-next-line no-misleading-character-class
  const emojiRegex = /[\uD83C-\uDBFF\uDC00-\uDFFF]+/g
  const emojiRemoved = (original.match(emojiRegex) || []).length >
    (edited.match(emojiRegex) || []).length
  const shorterText = edited.length < original.length * 0.8
  const hashtagsRemoved = (original.match(/#/g) || []).length > (edited.match(/#/g) || []).length

  const patterns: string[] = []
  if (emojiRemoved) patterns.push('Emoji fjernet')
  if (shorterText) patterns.push('Tekst kortet ned')
  if (hashtagsRemoved) patterns.push('Hashtags redusert')

  return diffs.slice(0, 20).join('\n') + (patterns.length ? `\n\nMønstre: ${patterns.join(', ')}` : '')
}
