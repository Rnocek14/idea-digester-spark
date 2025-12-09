-- Mark the Piano Men: Generations event as rejected (wrong date/location, January 2026 event)
UPDATE content_queue 
SET status = 'rejected' 
WHERE title ILIKE '%piano men%generations%';