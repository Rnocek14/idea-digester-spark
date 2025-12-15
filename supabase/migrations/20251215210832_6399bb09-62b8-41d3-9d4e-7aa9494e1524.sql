-- Clean up duplicate library source (keep the new active one)
DELETE FROM sources 
WHERE name = 'Lake Geneva Public Library Events' 
  AND status = 'inactive';

-- Also delete orphaned auto_publish_rules for the old inactive source
DELETE FROM auto_publish_rules 
WHERE source_id NOT IN (SELECT id FROM sources);