/*
  Migration SQL — run in Supabase SQL editor:

  CREATE TABLE api_usage_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES organizations(id),
    type text NOT NULL,
    provider text NOT NULL,
    model text NOT NULL,
    success boolean DEFAULT true,
    duration_ms integer,
    cost_estimate numeric(10,6),
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
  );
  CREATE INDEX idx_usage_org_created ON api_usage_log(org_id, created_at DESC);
  CREATE INDEX idx_usage_type ON api_usage_log(type, created_at DESC);
*/

import { createAdminClient } from '@/lib/supabase/admin'

export async function logUsage(params: {
  org_id: string
  type: 'text_generation' | 'image_generation' | 'video_generation' | 'music_generation' | 'overlay_render'
  provider: string
  model: string
  success: boolean
  duration_ms?: number
  cost_estimate?: number
  metadata?: Record<string, unknown>
}) {
  try {
    const supabase = createAdminClient()
    await supabase.from('api_usage_log').insert({
      org_id: params.org_id,
      type: params.type,
      provider: params.provider,
      model: params.model,
      success: params.success,
      duration_ms: params.duration_ms ?? null,
      cost_estimate: params.cost_estimate ?? null,
      metadata: params.metadata ?? {},
    })
  } catch (err) {
    console.error('logUsage error:', err)
  }
}
