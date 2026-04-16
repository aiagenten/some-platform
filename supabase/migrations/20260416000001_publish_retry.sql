-- Track publish retry state on social_posts
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS last_publish_error TEXT;

-- Index for the retry sweep query
CREATE INDEX IF NOT EXISTS social_posts_failed_retry_idx
  ON social_posts (status, last_retry_at)
  WHERE status = 'failed';
