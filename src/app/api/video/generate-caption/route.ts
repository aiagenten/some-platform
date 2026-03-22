import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

export async function POST(request: NextRequest) {
  try {
    const { platform, motion_prompt, music_mood, video_id, org_id } = await request.json()

    if (!org_id) {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch brand profile
    const { data: brandProfile } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('org_id', org_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const { data: orgData } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', org_id)
      .single()

    const brandName = orgData?.name || 'din bedrift'
    const tone = brandProfile?.tone || 'Profesjonell og vennlig'
    const targetAudience = brandProfile?.target_audience || 'Norske bedriftseiere'

    const platformRules: Record<string, string> = {
      instagram: 'Instagram Reels: kort, engasjerende, med hook i første linje. 100-200 ord. Emojier sparsomt.',
      linkedin: 'LinkedIn video: profesjonell, innsiktsfull. 100-200 ord. Ingen emojier i starten av linjer.',
      facebook: 'Facebook video: konversasjonelt, engasjerende. 80-150 ord.',
      tiktok: 'TikTok: uformell, trendy, kort. 50-100 ord. Emojier tillatt.',
    }

    const systemPrompt = `Du er en ekspert SoMe-strateg for ${brandName}. Skriv en kort posttekst for en video.

${platformRules[platform || 'instagram'] || platformRules.instagram}

Tone: ${tone}
Målgruppe: ${targetAudience}
Videoinnhold: ${motion_prompt || 'Profesjonell video'}
Stemning: ${music_mood || 'Profesjonell'}

REGLER:
- Skriv ALLTID på norsk (bokmål)
- Returner KUN gyldig JSON
- Teksten skal være klar til å poste

Returner: { "caption": "teksten her", "hashtags": ["#tag1", "#tag2"] }`

    const textResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://some.aiagenten.no',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Skriv en engasjerende posttekst for denne videoen. Plattform: ${platform || 'instagram'}.` },
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    })

    if (!textResponse.ok) {
      console.error('Caption generation error:', await textResponse.text())
      return NextResponse.json({ error: 'Caption generation failed' }, { status: 500 })
    }

    const textData = await textResponse.json()
    const fullText = textData.choices?.[0]?.message?.content || ''

    let caption = ''
    let hashtags: string[] = []

    try {
      const jsonMatch = fullText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        caption = parsed.caption || ''
        hashtags = parsed.hashtags || []
      }
    } catch {
      caption = fullText.replace(/```json?\n?|\n?```/g, '').trim()
    }

    if (video_id) {
      await supabase.from('videos').update({ caption }).eq('id', video_id)
    }

    return NextResponse.json({ success: true, caption, hashtags })
  } catch (err) {
    console.error('Generate caption error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
