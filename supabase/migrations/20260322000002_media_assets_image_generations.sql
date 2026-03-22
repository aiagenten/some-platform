-- Media assets table for the media library
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'upload', -- 'upload', 'ai_generated', 'google_drive', 'onedrive'
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  filename TEXT,
  mime_type TEXT DEFAULT 'image/jpeg',
  file_size INTEGER,
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  is_style_guide BOOLEAN DEFAULT false, -- used as style reference for image generation
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_media_assets_org ON media_assets(org_id);
CREATE INDEX idx_media_assets_source ON media_assets(org_id, source);
CREATE INDEX idx_media_assets_favorite ON media_assets(org_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX idx_media_assets_style_guide ON media_assets(org_id, is_style_guide) WHERE is_style_guide = true;

-- Enable RLS
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org media assets"
  ON media_assets FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert media assets for their org"
  ON media_assets FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their org media assets"
  ON media_assets FOR UPDATE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their org media assets"
  ON media_assets FOR DELETE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Image generations history table
CREATE TABLE IF NOT EXISTS image_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  post_id UUID REFERENCES social_posts(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  prompt TEXT,
  style_id TEXT,
  reference_image_url TEXT,
  is_selected BOOLEAN DEFAULT false, -- the variant currently used by the post
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_image_generations_post ON image_generations(post_id);
CREATE INDEX idx_image_generations_org ON image_generations(org_id);

-- Enable RLS
ALTER TABLE image_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org image generations"
  ON image_generations FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert image generations for their org"
  ON image_generations FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their org image generations"
  ON image_generations FOR UPDATE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
