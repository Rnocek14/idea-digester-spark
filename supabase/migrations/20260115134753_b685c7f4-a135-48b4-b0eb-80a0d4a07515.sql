-- Clean up generic filler/placeholder content
UPDATE content_queue 
SET status = 'rejected', 
    reviewed_at = now(),
    safety_reason = 'generic_filler_content'
WHERE status IN ('pending', 'approved', 'auto_published', 'published')
AND (
  -- "More Info" placeholder titles
  title ~* '^\s*[A-Za-z ]+\s+More Info\s*$'
  -- Non-local "Wisconsin Weekend" roundups
  OR (title ILIKE '%wisconsin weekend%' AND title NOT ILIKE '%lake geneva%')
  -- Generic product pages
  OR (title = 'New Boats' AND original_url LIKE '%gordys%')
  -- Wisconsin Dells (not local)
  OR title ILIKE '%wisconsin dells%'
);

-- Also reject content with obviously AI-generated filler summaries that have no real info
UPDATE content_queue
SET status = 'rejected',
    reviewed_at = now(),
    safety_reason = 'ai_filler_summary'
WHERE status IN ('pending', 'approved', 'auto_published', 'published')
AND (
  -- Classic AI filler patterns with no real substance
  (summary ILIKE '%something for everyone%' AND summary ILIKE '%popular destination%')
  OR (summary ILIKE '%stunning views%' AND summary ILIKE '%welcoming community%')
  OR (summary ILIKE '%whether you%looking for%' AND summary ILIKE '%making it%')
)
AND title NOT ILIKE '%winterfest%'  -- Don't reject legitimate events
AND title NOT ILIKE '%festival%';

-- Count what was cleaned
SELECT 'rejected_filler' as action, COUNT(*) as count 
FROM content_queue 
WHERE safety_reason IN ('generic_filler_content', 'ai_filler_summary')
AND reviewed_at > now() - interval '1 minute';