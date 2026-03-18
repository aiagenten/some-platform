import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// One-time migration endpoint — call GET /api/setup/migrate to create missing tables
// Protected: only works if SETUP_SECRET matches
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (secret !== process.env.SETUP_SECRET && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const results: Record<string, string> = {}

  // Create tone_samples table via insert trick — check if exists first
  const { error: checkError } = await supabase
    .from('tone_samples')
    .select('id')
    .limit(1)

  if (checkError?.code === '42P01') {
    // Table does not exist — log SQL to run manually
    results.tone_samples = 'TABLE_MISSING — run SQL below in Supabase dashboard'
    results.sql = `CREATE TABLE IF NOT EXISTS tone_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  source_url text,
  content_preview text,
  source_type text DEFAULT 'text',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tone_samples_org_id_idx ON tone_samples(org_id);
ALTER TABLE tone_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own org tone_samples"
  ON tone_samples FOR ALL
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));`
  } else {
    results.tone_samples = 'OK — table exists'
  }

  return NextResponse.json(results)
}
