-- Add requires_hyperlocal column to auto_publish_rules
ALTER TABLE auto_publish_rules 
ADD COLUMN IF NOT EXISTS requires_hyperlocal boolean DEFAULT false;

-- Add TMJ4 auto-publish rules WITH hyperlocal gate required
-- TMJ4 source ID: fdaff72a-45b8-4248-8d1d-5afdae638487

-- Events from TMJ4: auto-publish ONLY if hyperlocal
INSERT INTO auto_publish_rules (source_id, category, action, requires_hyperlocal, enabled)
VALUES ('fdaff72a-45b8-4248-8d1d-5afdae638487', 'events', 'auto_publish', true, true);

-- Community from TMJ4: auto-publish ONLY if hyperlocal
INSERT INTO auto_publish_rules (source_id, category, action, requires_hyperlocal, enabled)
VALUES ('fdaff72a-45b8-4248-8d1d-5afdae638487', 'community', 'auto_publish', true, true);

-- Civic from TMJ4: auto-publish ONLY if hyperlocal (your tweak #2)
INSERT INTO auto_publish_rules (source_id, category, action, requires_hyperlocal, enabled)
VALUES ('fdaff72a-45b8-4248-8d1d-5afdae638487', 'civic', 'auto_publish', true, true);

-- Weather from TMJ4: auto-publish ONLY if hyperlocal
INSERT INTO auto_publish_rules (source_id, category, action, requires_hyperlocal, enabled)
VALUES ('fdaff72a-45b8-4248-8d1d-5afdae638487', 'weather', 'auto_publish', true, true);