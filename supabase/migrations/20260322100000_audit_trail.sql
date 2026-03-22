-- ============================================================
-- Audit Trail — rich event log with auto-triggers
-- ============================================================

CREATE TABLE audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  resource_title TEXT,
  changes JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_trail_org ON audit_trail(org_id);
CREATE INDEX idx_audit_trail_created ON audit_trail(created_at DESC);
CREATE INDEX idx_audit_trail_resource ON audit_trail(resource_type, resource_id);
CREATE INDEX idx_audit_trail_user ON audit_trail(user_id);

-- RLS
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

-- Superadmin (aiagenten_admin) can see all
CREATE POLICY audit_trail_superadmin ON audit_trail
  FOR SELECT USING (is_aiagenten_admin());

-- Org users can see their own org's audit trail
CREATE POLICY audit_trail_org_read ON audit_trail
  FOR SELECT USING (org_id = get_user_org_id());

-- All authenticated users can INSERT (for logging)
CREATE POLICY audit_trail_insert ON audit_trail
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- Trigger: social_posts
-- ============================================================
CREATE OR REPLACE FUNCTION log_social_post_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_trail (org_id, user_id, action, resource_type, resource_id, resource_title, changes)
    VALUES (NEW.org_id, auth.uid(), 'post.created', 'post', NEW.id,
      COALESCE(LEFT(NEW.caption, 80), LEFT(NEW.content_text, 80)),
      jsonb_build_object('status', NEW.status, 'platform', NEW.platform, 'format', NEW.format));
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO audit_trail (org_id, user_id, action, resource_type, resource_id, resource_title, changes)
      VALUES (NEW.org_id, auth.uid(),
        CASE
          WHEN NEW.status = 'approved' THEN 'post.approved'
          WHEN NEW.status = 'rejected' THEN 'post.rejected'
          WHEN NEW.status = 'published' THEN 'post.published'
          WHEN NEW.status = 'scheduled' THEN 'post.scheduled'
          WHEN NEW.status = 'publishing' THEN 'post.publishing'
          WHEN NEW.status = 'draft' THEN 'post.reverted_to_draft'
          ELSE 'post.status_changed'
        END,
        'post', NEW.id, COALESCE(LEFT(NEW.caption, 80), LEFT(NEW.content_text, 80)),
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'approved_by', NEW.approved_by));
    END IF;
    -- Log content edits
    IF OLD.content_text IS DISTINCT FROM NEW.content_text OR OLD.caption IS DISTINCT FROM NEW.caption THEN
      INSERT INTO audit_trail (org_id, user_id, action, resource_type, resource_id, resource_title, changes)
      VALUES (NEW.org_id, auth.uid(), 'post.edited', 'post', NEW.id,
        COALESCE(LEFT(NEW.caption, 80), LEFT(NEW.content_text, 80)),
        jsonb_build_object('caption_changed', OLD.caption IS DISTINCT FROM NEW.caption, 'content_changed', OLD.content_text IS DISTINCT FROM NEW.content_text));
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_trail (org_id, user_id, action, resource_type, resource_id, resource_title)
    VALUES (OLD.org_id, auth.uid(), 'post.deleted', 'post', OLD.id,
      COALESCE(LEFT(OLD.caption, 80), LEFT(OLD.content_text, 80)));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER social_posts_audit
  AFTER INSERT OR UPDATE OR DELETE ON social_posts
  FOR EACH ROW EXECUTE FUNCTION log_social_post_changes();

-- ============================================================
-- Trigger: media_assets
-- ============================================================
CREATE OR REPLACE FUNCTION log_media_asset_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_trail (org_id, user_id, action, resource_type, resource_id, resource_title, changes)
    VALUES (NEW.org_id, auth.uid(), 'media.created', 'media_asset', NEW.id, NEW.filename,
      jsonb_build_object('source', NEW.source, 'mime_type', NEW.mime_type));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_trail (org_id, user_id, action, resource_type, resource_id, resource_title)
    VALUES (OLD.org_id, auth.uid(), 'media.deleted', 'media_asset', OLD.id, OLD.filename);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER media_assets_audit
  AFTER INSERT OR DELETE ON media_assets
  FOR EACH ROW EXECUTE FUNCTION log_media_asset_changes();

-- ============================================================
-- Trigger: brand_profiles
-- ============================================================
CREATE OR REPLACE FUNCTION log_brand_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_trail (org_id, user_id, action, resource_type, resource_id, resource_title, changes)
    VALUES (
      NEW.org_id,
      auth.uid(), 'brand.updated', 'brand_profile', NEW.id, NEW.tagline,
      jsonb_build_object('fields_changed', (
        SELECT jsonb_agg(key) FROM jsonb_each_text(to_jsonb(NEW)) n
        FULL OUTER JOIN jsonb_each_text(to_jsonb(OLD)) o USING (key)
        WHERE n.value IS DISTINCT FROM o.value
      )));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER brand_profiles_audit
  AFTER UPDATE ON brand_profiles
  FOR EACH ROW EXECUTE FUNCTION log_brand_profile_changes();

-- ============================================================
-- Trigger: social_accounts
-- ============================================================
CREATE OR REPLACE FUNCTION log_social_account_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_trail (org_id, user_id, action, resource_type, resource_id, resource_title)
    VALUES (NEW.org_id, auth.uid(), 'connection.linked', 'social_account', NEW.id,
      NEW.platform || ': ' || COALESCE(NEW.account_name, ''));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_trail (org_id, user_id, action, resource_type, resource_id, resource_title)
    VALUES (OLD.org_id, auth.uid(), 'connection.disconnected', 'social_account', OLD.id,
      OLD.platform || ': ' || COALESCE(OLD.account_name, ''));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER social_accounts_audit
  AFTER INSERT OR DELETE ON social_accounts
  FOR EACH ROW EXECUTE FUNCTION log_social_account_changes();
