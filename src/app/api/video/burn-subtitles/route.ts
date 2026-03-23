import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, mkdtemp } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { readFile } from 'fs/promises'

const execFileAsync = promisify(execFile)

export async function POST(request: NextRequest) {
  let tempDir: string | null = null

  try {
    const { video_url, srt_url, org_id } = await request.json()

    if (!video_url || !srt_url || !org_id) {
      return NextResponse.json(
        { error: 'video_url, srt_url, and org_id are required' },
        { status: 400 }
      )
    }

    // Check if ffmpeg is available
    try {
      await execFileAsync('ffmpeg', ['-version'])
    } catch {
      console.error('ffmpeg is not installed or not in PATH')
      return NextResponse.json(
        { error: 'ffmpeg is not available on this server' },
        { status: 503 }
      )
    }

    // Create temp directory
    tempDir = await mkdtemp(join(tmpdir(), 'burn-subs-'))
    const videoPath = join(tempDir, 'input.mp4')
    const srtPath = join(tempDir, 'subtitles.srt')
    const outputPath = join(tempDir, 'output.mp4')

    // Download video and SRT files in parallel
    const [videoResponse, srtResponse] = await Promise.all([
      fetch(video_url),
      fetch(srt_url),
    ])

    if (!videoResponse.ok) {
      return NextResponse.json({ error: 'Failed to download video' }, { status: 500 })
    }
    if (!srtResponse.ok) {
      return NextResponse.json({ error: 'Failed to download SRT file' }, { status: 500 })
    }

    const [videoBuffer, srtText] = await Promise.all([
      videoResponse.arrayBuffer(),
      srtResponse.text(),
    ])

    await Promise.all([
      writeFile(videoPath, Buffer.from(videoBuffer)),
      writeFile(srtPath, srtText),
    ])

    // Burn subtitles into video using ffmpeg
    // The subtitles filter requires escaping colons and backslashes in the path
    const escapedSrtPath = srtPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:')
    await execFileAsync('ffmpeg', [
      '-i', videoPath,
      '-vf', `subtitles=${escapedSrtPath}`,
      '-c:a', 'copy',
      '-y',
      outputPath,
    ], { timeout: 300000 }) // 5 minute timeout

    // Read the output file and upload to Supabase Storage
    const outputBuffer = await readFile(outputPath)
    const supabase = createAdminClient()
    const fileName = `${org_id}/subtitled/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`

    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(fileName, outputBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload processed video' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
    })
  } catch (err) {
    console.error('Burn subtitles error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    // Clean up temp files
    if (tempDir) {
      try {
        const files = ['input.mp4', 'subtitles.srt', 'output.mp4']
        await Promise.allSettled(
          files.map(f => unlink(join(tempDir!, f)))
        )
        // Remove temp directory
        const { rmdir } = await import('fs/promises')
        await rmdir(tempDir).catch(() => {})
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
