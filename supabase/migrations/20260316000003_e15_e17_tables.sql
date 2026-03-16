-- ============================================================
-- E15: Post Analytics table
-- ============================================================

CREATE TABLE post_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform        social_platform NOT NULL,
  impressions     INTEGER DEFAULT 0,
  reach           INTEGER DEFAULT 0,
  engagement      INTEGER DEFAULT 0,
  likes           INTEGER DEFAULT 0,
  comments        INTEGER DEFAULT 0,
  shares          INTEGER DEFAULT 0,
  saves           INTEGER DEFAULT 0,
  clicks          INTEGER DEFAULT 0,
  measured_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_post_analytics_org_id ON post_analytics(org_id);
CREATE INDEX idx_post_analytics_post_id ON post_analytics(post_id);
CREATE INDEX idx_post_analytics_measured_at ON post_analytics(measured_at DESC);
CREATE INDEX idx_post_analytics_org_platform ON post_analytics(org_id, platform);

-- RLS
ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aiagenten_admin: full access to post_analytics"
  ON post_analytics FOR ALL
  USING (is_aiagenten_admin())
  WITH CHECK (is_aiagenten_admin());

CREATE POLICY "users: read own org analytics"
  ON post_analytics FOR SELECT
  USING (org_id = get_user_org_id());

-- Updated_at trigger
CREATE TRIGGER trg_post_analytics_updated_at
  BEFORE UPDATE ON post_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- E17: Notification Preferences table
-- ============================================================

CREATE TABLE notification_preferences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_on_approval   BOOLEAN DEFAULT true,
  email_on_publish    BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX idx_notification_preferences_org_id ON notification_preferences(org_id);
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);

-- RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aiagenten_admin: full access to notification_preferences"
  ON notification_preferences FOR ALL
  USING (is_aiagenten_admin())
  WITH CHECK (is_aiagenten_admin());

CREATE POLICY "users: read own notification preferences"
  ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users: manage own notification preferences"
  ON notification_preferences FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
