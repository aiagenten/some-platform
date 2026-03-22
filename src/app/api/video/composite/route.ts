import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { execFile } from 'child_process'
import { writeFile, unlink, mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

async function downloadToFile(url: string, filePath: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download: ${url}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(filePath, buffer)
}

function runFfmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`ffmpeg error: ${stderr || error.message}`))
      else resolve(stdout)
    })
  })
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null
  try {
    const { video_url, music_url, overlay_data_url, fade_in_sec, video_id, org_id } = await request.json()

    if (!video_url || !org_id) {
      return NextResponse.json({ error: 'video_url and org_id are required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    if (video_id) {
      await supabase.from('videos').update({ status: 'compositing' }).eq('id', video_id)
    }

    tempDir = await mkdtemp(join(tmpdir(), 'video-composite-'))
    const videoPath = join(tempDir, 'input.mp4')
    const outputPath = join(tempDir, 'output.mp4')

    await downloadToFile(video_url, videoPath)

    const ffmpegArgs: string[] = ['-y', '-i', videoPath]
    const filterParts: string[] = []
    let mapVideo = '0:v'
    let mapAudio: string | null = null

    // Add music if provided
    if (music_url) {
      const musicPath = join(tempDir, 'music.mp3')
      await downloadToFile(music_url, musicPath)
      ffmpegArgs.push('-i', musicPath)
      mapAudio = '1:a'
    }

    // Add overlay if provided
    if (overlay_data_url) {
      const overlayPath = join(tempDir, 'overlay.png')
      // overlay_data_url is a base64 data URL from canvas
      const base64Data = overlay_data_url.replace(/^data:image\/\w+;base64,/, '')
      await writeFile(overlayPath, Buffer.from(base64Data, 'base64'))

      const inputIdx = music_url ? 2 : 1
      ffmpegArgs.push('-i', overlayPath)

      const fadeStart = fade_in_sec || 1.0
      filterParts.push(`[${inputIdx}]fade=in:st=${fadeStart}:d=0.5[ov]`)
      filterParts.push(`[0:v][ov]overlay=0:0:enable='gt(t,${fadeStart})'[vout]`)
      mapVideo = '[vout]'
    }

    if (filterParts.length > 0) {
      ffmpegArgs.push('-filter_complex', filterParts.join(';'))
    }

    ffmpegArgs.push('-map', mapVideo)
    if (mapAudio) {
      ffmpegArgs.push('-map', mapAudio)
    }
    ffmpegArgs.push('-shortest', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23')
    if (mapAudio) {
      ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k')
    }
    ffmpegArgs.push(outputPath)

    await runFfmpeg(ffmpegArgs)

    // Read output and upload
    const { readFile } = await import('fs/promises')
    const outputBuffer = await readFile(outputPath)

    const fileName = `${org_id}/final/${Date.now()}.mp4`
    const { error: uploadError } = await supabase
      .storage.from('videos')
      .upload(fileName, outputBuffer, { contentType: 'video/mp4', upsert: false })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload final video' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
    const finalVideoUrl = urlData.publicUrl

    if (video_id) {
      await supabase.from('videos').update({
        final_video_url: finalVideoUrl,
        status: 'ready',
      }).eq('id', video_id)
    }

    return NextResponse.json({ success: true, final_video_url: finalVideoUrl })
  } catch (err) {
    console.error('Composite error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    // Cleanup temp files
    if (tempDir) {
      try {
        const { readdir } = await import('fs/promises')
        const files = await readdir(tempDir)
        await Promise.all(files.map(f => unlink(join(tempDir!, f)).catch(() => {})))
        const { rmdir } = await import('fs/promises')
        await rmdir(tempDir).catch(() => {})
      } catch { /* ignore cleanup errors */ }
    }
  }
}
