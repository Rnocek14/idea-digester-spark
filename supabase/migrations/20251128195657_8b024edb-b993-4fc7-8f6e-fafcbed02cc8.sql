-- Create auto_publish_rules table
CREATE TABLE IF NOT EXISTS auto_publish_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_id uuid REFERENCES sources(id) ON DELETE CASCADE,
  category text,
  action text NOT NULL CHECK (action IN ('auto_publish', 'needs_review', 'flag')),
  enabled boolean NOT NULL DEFAULT true
);

-- Performance index for fast rule lookups
CREATE INDEX IF NOT EXISTS auto_publish_rules_source_cat_idx
  ON auto_publish_rules (source_id, category)
  WHERE enabled = true;

-- Updated_at trigger
CREATE TRIGGER handle_updated_at_auto_publish_rules
  BEFORE UPDATE ON auto_publish_rules
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- RLS policies
ALTER TABLE auto_publish_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all rules"
  ON auto_publish_rules FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage rules"
  ON auto_publish_rules FOR ALL
  USING (has_role(auth.uid(), 'admin'));