import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function formatSrtTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

export async function POST(request: NextRequest) {
  try {
    const { segments, org_id } = await request.json()

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: 'segments array is required' }, { status: 400 })
    }

    if (!org_id) {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
    }

    // Generate SRT content
    const srtContent = segments
      .map((seg: { start: number; end: number; text: string }, index: number) => {
        const num = index + 1
        const start = formatSrtTimestamp(seg.start)
        const end = formatSrtTimestamp(seg.end)
        const text = seg.text.trim()
        return `${num}\n${start} --> ${end}\n${text}\n`
      })
      .join('\n')

    const supabase = createAdminClient()
    const fileName = `${org_id}/subtitles/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.srt`

    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(fileName, Buffer.from(srtContent, 'utf-8'), {
        contentType: 'text/srt',
        upsert: false,
      })

    if (uploadError) {
      console.error('SRT upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload SRT file' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      srt_content: srtContent,
    })
  } catch (err) {
    console.error('Generate SRT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
