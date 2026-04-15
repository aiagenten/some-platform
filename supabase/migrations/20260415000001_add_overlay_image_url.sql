-- Add overlay_image_url to social_posts
-- This stores the final composed image (base image + user overlay rendered to canvas)
-- publish-post should prefer this over content_image_url when publishing
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS overlay_image_url TEXT;

COMMENT ON COLUMN social_posts.overlay_image_url IS 'Final composed image URL with user overlay applied. Use this for publishing instead of content_image_url when present.';
