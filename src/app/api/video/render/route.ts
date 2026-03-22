import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// TODO: Server-side Remotion rendering requires Chrome/Chromium.
// This route will NOT work on Netlify or other serverless platforms.
// Options for deployment:
//   1. Remotion Lambda (AWS) — recommended for serverless
//   2. Dedicated render server with Chrome installed
//   3. Remotion Cloud (remotion.dev)
// For now, this endpoint validates inputs and is ready for when
// a render environment is available.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      video_url,
      overlay_type,
      show_outro,
      duration,
      aspect_ratio,
      video_id,
      org_id,
    } = body
    // These are used by the render pipeline (currently commented out)
    const _music_url = body.music_url
    const _brand = body.brand
    void _music_url
    void _brand

    if (!video_url || !org_id) {
      return NextResponse.json(
        { error: 'video_url and org_id are required' },
        { status: 400 },
      )
    }

    const supabase = createAdminClient()

    if (video_id) {
      await supabase
        .from('videos')
        .update({ status: 'rendering' })
        .eq('id', video_id)
    }

    // Determine dimensions from aspect ratio
    const dimMap: Record<string, { width: number; height: number }> = {
      '9:16': { width: 1080, height: 1920 },
      '16:9': { width: 1920, height: 1080 },
      '1:1': { width: 1080, height: 1080 },
    }
    const dimensions = dimMap[aspect_ratio || '9:16'] || { width: 1080, height: 1920 }

    const fps = 30
    const durationSec = duration || 5
    const outroDurationSec = show_outro ? 2.5 : 0
    const totalDurationInFrames = Math.ceil((durationSec + outroDurationSec) * fps)
    const outroDurationInFrames = Math.ceil(outroDurationSec * fps)

    // TODO: Uncomment when deploying to an environment with Chrome
    // import { bundle } from '@remotion/bundler'
    // import { renderMedia, selectComposition } from '@remotion/renderer'
    //
    // const bundled = await bundle({
    //   entryPoint: require.resolve('@/remotion/index'),
    //   webpackOverride: (config) => config,
    // })
    //
    // const composition = await selectComposition({
    //   serveUrl: bundled,
    //   id: 'VideoComposition',
    //   inputProps: {
    //     videoUrl: video_url,
    //     musicUrl: music_url || null,
    //     overlayType: overlay_type || null,
    //     showOutro: show_outro || false,
    //     durationInFrames: totalDurationInFrames,
    //     outroDurationInFrames,
    //     fps,
    //     brand: brand || {
    //       logoUrl: null,
    //       brandName: '',
    //       tagline: '',
    //       primaryColor: '#4F46E5',
    //       accentColor: '#06B6D4',
    //       headingFont: 'sans-serif',
    //       bodyFont: 'sans-serif',
    //     },
    //   },
    // })
    //
    // const outputPath = `/tmp/render-${Date.now()}.mp4`
    // await renderMedia({
    //   composition: { ...composition, ...dimensions },
    //   serveUrl: bundled,
    //   codec: 'h264',
    //   outputLocation: outputPath,
    // })
    //
    // const { readFile } = await import('fs/promises')
    // const outputBuffer = await readFile(outputPath)
    // const fileName = `${org_id}/final/${Date.now()}.mp4`
    // await supabase.storage.from('videos')
    //   .upload(fileName, outputBuffer, { contentType: 'video/mp4', upsert: false })
    // const { data: urlData } = supabase.storage.from('videos').getPublicUrl(fileName)
    //
    // if (video_id) {
    //   await supabase.from('videos').update({
    //     final_video_url: urlData.publicUrl,
    //     status: 'ready',
    //   }).eq('id', video_id)
    // }
    //
    // // Cleanup
    // const { unlink } = await import('fs/promises')
    // await unlink(outputPath).catch(() => {})
    //
    // return NextResponse.json({ success: true, final_video_url: urlData.publicUrl })

    // Placeholder response until render environment is set up
    return NextResponse.json({
      error: 'Server-side rendering is not yet configured. Use the Remotion Player for client-side preview.',
      config: {
        dimensions,
        fps,
        totalDurationInFrames,
        outroDurationInFrames,
        overlayType: overlay_type,
        showOutro: show_outro,
      },
    }, { status: 501 })
  } catch (err) {
    console.error('Render error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
