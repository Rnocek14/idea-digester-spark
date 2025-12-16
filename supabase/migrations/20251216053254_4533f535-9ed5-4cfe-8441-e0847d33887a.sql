-- Create normalize_url function for fast SQL-based normalization
create or replace function public.normalize_url(input text)
returns text
language plpgsql
as $$
declare
  u text := coalesce(trim(input), '');
begin
  if u = '' then return null; end if;

  -- strip query params (simple core: remove everything after ?)
  u := split_part(u, '?', 1);

  -- remove trailing slash
  u := regexp_replace(u, '/+$', '');

  -- lowercase
  u := lower(u);

  return u;
exception when others then
  return lower(regexp_replace(u, '/+$', ''));
end;
$$;

-- STEP 1: Mark publishable duplicates FIRST (before backfilling) using computed normalize_url
-- This prevents unique constraint violations when we backfill
with ranked as (
  select
    id,
    public.normalize_url(original_url) as computed_nurl,
    row_number() over (
      partition by public.normalize_url(original_url)
      order by created_at asc
    ) as rn,
    first_value(id) over (
      partition by public.normalize_url(original_url)
      order by created_at asc
    ) as canonical_id
  from content_queue
  where original_url is not null
    and public.normalize_url(original_url) is not null
    and status in ('approved','auto_published','published')
)
update content_queue cq
set
  status = 'pending',
  metadata = coalesce(cq.metadata, '{}'::jsonb) || jsonb_build_object(
    'duplicate_of', ranked.canonical_id,
    'duplicate_reason', 'normalized_url_publishable',
    'duplicate_marked_at', now()
  )
from ranked
where cq.id = ranked.id
  and ranked.rn > 1;

-- STEP 2: Now backfill all remaining rows (safe since duplicates are marked pending)
update content_queue
set normalized_url = public.normalize_url(original_url)
where normalized_url is null
  and original_url is not null
  and public.normalize_url(original_url) is not null;