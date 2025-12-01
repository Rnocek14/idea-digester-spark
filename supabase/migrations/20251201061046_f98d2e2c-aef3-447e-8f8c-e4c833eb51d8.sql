-- Add sponsored fields to content_queue
ALTER TABLE content_queue 
ADD COLUMN is_sponsored BOOLEAN DEFAULT false,
ADD COLUMN sponsor_id UUID REFERENCES sponsors(id) ON DELETE SET NULL;

-- Add indexes for sponsor queries
CREATE INDEX idx_content_queue_sponsor_id ON content_queue(sponsor_id);
CREATE INDEX idx_content_queue_is_sponsored ON content_queue(is_sponsored) WHERE is_sponsored = true;