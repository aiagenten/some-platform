-- ============================================================
-- SoMe Platform — Initial Schema + RLS
-- E2: All tables  |  E3: RLS policies
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'admin',
  'editor',
  'viewer',
  'aiagenten_admin'
);

CREATE TYPE post_status AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'scheduled',
  'publishing',
  'published',
  'failed'
);

CREATE TYPE social_platform AS ENUM (
  'instagram',
  'facebook',
  'linkedin',
  'tiktok'
);

CREATE TYPE post_format AS ENUM (
  'feed',
  'story',
  'reel',
  'carousel',
  'article',
  'video'
);

CREATE TYPE feedback_action AS ENUM (
  'approved',
  'rejected',
  'edited'
);

CREATE TYPE learning_type AS ENUM (
  'style',
  'tone',
  'topic',
  'format',
  'timing'
);

CREATE TYPE learning_source AS ENUM (
  'rejection',
  'edit',
  'analytics',
  'manual'
);

-- ============================================================
-- TABLES
-- ============================================================

-- Organizations (tenants)
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  logo_url    TEXT,
  website_url TEXT,
  industry    TEXT,
  brand_colors JSONB DEFAULT '[]'::jsonb,
  brand_fonts  JSONB DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);

-- Users (linked to Supabase Auth)
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role        user_role NOT NULL DEFAULT 'viewer',
  name        TEXT,
  email       TEXT NOT NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);

-- Brand Profiles (Business DNA)
CREATE TABLE brand_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_url       TEXT,
  scraped_data     JSONB DEFAULT '{}'::jsonb,
  colors           JSONB DEFAULT '[]'::jsonb,
  fonts            JSONB DEFAULT '[]'::jsonb,
  logo_url         TEXT,
  tagline          TEXT,
  description      TEXT,
  tone             TEXT,
  voice_description TEXT,
  tone_keywords    TEXT[] DEFAULT '{}',
  target_audience  TEXT,
  key_messages     TEXT[] DEFAULT '{}',
  visual_style     JSONB DEFAULT '{}'::jsonb,
  design_guidelines JSONB DEFAULT '{}'::jsonb,
  do_list          TEXT[] DEFAULT '{}',
  dont_list        TEXT[] DEFAULT '{}',
  image_prompt_preferences JSONB DEFAULT '{}'::jsonb,
  last_scraped_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_brand_profiles_org_id ON brand_profiles(org_id);

-- Social Accounts (OAuth tokens — encrypted with pgcrypto)
CREATE TABLE social_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform        social_platform NOT NULL,
  account_name    TEXT,
  account_id      TEXT,
  -- Tokens encrypted with pgcrypto (pgp_sym_encrypt)
  -- Decrypt: pgp_sym_decrypt(access_token_enc, current_setting('app.token_secret'))
  access_token_enc  BYTEA,
  refresh_token_enc BYTEA,
  token_expires_at  TIMESTAMPTZ,
  scopes           TEXT[] DEFAULT '{}',
  metadata         JSONB DEFAULT '{}'::jsonb,
  connected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_social_accounts_org_id ON social_accounts(org_id);
CREATE UNIQUE INDEX idx_social_accounts_org_platform_account
  ON social_accounts(org_id, platform, account_id);

-- Social Posts (dedicated per-platform posts — NOT blog_posts catch-all)
CREATE TABLE social_posts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  platform         social_platform NOT NULL,
  format           post_format NOT NULL DEFAULT 'feed',
  content_text     TEXT,
  content_html     TEXT,
  caption          TEXT,
  hashtags         TEXT[] DEFAULT '{}',
  media_urls       TEXT[] DEFAULT '{}',
  content_image_url TEXT,
  content_video_url TEXT,
  status           post_status NOT NULL DEFAULT 'draft',
  approved_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  scheduled_for    TIMESTAMPTZ,
  published_at     TIMESTAMPTZ,
  published_id     TEXT, -- external platform post ID
  ai_generated     BOOLEAN DEFAULT false,
  ai_prompt        TEXT,
  metadata         JSONB DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Prevent duplicate posting: max 1 post per (org, day, format, platform)
  CONSTRAINT unique_post_per_slot UNIQUE (org_id, platform, format, scheduled_for)
);

CREATE INDEX idx_social_posts_org_id ON social_posts(org_id);
CREATE INDEX idx_social_posts_status ON social_posts(status);
CREATE INDEX idx_social_posts_scheduled ON social_posts(scheduled_for)
  WHERE status IN ('approved', 'scheduled');
CREATE INDEX idx_social_posts_org_status ON social_posts(org_id, status);

