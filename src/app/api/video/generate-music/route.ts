import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'
import { createAdminClient } from '@/lib/supabase/admin'

fal.config({ credentials: process.env.FAL_KEY })

export async function POST(request: NextRequest) {
  try {
    const { music_prompt, duration, video_id, org_id } = await request.json()

    if (!music_prompt || !org_id) {
      return NextResponse.json({ error: 'music_prompt and org_id are required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    if (video_id) {
      await supabase.from('videos').update({ status: 'generating_music' }).eq('id', video_id)
    }

    const falInput = { prompt: music_prompt, duration_seconds: duration || 5 }
    const result = await fal.subscribe('fal-ai/minimax-music/v2', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: falInput as any,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const musicUrl = (result as any)?.data?.audio?.url || (result as any)?.audio?.url || null

    if (!musicUrl) {
      console.error('No music URL in result:', JSON.stringify(result).substring(0, 500))
      if (video_id) {
        await supabase.from('videos').update({ status: 'failed', metadata: { error: 'No music URL returned' } }).eq('id', video_id)
      }
      return NextResponse.json({ error: 'Music generation failed' }, { status: 500 })
    }

    // Download and upload to Supabase Storage
    let storedMusicUrl = musicUrl
    try {
      const musicResponse = await fetch(musicUrl)
      if (musicResponse.ok) {
        const musicBuffer = Buffer.from(await musicResponse.arrayBuffer())
        const fileName = `${org_id}/music/${Date.now()}.mp3`
        const { error: uploadError } = await supabase
          .storage.from('videos')
          .upload(fileName, musicBuffer, { contentType: 'audio/mpeg', upsert: false })

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
          storedMusicUrl = urlData.publicUrl
        }
      }
    } catch (uploadErr) {
      console.error('Music upload error:', uploadErr)
    }

    if (video_id) {
      await supabase.from('videos').update({
        music_url: storedMusicUrl,
        music_prompt,
      }).eq('id', video_id)
    }

    return NextResponse.json({ success: true, music_url: storedMusicUrl })
  } catch (err) {
    console.error('Generate music error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
