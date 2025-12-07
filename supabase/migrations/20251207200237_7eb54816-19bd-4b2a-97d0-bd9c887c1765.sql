-- Add performer and event_time columns to content_queue
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS performer text,
ADD COLUMN IF NOT EXISTS event_time text;

-- Update source URLs to point to actual event calendar pages
UPDATE sources SET url = 'https://genevataphouse.com/events/' WHERE name = 'Geneva Tap House - Events';
UPDATE sources SET url = 'https://pier290.com/events/' WHERE name = 'PIER 290 - Events';