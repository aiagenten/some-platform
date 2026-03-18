-- Add unique constraint on brand_profiles.org_id so upsert works correctly
ALTER TABLE brand_profiles ADD CONSTRAINT brand_profiles_org_id_unique UNIQUE (org_id);
