-- Digital Twins: LoRA-trained models of brand owners for AI image generation
CREATE TABLE IF NOT EXISTS digital_twins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  trigger_word TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'training', 'ready', 'failed')),
  training_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  fal_training_request_id TEXT,
  lora_url TEXT,
  lora_scale FLOAT DEFAULT 1.0,
  sample_outputs JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE digital_twins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org twins"
  ON digital_twins FOR SELECT
  USING (tenant_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org twins"
  ON digital_twins FOR INSERT
  WITH CHECK (tenant_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org twins"
  ON digital_twins FOR UPDATE
  USING (tenant_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own org twins"
  ON digital_twins FOR DELETE
  USING (tenant_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE INDEX idx_digital_twins_tenant ON digital_twins(tenant_id);
CREATE INDEX idx_digital_twins_status ON digital_twins(status);

-- Storage bucket for training images (run via Supabase dashboard if not using migrations for storage)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('training-images', 'training-images', true)
-- ON CONFLICT (id) DO NOTHING;
