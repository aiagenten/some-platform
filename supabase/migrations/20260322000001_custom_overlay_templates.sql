-- Custom overlay templates created by users via the drag-and-drop editor
CREATE TABLE IF NOT EXISTS custom_overlay_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  -- JSON array of canvas elements (position, size, rotation, type, styles)
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Canvas background settings
  canvas_background JSONB DEFAULT '{"type": "transparent"}'::jsonb,
  -- Thumbnail data URL for preview (small base64)
  thumbnail TEXT,
  -- Dimensions
  width INT NOT NULL DEFAULT 1080,
  height INT NOT NULL DEFAULT 1080,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE custom_overlay_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org templates"
  ON custom_overlay_templates FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org templates"
  ON custom_overlay_templates FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org templates"
  ON custom_overlay_templates FOR UPDATE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own org templates"
  ON custom_overlay_templates FOR DELETE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE INDEX idx_custom_overlay_templates_org ON custom_overlay_templates(org_id);
