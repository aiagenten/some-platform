import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export async function POST(request: NextRequest) {
  try {
    const { compositionId, inputProps, org_id } = await request.json()

    if (!compositionId || !org_id) {
      return NextResponse.json(
        { error: 'compositionId and org_id are required' },
        { status: 400 }
      )
    }

    const outputPath = join(tmpdir(), `remotion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`)
    const entryPoint = join(process.cwd(), 'src', 'remotion', 'index.tsx')

    // Use npx remotion render as a subprocess to avoid webpack bundling issues
    // This approach works locally and can easily be swapped for Lambda in production
    //
    // TODO: For Lambda support, replace this with:
    //   import { renderMediaOnLambda } from '@remotion/lambda/client'
    //   const { bucketName, renderId } = await renderMediaOnLambda({
    //     region: 'us-east-1',
    //     functionName: '<your-lambda-function>',
    //     serveUrl: '<deployed-site-url>',
    //     composition: compositionId,
    //     inputProps,
    //     codec: 'h264',
    //   })

    const propsJson = JSON.stringify(inputProps || {})

    try {
      await execFileAsync('npx', [
        'remotion',
        'render',
        entryPoint,
        compositionId,
        outputPath,
        '--props', propsJson,
        '--codec', 'h264',
      ], {
        cwd: process.cwd(),
        timeout: 300000, // 5 minute timeout
        env: { ...process.env },
      })
    } catch (renderErr) {
      console.error('Remotion render error:', renderErr)
      return NextResponse.json(
        { error: 'Video rendering failed. Ensure Remotion CLI and Chrome/Chromium are available.' },
        { status: 500 }
      )
    }

    // Read rendered file and upload to Supabase Storage
    const outputBuffer = await readFile(outputPath)
    const supabase = createAdminClient()
    const fileName = `${org_id}/rendered/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`

    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(fileName, outputBuffer, {
        contentType: 'video/mp4',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload rendered video' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)

    // Clean up temp file
    try { await unlink(outputPath) } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
    })
  } catch (err) {
    console.error('Render error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
