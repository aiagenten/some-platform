-- Allow 'generating' and 'failed' statuses on articles for async AI generation
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_status_check;
ALTER TABLE articles ADD CONSTRAINT articles_status_check
  CHECK (status IN ('draft', 'published', 'scheduled', 'generating', 'failed'));

-- Track AI generation errors so user can see why it failed
ALTER TABLE articles ADD COLUMN IF NOT EXISTS generation_error TEXT;
