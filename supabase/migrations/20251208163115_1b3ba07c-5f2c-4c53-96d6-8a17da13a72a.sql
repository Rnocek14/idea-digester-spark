-- Fix incorrectly classified incidents

-- 1. Fire department news story is NOT an incident - mark as false alarm
UPDATE incidents 
SET status = 'false_alarm', 
    resolution_reason = 'News article about fire department policy, not an active incident'
WHERE id = '750f979d-8d0d-4af3-a1bd-469203dc740e';

-- 2. Ladies Night event already false_alarm, just clean up the bad location
UPDATE incidents 
SET location = NULL
WHERE id = 'efb210a9-dbb8-4f39-9d98-7aa070828563';

-- 3. Kenosha tragedy - resolve as it's not Lake Geneva local and is an old story
UPDATE incidents 
SET status = 'resolved', 
    resolved_at = NOW(),
    resolution_reason = 'Historical news story about Kenosha tragedy, not active Lake Geneva incident'
WHERE id = 'cd9e8e6b-77fe-48a1-b4a5-fce5bb43382a';