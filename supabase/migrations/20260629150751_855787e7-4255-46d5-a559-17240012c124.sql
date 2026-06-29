UPDATE public.content_queue
SET geo_tier = 0, geo_label = NULL, status = 'rejected',
    hold_reason = COALESCE(hold_reason, 'mistagged_regional'),
    decision_path = COALESCE(decision_path,'') || E'\nmanual: regional content mis-tagged T1, demoted'
WHERE id IN (
  'c85d5ae5-c181-4ad6-9f23-aeb9381c8579',
  'fa31eb34-1be0-4e27-a7be-720c574e8e93'
);

UPDATE public.content_queue
SET geo_tier = 0, geo_label = NULL, status = 'rejected',
    hold_reason = COALESCE(hold_reason, 'no_local_keyword'),
    decision_path = COALESCE(decision_path,'') || E'\nretro: no local keyword in title/summary/content'
WHERE status IN ('auto_published','published')
  AND geo_tier IN (1, 2)
  AND created_at >= now() - interval '7 days'
  AND lower(coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(content,'')) !~
      '(lake geneva|geneva lake|williams bay|fontana|big foot beach|wrigley drive|flat iron park|library park|horticultural hall|riviera|grand geneva|abbey resort|pier 290|baker house|gordy|harpoon willie|fat cat|geneva tap house|topsy turvy|house of music|crafted americana|chuck''s lakeshore|chucks lakeshore|town of linn| linn,|walworth|delavan|elkhorn|bloomfield|darien|east troy|lake como|badger high|genoa city|sharon|twin lakes|burlington|pell lake|lyons|whitewater)';