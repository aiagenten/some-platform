-- Migration: Seasonal events, brand seasonal settings, content learnings
-- Task #561, #563, #560

-- Seasonal events table
CREATE TABLE IF NOT EXISTS seasonal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date_pattern TEXT NOT NULL, -- e.g. "12-24" for Christmas Eve, "05-17" for 17. mai
  description TEXT,
  default_enabled BOOLEAN DEFAULT true,
  icon TEXT, -- emoji or icon name
  suggested_prompt TEXT, -- AI prompt suggestion for this season
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Brand-specific seasonal settings
CREATE TABLE IF NOT EXISTS brand_seasonal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  seasonal_event_id UUID NOT NULL REFERENCES seasonal_events(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  custom_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(brand_id, seasonal_event_id)
);

-- Content learnings table
CREATE TABLE IF NOT EXISTS content_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brand_profiles(id) ON DELETE SET NULL,
  learning_type TEXT NOT NULL, -- 'approval_pattern', 'rejection_reason', 'performance', 'style_preference'
  description TEXT NOT NULL,
  source_post_id UUID REFERENCES social_posts(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add rejection_reason to social_posts if not exists
DO $$ BEGIN
  ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add media_type to social_posts for tracking upload type
DO $$ BEGIN
  ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image'; -- 'image', 'video'
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add video_url to social_posts
DO $$ BEGIN
  ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS video_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add subtitle_url to social_posts for SRT files
DO $$ BEGIN
  ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS subtitle_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- RLS Policies for seasonal_events (read-only for all authenticated)
ALTER TABLE seasonal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasonal_events_select" ON seasonal_events
  FOR SELECT TO authenticated USING (true);

-- RLS for brand_seasonal_settings
ALTER TABLE brand_seasonal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_seasonal_settings_select" ON brand_seasonal_settings
  FOR SELECT TO authenticated
  USING (
    brand_id IN (
      SELECT bp.id FROM brand_profiles bp
      JOIN users u ON u.org_id = bp.org_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "brand_seasonal_settings_insert" ON brand_seasonal_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    brand_id IN (
      SELECT bp.id FROM brand_profiles bp
      JOIN users u ON u.org_id = bp.org_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "brand_seasonal_settings_update" ON brand_seasonal_settings
  FOR UPDATE TO authenticated
  USING (
    brand_id IN (
      SELECT bp.id FROM brand_profiles bp
      JOIN users u ON u.org_id = bp.org_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "brand_seasonal_settings_delete" ON brand_seasonal_settings
  FOR DELETE TO authenticated
  USING (
    brand_id IN (
      SELECT bp.id FROM brand_profiles bp
      JOIN users u ON u.org_id = bp.org_id
      WHERE u.id = auth.uid()
    )
  );

-- RLS for content_learnings
ALTER TABLE content_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_learnings_select" ON content_learnings
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "content_learnings_insert" ON content_learnings
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Seed default seasonal events (Norwegian calendar)
INSERT INTO seasonal_events (name, date_pattern, description, default_enabled, icon, suggested_prompt) VALUES
  ('Nyttår', '01-01', 'Nyttårsfeiring og gode forsetter', true, '🎆', 'Lag et innlegg om nyttårsforsetter og nye muligheter for året som kommer'),
  ('Valentinsdagen', '02-14', 'Kjærlighetens dag', true, '❤️', 'Lag et innlegg om kjærlighet, relasjoner eller kunderelasjoner til valentinsdagen'),
  ('Påske', '04-01', 'Påskehøytiden (dato varierer)', true, '🐣', 'Lag et innlegg med påsketema — ferie, avslapning, tradisjon'),
  ('17. mai', '05-17', 'Norges nasjonaldag', true, '🇳🇴', 'Lag et festlig innlegg til Norges grunnlovsdag — flagg, bunad, is og barnetog'),
  ('Sommerfest', '06-21', 'Sommersesongen starter', true, '☀️', 'Lag et sommerlig innlegg som feirer starten på sommersesongen'),
  ('Fellesferie start', '07-01', 'Fellesferien starter', false, '🏖️', 'Lag et innlegg om sommerferie og avkobling'),
  ('Skolestart', '08-15', 'Ny skolestart og høstsesong', false, '📚', 'Lag et innlegg om ny start, høstens muligheter og tilbake-til-rutiner'),
  ('Halloween', '10-31', 'Halloweenfeiring', false, '🎃', 'Lag et kreativt innlegg med halloween-tema'),
  ('Black Friday', '11-29', 'Black Friday-salg', true, '🏷️', 'Lag et innlegg om Black Friday-tilbud og kampanjer'),
  ('1. søndag i advent', '12-01', 'Adventstiden starter', true, '🕯️', 'Lag et innlegg som markerer starten på adventstiden'),
  ('Julebord', '12-10', 'Julebordsesongen', true, '🥂', 'Lag et innlegg om julebordsesongen — feiring, lagånd og hygge'),
  ('Jul', '12-24', 'Julaften og julefeiring', true, '🎄', 'Lag et varmt og hyggelig juleinnlegg med ønsker om god jul'),
  ('Kickoff', '01-15', 'Nyårs-kickoff for bedrifter', false, '🚀', 'Lag et innlegg om årets kickoff — mål, ambisjoner og lagånd')
ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_learnings_tenant ON content_learnings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_learnings_brand ON content_learnings(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_seasonal_brand ON brand_seasonal_settings(brand_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_events_date ON seasonal_events(date_pattern);
