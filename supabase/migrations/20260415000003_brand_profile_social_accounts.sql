-- Brand Profile Social Accounts
-- Allows multiple brand profiles per org, each with its own linked social accounts
-- One default brand profile per org, one default social account per brand_profile+platform

-- 1. Add name and is_default to brand_profiles
ALTER TABLE brand_profiles
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Hovedprofil',
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill: existing profiles become the default with a sensible name
UPDATE brand_profiles SET is_default = true, name = 'Hovedprofil'
WHERE is_default = false;

-- 3. Drop the old single-profile-per-org unique constraint
ALTER TABLE brand_profiles DROP CONSTRAINT IF EXISTS brand_profiles_org_id_unique;

-- 4. New constraint: only one default brand profile per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_profiles_one_default_per_org
  ON brand_profiles (org_id)
  WHERE is_default = true;

-- 5. Junction table: brand_profile ↔ social_accounts
--    platform is denormalized here for efficient "default per platform" queries
CREATE TABLE IF NOT EXISTS brand_profile_social_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_profile_id    UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  social_account_id   UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  platform            TEXT NOT NULL,
  is_default          BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_profile_id, social_account_id)
);

CREATE INDEX IF NOT EXISTS idx_bpsa_brand_profile_id ON brand_profile_social_accounts(brand_profile_id);
CREATE INDEX IF NOT EXISTS idx_bpsa_social_account_id ON brand_profile_social_accounts(social_account_id);

-- One default account per brand_profile+platform
CREATE UNIQUE INDEX IF NOT EXISTS idx_bpsa_one_default_per_platform
  ON brand_profile_social_accounts (brand_profile_id, platform)
  WHERE is_default = true;

-- 6. Add brand_profile_id to social_posts
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS brand_profile_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_social_posts_brand_profile_id ON social_posts(brand_profile_id);

-- 7. Backfill: link existing social_accounts to their org's default brand profile
--    and set is_default = true (first account per platform becomes default)
INSERT INTO brand_profile_social_accounts (brand_profile_id, social_account_id, platform, is_default)
SELECT DISTINCT ON (bp.id, sa.platform)
  bp.id AS brand_profile_id,
  sa.id AS social_account_id,
  sa.platform::TEXT AS platform,
  true AS is_default
FROM brand_profiles bp
JOIN social_accounts sa ON sa.org_id = bp.org_id
WHERE bp.is_default = true
  AND NOT (sa.metadata->>'for_refresh')::boolean IS TRUE
ORDER BY bp.id, sa.platform, sa.connected_at ASC
ON CONFLICT (brand_profile_id, social_account_id) DO NOTHING;
