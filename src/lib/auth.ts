import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

export type AuthContext = {
  user: User
  orgId: string
  role: string
  isAdmin: boolean // platform super-admin
}

/**
 * Require authenticated user with a valid profile.
 * Returns AuthContext or a NextResponse with the appropriate error status.
 */
export async function requireUser(): Promise<AuthContext | NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error } = await supabase
    .from('users')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (error || !profile || !profile.org_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return {
    user,
    orgId: profile.org_id,
    role: profile.role || 'member',
    isAdmin: profile.role === 'aiagenten_admin',
  }
}

/**
 * Require authenticated user with access to the given org.
 * Platform super-admins (aiagenten_admin) can access any org.
 * Returns AuthContext or a NextResponse with the error.
 */
export async function requireOrgAccess(
  orgId: string | null | undefined,
): Promise<AuthContext | NextResponse> {
  if (!orgId) {
    return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
  }

  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth

  if (auth.orgId !== orgId && !auth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return auth
}

/**
 * Require the caller to be a platform super-admin (aiagenten_admin).
 * Returns AuthContext or a NextResponse with the error.
 */
export async function requireAdmin(): Promise<AuthContext | NextResponse> {
  const auth = await requireUser()
  if (auth instanceof NextResponse) return auth

  if (!auth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return auth
}
