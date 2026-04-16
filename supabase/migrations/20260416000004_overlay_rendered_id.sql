-- Track which overlay template the rendered overlay_image_url corresponds to.
-- Used to prevent publishing with a stale overlay_image_url after the user
-- switches templates faster than the canvas re-render can keep up.
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS overlay_rendered_id TEXT;
