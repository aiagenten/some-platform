-- ============================================================
-- E10: Upsert social account with encrypted token
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_social_account(
  p_org_id UUID,
  p_platform TEXT,
  p_account_id TEXT,
  p_account_name TEXT,
  p_access_token TEXT,
  p_token_expires_at TIMESTAMPTZ,
  p_token_secret TEXT,
  p_scopes TEXT[] DEFAULT '{}',
  p_metadata TEXT DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO social_accounts (
    org_id, platform, account_id, account_name,
    access_token_enc, token_expires_at,
    scopes, metadata, connected_at
  ) VALUES (
    p_org_id,
    p_platform::social_platform,
    p_account_id,
    p_account_name,
    pgp_sym_encrypt(p_access_token, p_token_secret),
    p_token_expires_at,
    p_scopes,
    p_metadata::jsonb,
    now()
  )
  ON CONFLICT (org_id, platform, account_id) DO UPDATE SET
    account_name = EXCLUDED.account_name,
    access_token_enc = EXCLUDED.access_token_enc,
    token_expires_at = EXCLUDED.token_expires_at,
    scopes = EXCLUDED.scopes,
    metadata = EXCLUDED.metadata,
    connected_at = now(),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- E10: Decrypt token helper (used by Edge Functions via service role)
-- ============================================================

CREATE OR REPLACE FUNCTION decrypt_social_token(
  p_account_id UUID,
  p_token_secret TEXT
)
RETURNS TEXT AS $$
  SELECT pgp_sym_decrypt(access_token_enc, p_token_secret)
  FROM social_accounts
  WHERE id = p_account_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- E11: Audit log helper for publish events
-- ============================================================

CREATE OR REPLACE FUNCTION log_publish_event(
  p_org_id UUID,
  p_post_id UUID,
  p_action TEXT,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO audit_logs (org_id, action, table_name, record_id, new_data)
  VALUES (p_org_id, p_action, 'social_posts', p_post_id, p_details)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Storage bucket for generated images
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to post images
CREATE POLICY "Public read access for post images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-images');

-- Allow service role to upload
CREATE POLICY "Service role can upload post images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-images');
