-- Add event_date column for actual event dates (separate from ingestion timestamp)
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS event_date date;

-- Index for efficient date filtering
CREATE INDEX IF NOT EXISTS idx_content_queue_event_date ON content_queue(event_date);