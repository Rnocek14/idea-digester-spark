-- Add normalized_url column for fast, reliable deduplication
ALTER TABLE content_queue
ADD COLUMN IF NOT EXISTS normalized_url text;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_content_queue_normalized_url
ON content_queue (normalized_url);