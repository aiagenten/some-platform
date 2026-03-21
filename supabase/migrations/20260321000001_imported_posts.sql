CREATE TABLE imported_social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'facebook', 'instagram', 'linkedin'
  external_id TEXT, -- original platform post ID
  text_content TEXT,
  image_urls TEXT[] DEFAULT '{}',
  permalink TEXT,
  likes INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  posted_at TIMESTAMPTZ,
  is_learning_material BOOLEAN DEFAULT false, -- user selects which posts to learn from
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, platform, external_id)
);

CREATE INDEX idx_imported_posts_org ON imported_social_posts(org_id);
CREATE INDEX idx_imported_posts_learning ON imported_social_posts(org_id) WHERE is_learning_material = true;

-- RLS
ALTER TABLE imported_social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org imported posts"
  ON imported_social_posts FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org imported posts"
  ON imported_social_posts FOR UPDATE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org imported posts"
  ON imported_social_posts FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
