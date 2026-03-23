-- Migration: Allow custom seasonal events per org
-- Task #577

ALTER TABLE seasonal_events ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false;
ALTER TABLE seasonal_events ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE seasonal_events ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id);

-- Allow authenticated users to insert custom seasonal events
CREATE POLICY "seasonal_events_insert_custom" ON seasonal_events
  FOR INSERT TO authenticated
  WITH CHECK (is_custom = true AND created_by = auth.uid());

-- Allow owners to update their custom events
CREATE POLICY "seasonal_events_update_custom" ON seasonal_events
  FOR UPDATE TO authenticated
  USING (is_custom = true AND created_by = auth.uid());

-- Allow owners to delete their custom events
CREATE POLICY "seasonal_events_delete_custom" ON seasonal_events
  FOR DELETE TO authenticated
  USING (is_custom = true AND created_by = auth.uid());
