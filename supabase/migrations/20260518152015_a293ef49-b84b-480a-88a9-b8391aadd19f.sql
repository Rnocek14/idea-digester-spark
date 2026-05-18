
UPDATE public.content_queue
SET
  summary = NULLIF(btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(summary,''), '<style[^<]*</style>', ' ', 'gi'), '<script[^<]*</script>', ' ', 'gi'), '<[^>]*>', ' ', 'g'), '<[^>]*$', ' ', 'g'), '\s+', ' ', 'g')), ''),
  title = btrim(regexp_replace(regexp_replace(coalesce(title,''), '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g')),
  content = NULLIF(btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(content,''), '<style[^<]*</style>', ' ', 'gi'), '<script[^<]*</script>', ' ', 'gi'), '<[^>]*>', ' ', 'g'), '<[^>]*$', ' ', 'g'), '\s+', ' ', 'g')), '')
WHERE summary ~ '<' OR title ~ '<' OR content ~ '<';

UPDATE public.content_queue
SET summary = replace(replace(replace(replace(replace(summary,'&nbsp;',' '),'&amp;','&'),'&quot;','"'),'&#39;',''''),'&lt;','<')
WHERE summary ~ '&(nbsp|amp|quot|#39|lt|gt);';
