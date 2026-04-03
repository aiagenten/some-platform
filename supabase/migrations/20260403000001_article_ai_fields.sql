-- ============================================================
-- Phase 1: Articles table + AI generation fields
-- ============================================================

-- ---- Articles table ----
CREATE TABLE articles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  title               TEXT NOT NULL DEFAULT 'Uten tittel',
  slug                TEXT DEFAULT '',
  content             JSONB,
  excerpt             TEXT,
  featured_image_url  TEXT,
  wordpress_post_id   BIGINT,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'scheduled')),
  metadata            JSONB DEFAULT '{}'::jsonb,

  -- AI generation fields
  target_keyword      TEXT,
  meta_title          TEXT,
  meta_description    TEXT,
  seo_score           INT,
  seo_data            JSONB DEFAULT '{}'::jsonb,
  aeo_schema          JSONB DEFAULT '{}'::jsonb,
  generated_by        TEXT CHECK (generated_by IN ('ai', 'manual')),
  generation_prompt   TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_articles_org_id ON articles(org_id);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_org_status ON articles(org_id, status);
CREATE INDEX idx_articles_slug ON articles(org_id, slug);

-- ---- Updated_at trigger ----
CREATE TRIGGER trg_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---- RLS ----
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aiagenten_admin: full access to articles"
  ON articles FOR ALL
  USING (is_aiagenten_admin())
  WITH CHECK (is_aiagenten_admin());

CREATE POLICY "users: read own org articles"
  ON articles FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "admin/editor: create articles"
  ON articles FOR INSERT
  WITH CHECK (org_id = get_user_org_id() AND get_user_role() IN ('admin', 'editor'));

CREATE POLICY "admin/editor: update own org articles"
  ON articles FOR UPDATE
  USING (org_id = get_user_org_id() AND get_user_role() IN ('admin', 'editor'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_role() IN ('admin', 'editor'));

CREATE POLICY "admin: delete own org articles"
  ON articles FOR DELETE
  USING (org_id = get_user_org_id() AND get_user_role() = 'admin');
