-- Add carousel_slides JSONB column to social_posts
-- Each element: { slide_index, image_url, overlay_image_url, text_content, headline, subtitle, cta_text }
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS carousel_slides JSONB DEFAULT NULL;

-- Add slide_count for quick queries
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS slide_count INTEGER DEFAULT NULL;

COMMENT ON COLUMN social_posts.carousel_slides IS 'Array of carousel slide objects for multi-slide posts. Each slide has: slide_index, image_url, overlay_image_url, text_content, headline, subtitle, cta_text';
COMMENT ON COLUMN social_posts.slide_count IS 'Number of slides in a carousel post (NULL for non-carousel)';
