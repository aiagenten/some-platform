-- Tone of voice samples for brand training
CREATE TABLE IF NOT EXISTS tone_samples (
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
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
