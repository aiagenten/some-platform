-- Onboarding progress tracking
-- Stores which step each org is on and whether onboarding is complete

CREATE TABLE IF NOT EXISTS onboarding_progress (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_progress_org_id ON onboarding_progress(org_id);

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own org onboarding' AND tablename = 'onboarding_progress') THEN
    CREATE POLICY "Users can view own org onboarding"
      ON onboarding_progress FOR SELECT
      USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own org onboarding' AND tablename = 'onboarding_progress') THEN
    CREATE POLICY "Users can insert own org onboarding"
      ON onboarding_progress FOR INSERT
      WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own org onboarding' AND tablename = 'onboarding_progress') THEN
    CREATE POLICY "Users can update own org onboarding"
      ON onboarding_progress FOR UPDATE
      USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access onboarding' AND tablename = 'onboarding_progress') THEN
    CREATE POLICY "Service role full access onboarding"
      ON onboarding_progress FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;
