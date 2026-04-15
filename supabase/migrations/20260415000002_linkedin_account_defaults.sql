-- Add is_default flag to social_accounts so each org can designate a default account per platform
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Only one default per org+platform
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_accounts_one_default_per_platform
  ON social_accounts (org_id, platform)
  WHERE is_default = true;

-- Backfill: set is_primary accounts as default (LinkedIn accounts from older OAuth flow)
UPDATE social_accounts
SET is_default = true
WHERE (metadata->>'is_primary')::boolean = true
  AND platform = 'linkedin';

-- Backfill: fix old LinkedIn org accounts missing organization_urn in metadata
UPDATE social_accounts
SET metadata = metadata || jsonb_build_object(
  'account_type', 'organization',
  'organization_urn', 'urn:li:organization:' || split_part(account_id, ':', 2)
)
WHERE platform = 'linkedin'
  AND account_id LIKE 'organization:%'
  AND metadata->>'organization_urn' IS NULL;

-- Backfill: fix old LinkedIn personal accounts missing account_type
UPDATE social_accounts
SET metadata = metadata || jsonb_build_object(
  'account_type', 'personal',
  'user_id', split_part(account_id, ':', 2)
)
WHERE platform = 'linkedin'
  AND account_id LIKE 'person:%'
  AND metadata->>'account_type' IS NULL;
