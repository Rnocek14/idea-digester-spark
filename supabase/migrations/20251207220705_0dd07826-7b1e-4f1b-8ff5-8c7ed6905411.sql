-- Clean up garbage performer data that contains sentences/descriptions instead of names

UPDATE content_queue
SET performer = NULL
WHERE performer IS NOT NULL
  AND (
    -- Contains sentence-like patterns (multiple words with common words)
    performer ~* '\y(the|of|and|with|your|each|during|from|such|as|for|on|in|at|to)\y.*\y(the|of|and|with|your|each|during|from|such|as|for|on|in|at|to)\y'
    -- Contains ellipsis or truncation
    OR performer LIKE '%…%'
    OR performer LIKE '%...%'
    -- Contains common garbage phrases
    OR performer ~* '(first|second|third|every|wednesday|thursday|friday|saturday|sunday|monday|tuesday)'
    OR performer ~* '(meal|afternoon|evening|morning|night|songs|contemporaries|elvis|lewis)'
    OR performer ~* '(enjoy|welcome|featuring|experience|menu|dinner|lunch|brunch)'
    -- Too long to be a performer name (likely description)
    OR LENGTH(performer) > 40
    -- Contains URL or email patterns
    OR performer ~* '@|http|www\.'
    -- Looks like venue description
    OR performer ~* '(bar|resort|pier|house|mansion|casino|cocktail|fish fry)'
  );

-- Also clean up event_time that looks like garbage
UPDATE content_queue
SET event_time = NULL
WHERE event_time IS NOT NULL
  AND (
    -- Contains non-time text
    event_time ~* '[a-zA-Z]{4,}'
    -- Too long
    OR LENGTH(event_time) > 30
  );