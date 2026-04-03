-- SEO & AEO fields for the articles module (Phase 2)
-- Uses IF NOT EXISTS so this migration is safe to run even if Phase 1 already added them.

ALTER TABLE articles ADD COLUMN IF NOT EXISTS target_keyword TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS meta_title TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS seo_score INT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS seo_data JSONB DEFAULT '{}';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS aeo_schema JSONB DEFAULT '{}';
