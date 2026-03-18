import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST() {
  const supabase = createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("users").select("org_id").eq("id", user.id).single()
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 })

  const orgId = profile.org_id

  // Get all connected social accounts with tokens
  const { data: accounts } = await adminSupabase
    .from("social_accounts")
    .select("id, platform, account_id, metadata, access_token, token_expires_at")
    .eq("org_id", orgId)

  // Get published posts from last 90 days
  const { data: posts } = await adminSupabase
    .from("social_posts")
    .select("id, platform, platform_post_id, published_id, published_at")
    .eq("org_id", orgId)
    .eq("status", "published")
    .gte("published_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

  if (!posts || posts.length === 0) {
    return NextResponse.json({ message: "No published posts to poll", polled: 0 })
  }

  const results = { polled: 0, errors: [] as string[] }

  for (const post of posts) {
    // Use platform_post_id or fall back to published_id
    const postExtId = (post as Record<string, string>).platform_post_id || (post as Record<string, string>).published_id
    if (!postExtId) continue

    const account = accounts?.find(a => a.platform === post.platform)
    if (!account) continue

    const token = (account as Record<string, string>).access_token || (account.metadata as Record<string, string>)?.access_token
    if (!token) continue

    try {
      let metrics: Record<string, number> = {}

      if (post.platform === "facebook" || post.platform === "instagram") {
        // Facebook/Instagram Graph API Insights
        const insightMetrics = post.platform === "instagram"
          ? "impressions,reach,saved"
          : "post_impressions,post_reach,post_engaged_users"

        const res = await fetch(
          `https://graph.facebook.com/v19.0/${postExtId}/insights?metric=${insightMetrics}&access_token=${token}`,
          { signal: AbortSignal.timeout(10000) }
        )

        if (res.ok) {
          const data = await res.json()
          const insightMap: Record<string, number> = {}
          for (const item of data.data || []) {
            insightMap[item.name] = item.values?.[0]?.value || item.value || 0
          }

          if (post.platform === "instagram") {
            // Also get basic metrics
            const basicRes = await fetch(
              `https://graph.facebook.com/v19.0/${postExtId}?fields=like_count,comments_count&access_token=${token}`,
              { signal: AbortSignal.timeout(10000) }
            )
            const basicData = basicRes.ok ? await basicRes.json() : {}
            metrics = {
              impressions: insightMap["impressions"] || 0,
              reach: insightMap["reach"] || 0,
              saves: insightMap["saved"] || 0,
              likes: basicData.like_count || 0,
              comments: basicData.comments_count || 0,
              engagement: (basicData.like_count || 0) + (basicData.comments_count || 0) + (insightMap["saved"] || 0),
            }
          } else {
            // Facebook
            metrics = {
              impressions: insightMap["post_impressions"] || 0,
              reach: insightMap["post_reach"] || 0,
              engagement: insightMap["post_engaged_users"] || 0,
            }
            // Get reactions and comments count
            const detailRes = await fetch(
              `https://graph.facebook.com/v19.0/${postExtId}?fields=reactions.summary(total_count),comments.summary(total_count),shares&access_token=${token}`,
              { signal: AbortSignal.timeout(10000) }
            )
            if (detailRes.ok) {
              const detail = await detailRes.json()
              metrics.likes = detail.reactions?.summary?.total_count || 0
              metrics.comments = detail.comments?.summary?.total_count || 0
              metrics.shares = detail.shares?.count || 0
            }
          }
        }
      } else if (post.platform === "linkedin") {
        // LinkedIn Analytics API
        const accountId = account.account_id
        const orgUrn = (account.metadata as Record<string, string>)?.organization_urn ||
          (accountId?.startsWith("urn") ? accountId : `urn:li:organization:${accountId?.replace("organization:", "")}`)
        if (!orgUrn) continue

        const res = await fetch(
          `https://api.linkedin.com/rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}&shares[0]=${encodeURIComponent(postExtId)}`,
          {
            headers: {
              "Authorization": `Bearer ${token}`,
              "LinkedIn-Version": "202405",
              "X-RestLi-Protocol-Version": "2.0.0",
            },
            signal: AbortSignal.timeout(10000),
          }
        )

        if (res.ok) {
          const data = await res.json()
          const stats = data.elements?.[0]?.totalShareStatistics
          if (stats) {
            metrics = {
              impressions: stats.impressionCount || 0,
              reach: stats.uniqueImpressionsCount || 0,
              engagement: stats.engagement || 0,
              likes: stats.likeCount || 0,
              comments: stats.commentCount || 0,
              shares: stats.shareCount || 0,
              clicks: stats.clickCount || 0,
            }
          }
        }
      }

      if (Object.keys(metrics).length > 0) {
        await adminSupabase.from("post_analytics").upsert({
          post_id: post.id,
          org_id: orgId,
          platform: post.platform,
          ...metrics,
          measured_at: new Date().toISOString(),
        }, { onConflict: "post_id" })
        results.polled++
      }
    } catch (e) {
      results.errors.push(`${post.platform}/${postExtId}: ${e}`)
    }
  }

  return NextResponse.json(results)
}
