-- Drop the duplicate foreign key constraint
ALTER TABLE content_queue DROP CONSTRAINT IF EXISTS content_queue_source_fk;