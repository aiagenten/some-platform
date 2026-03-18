ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS platform_post_id TEXT;
ALTER TABLE post_analytics ADD CONSTRAINT post_analytics_post_id_unique UNIQUE (post_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform_post_id ON social_posts(platform_post_id) WHERE platform_post_id IS NOT NULL;