-- Content Feedback (learning loop)
CREATE TABLE content_feedback (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id          UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  given_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  action           feedback_action NOT NULL,
  rejection_reason TEXT,
  edit_diff        JSONB DEFAULT '{}'::jsonb,
  engagement_score FLOAT,
  comment          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_feedback_org_id ON content_feedback(org_id);
CREATE INDEX idx_content_feedback_post_id ON content_feedback(post_id);

-- Brand Learnings (self-learning system)
CREATE TABLE brand_learnings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  learning_type  learning_type NOT NULL,
  rule           TEXT NOT NULL,
  source         learning_source NOT NULL,
  source_post_id UUID REFERENCES social_posts(id) ON DELETE SET NULL,
  confidence     FLOAT DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  active         BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_brand_learnings_org_id ON brand_learnings(org_id);
CREATE INDEX idx_brand_learnings_active ON brand_learnings(org_id, active)
  WHERE active = true;

-- Embed Tokens (for embeddable widgets)
CREATE TABLE embed_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token          TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  label          TEXT,
  allowed_origins TEXT[] DEFAULT '{}',
  permissions    JSONB DEFAULT '{"read": true, "approve": false}'::jsonb,
  expires_at     TIMESTAMPTZ,
  active         BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_embed_tokens_token ON embed_tokens(token) WHERE active = true;
CREATE INDEX idx_embed_tokens_org_id ON embed_tokens(org_id);

-- Audit Logs
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  table_name  TEXT,
  record_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_brand_profiles_updated_at
  BEFORE UPDATE ON brand_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_social_accounts_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_social_posts_updated_at
  BEFORE UPDATE ON social_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_brand_learnings_updated_at
  BEFORE UPDATE ON brand_learnings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- E3: RLS POLICIES
-- ============================================================

-- Helper function: get current user's org_id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if current user is aiagenten_admin
CREATE OR REPLACE FUNCTION is_aiagenten_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'aiagenten_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- Enable RLS on all tables ----
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE embed_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE POLICY "aiagenten_admin: full access to organizations"
  ON organizations FOR ALL
  USING (is_aiagenten_admin())
  WITH CHECK (is_aiagenten_admin());

CREATE POLICY "users: read own organization"
  ON organizations FOR SELECT
  USING (id = get_user_org_id());

-- ============================================================
-- USERS
-- ============================================================
CREATE POLICY "aiagenten_admin: full access to users"
  ON users FOR ALL
  USING (is_aiagenten_admin())
  WITH CHECK (is_aiagenten_admin());

CREATE POLICY "users: read users in own org"
  ON users FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "users: update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- BRAND_PROFILES
-- ============================================================
CREATE POLICY "aiagenten_admin: full access to brand_profiles"
  ON brand_profiles FOR ALL
  USING (is_aiagenten_admin())
  WITH CHECK (is_aiagenten_admin());

CREATE POLICY "users: read own org brand profiles"
  ON brand_profiles FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "admin/editor: manage own org brand profiles"
  ON brand_profiles FOR ALL
  USING (org_id = get_user_org_id() AND get_user_role() IN ('admin', 'editor'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_role() IN ('admin', 'editor'));

-- ============================================================
-- SOCIAL_ACCOUNTS (sensitive — tokens)
-- ============================================================
CREATE POLICY "aiagenten_admin: full access to social_accounts"
  ON social_accounts FOR ALL
  USING (is_aiagenten_admin())
  WITH CHECK (is_aiagenten_admin());

CREATE POLICY "admin: manage own org social accounts"
  ON social_accounts FOR ALL
  USING (org_id = get_user_org_id() AND get_user_role() = 'admin')
  WITH CHECK (org_id = get_user_org_id() AND get_user_role() = 'admin');

CREATE POLICY "editor/viewer: read own org social accounts"
  ON social_accounts FOR SELECT
  USING (org_id = get_user_org_id());

-- ============================================================
-- SOCIAL_POSTS
-- ============================================================
CREATE POLICY "aiagenten_admin: full access to social_posts"
  ON social_posts FOR ALL
  USING (is_aiagenten_admin())
  WITH CHECK (is_aiagenten_admin());

CREATE POLICY "users: read own org posts"
  ON social_posts FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "admin/editor: create/update own org posts"
  ON social_posts FOR INSERT
  WITH CHECK (org_id = get_user_org_id() AND get_user_role() IN ('admin', 'editor'));

CREATE POLICY "admin/editor: update own org posts"
  ON social_posts FOR UPDATE
  USING (org_id = get_user_org_id() AND get_user_role() IN ('admin', 'editor'))
  WITH CHECK (org_id = get_user_org_id() AND get_user_role() IN ('admin', 'editor'));

CREATE POLICY "admin: delete own org posts"
  ON social_posts FOR DELETE
  USING (org_id = get_user_org_id() AND get_user_role() = 'admin');

-- ============================================================
-- CONTENT_FEEDBACK
-- ============================================================
CREATE POLICY "aiagenten_admin: full access to content_feedback"
  ON content_feedback FOR ALL
  USING (is_aiagenten_admin())
  WITH CHECK (is_aiagenten_admin());

CREATE POLICY "users: read own org feedback"
  ON content_feedback FOR SELECT
  USING (org_id = get_user_org_id());

CREATE POLICY "admin/editor: create feedback"
  ON content_feedback FOR INSERT
  WITH CHECK (org_id = get_user_org_id() AND get_user_role() IN ('admin', 'editor'));

-- ============================================================
-- BRAND_LEARNINGS
-- ============================================================
CREATE POLICY "aiagenten_admin: full access to brand_learnings"
  ON brand_learnings FOR ALL
  USING (is_aiagenten_admin())
  WITH CHECK (is_aiagenten_admin());

CREATE POLICY "users: read own org learnings"
  ON brand_learnings FOR SELECT
  USING (org_id = get_user_org_id());

-- ============================================================
-- EMBED_TOKENS
-- ============================================================
CREATE POLICY "aiagenten_admin: full access to embed_tokens"
  ON embed_tokens FOR ALL
  USING (is_aiagenten_admin())
  WITH CHECK (is_aiagenten_admin());

CREATE POLICY "admin: manage own org embed tokens"
  ON embed_tokens FOR ALL
  USING (org_id = get_user_org_id() AND get_user_role() = 'admin')
  WITH CHECK (org_id = get_user_org_id() AND get_user_role() = 'admin');

-- ============================================================
-- AUDIT_LOGS
-- ============================================================
CREATE POLICY "aiagenten_admin: read all audit logs"
  ON audit_logs FOR SELECT
  USING (is_aiagenten_admin());

CREATE POLICY "users: read own org audit logs"
  ON audit_logs FOR SELECT
  USING (org_id = get_user_org_id());

-- Audit logs are insert-only via service role (no user insert policy)
-- Use service_role key in Edge Functions to write audit logs
