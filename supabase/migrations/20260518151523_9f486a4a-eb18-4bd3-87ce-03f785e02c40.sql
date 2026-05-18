
UPDATE public.content_queue
SET summary = btrim(regexp_replace(
  regexp_replace(
    regexp_replace(summary, '<style[^<]*</style>|<script[^<]*</script>', ' ', 'gi'),
    '<[^>]+>', ' ', 'g'
  ),
  '\s+', ' ', 'g'
))
WHERE summary ~ '<[^>]+>';

UPDATE public.content_queue
SET content = btrim(regexp_replace(
  regexp_replace(
    regexp_replace(content, '<style[^<]*</style>|<script[^<]*</script>', ' ', 'gi'),
    '<[^>]+>', ' ', 'g'
  ),
  '\s+', ' ', 'g'
))
WHERE content ~ '<[^>]+>';
