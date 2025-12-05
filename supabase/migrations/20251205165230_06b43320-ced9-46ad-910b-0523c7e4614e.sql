-- 1) Default everything to tier 0 if null
UPDATE content_queue
SET geo_tier = 0
WHERE geo_tier IS NULL;

-- 2) Lake Geneva–only sources → tier 1
UPDATE content_queue cq
SET geo_tier = 1,
    geo_label = 'Lake Geneva'
FROM sources s
WHERE cq.source_id = s.id
  AND cq.geo_tier = 0
  AND s.name IN (
    'Visit Lake Geneva – Events',
    'Lake Geneva School District',
    'City of Lake Geneva News RSS',
    'City of Lake Geneva Calendar'
  );

-- 3) Walworth County–wide sources → tier 2
UPDATE content_queue cq
SET geo_tier = 2,
    geo_label = 'Walworth County'
FROM sources s
WHERE cq.source_id = s.id
  AND cq.geo_tier = 0
  AND s.name IN (
    'TMJ4 Walworth County',
    'Fox6 Walworth County',
    'Fox6 Lake Geneva',
    'Walworth County Community News',
    'Walworth County Sheriff'
  );

-- 4) Keyword-based upgrade: Lake Geneva mentions → tier 1
UPDATE content_queue
SET geo_tier = 1,
    geo_label = 'Lake Geneva'
WHERE geo_tier < 1
  AND (
    title ILIKE '%lake geneva%' OR
    summary ILIKE '%lake geneva%' OR
    title ILIKE '%geneva lake%' OR
    summary ILIKE '%geneva lake%' OR
    title ILIKE '%williams bay%' OR
    summary ILIKE '%williams bay%' OR
    title ILIKE '%fontana%' OR
    summary ILIKE '%fontana%'
  );

-- 5) Keyword-based upgrade: Walworth County mentions → tier 2
UPDATE content_queue
SET geo_tier = 2,
    geo_label = 'Walworth County'
WHERE geo_tier = 0
  AND (
    title ILIKE '%walworth%' OR
    summary ILIKE '%walworth%' OR
    title ILIKE '%delavan%' OR
    summary ILIKE '%delavan%' OR
    title ILIKE '%elkhorn%' OR
    summary ILIKE '%elkhorn%'
  );

-- 6) Set default_geo_tier on Lake Geneva–only sources
UPDATE sources
SET default_geo_tier = 1
WHERE name IN (
  'Visit Lake Geneva – Events',
  'Lake Geneva School District',
  'City of Lake Geneva News RSS',
  'City of Lake Geneva Calendar'
);

-- 7) Set default_geo_tier on Walworth County–wide sources
UPDATE sources
SET default_geo_tier = 2
WHERE name IN (
  'TMJ4 Walworth County',
  'Fox6 Walworth County',
  'Fox6 Lake Geneva',
  'Walworth County Community News',
  'Walworth County Sheriff'
);