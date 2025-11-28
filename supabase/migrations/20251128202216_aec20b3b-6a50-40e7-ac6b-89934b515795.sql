-- Fix auto_publish_rules RLS policies to allow INSERT operations
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can manage rules" ON auto_publish_rules;
DROP POLICY IF EXISTS "Admins can view all rules" ON auto_publish_rules;

-- Create separate policies with explicit WITH CHECK for INSERT/UPDATE
CREATE POLICY "Admins can insert rules"
  ON auto_publish_rules FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update rules"
  ON auto_publish_rules FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete rules"
  ON auto_publish_rules FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all rules"
  ON auto_publish_rules FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));