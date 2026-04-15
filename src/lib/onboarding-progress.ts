import { SupabaseClient } from '@supabase/supabase-js'

export type OnboardingProgressRow = {
  id: string
  org_id: string
  current_step: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Get onboarding progress for an org. Returns null if no row exists.
 */
export async function getOnboardingProgress(
  supabase: SupabaseClient,
  orgId: string
): Promise<OnboardingProgressRow | null> {
  const { data } = await supabase
    .from('onboarding_progress')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()
  return data as OnboardingProgressRow | null
}

/**
 * Update current_step in onboarding_progress (upsert).
 * Only advances — won't go backwards.
 */
export async function saveOnboardingStep(
  supabase: SupabaseClient,
  orgId: string,
  step: number
): Promise<void> {
  await supabase
    .from('onboarding_progress')
    .upsert(
      { org_id: orgId, current_step: step },
      { onConflict: 'org_id' }
    )
}

/**
 * Mark onboarding as completed.
 */
export async function completeOnboarding(
  supabase: SupabaseClient,
  orgId: string
): Promise<void> {
  await supabase
    .from('onboarding_progress')
    .upsert(
      { org_id: orgId, completed_at: new Date().toISOString() },
      { onConflict: 'org_id' }
    )
}

/**
 * Check if onboarding is completed for an org.
 */
export async function isOnboardingCompleted(
  supabase: SupabaseClient,
  orgId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('onboarding_progress')
    .select('completed_at')
    .eq('org_id', orgId)
    .maybeSingle()
  return !!(data as OnboardingProgressRow | null)?.completed_at
}
