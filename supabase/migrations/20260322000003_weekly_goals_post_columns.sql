-- Add headline, subtitle, selected_overlay, suggested_time to social_posts
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS subtitle TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS selected_overlay TEXT;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS suggested_time TEXT;

-- Weekly posting goals per platform
CREATE TABLE IF NOT EXISTS weekly_posting_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  weekly_target INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, platform)
);
