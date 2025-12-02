-- Add breaking news priority columns to content_queue
ALTER TABLE content_queue
ADD COLUMN IF NOT EXISTS is_breaking boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS priority_score integer DEFAULT 0;

-- Create index for efficient breaking news queries
CREATE INDEX IF NOT EXISTS idx_content_queue_breaking ON content_queue (is_breaking DESC, priority_score DESC) WHERE is_breaking = true;