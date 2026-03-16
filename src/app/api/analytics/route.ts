import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    
    const period = searchParams.get('period') || '30' // days
    const platform = searchParams.get('platform') // optional filter
    
    // Get current user and org
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'No profile found' }, { status: 404 })
    }

    const orgId = profile.org_id
    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - parseInt(period))

    // Build query for post analytics
    let analyticsQuery = supabase
      .from('post_analytics')
      .select(`
        *,
        social_posts (
          id,
          caption,
          platform,
          format,
          content_image_url,
          published_at,
          status
        )
      `)
      .eq('org_id', orgId)
      .gte('measured_at', daysAgo.toISOString())
      .order('measured_at', { ascending: false })

    if (platform) {
      analyticsQuery = analyticsQuery.eq('platform', platform)
    }

    const { data: analytics, error } = await analyticsQuery

    if (error) {
      console.error('Analytics query error:', error)
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    // Aggregate stats
    const totals = {
      impressions: 0,
      reach: 0,
      engagement: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    }

    const dailyEngagement: Record<string, number> = {}
    const postEngagement: { post: unknown; engagement: number; impressions: number; reach: number }[] = []

    for (const row of (analytics || [])) {
      totals.impressions += row.impressions || 0
      totals.reach += row.reach || 0
      totals.engagement += row.engagement || 0
      totals.likes += row.likes || 0
      totals.comments += row.comments || 0
      totals.shares += row.shares || 0

      // Group by day
      const day = new Date(row.measured_at).toISOString().split('T')[0]
      dailyEngagement[day] = (dailyEngagement[day] || 0) + (row.engagement || 0)

      // Per-post stats
      if (row.social_posts) {
        postEngagement.push({
          post: row.social_posts,
          engagement: row.engagement || 0,
          impressions: row.impressions || 0,
          reach: row.reach || 0,
        })
      }
    }

    // Sort posts by engagement descending
    postEngagement.sort((a, b) => b.engagement - a.engagement)

    // Convert daily engagement to sorted array
    const dailyData = Object.entries(dailyEngagement)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, engagement]) => ({ date, engagement }))

    return NextResponse.json({
      totals,
      daily: dailyData,
      topPosts: postEngagement.slice(0, 10),
      postCount: postEngagement.length,
      period: parseInt(period),
    })
  } catch (err) {
    console.error('Analytics error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
