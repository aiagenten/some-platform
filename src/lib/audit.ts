import { createClient } from '@/lib/supabase/server'

export async function logAudit({
  action,
  resourceType,
  resourceId,
  resourceTitle,
  changes,
  metadata,
}: {
  action: string
  resourceType: string
  resourceId?: string
  resourceTitle?: string
  changes?: Record<string, unknown>
  metadata?: Record<string, unknown>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('org_id')
    .eq('id', user?.id)
    .single()

  await supabase.from('audit_trail').insert({
    org_id: profile?.org_id,
    user_id: user?.id,
    user_email: user?.email,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    resource_title: resourceTitle,
    changes: changes || {},
    metadata: metadata || {},
  })
}
