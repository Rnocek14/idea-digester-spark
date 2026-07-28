-- Cleanup pass: (1) dedupe same-incident stories, (2) demote Whitewater-only
-- stories out of the Walworth tier so they don't lead "Local News".
--
-- Safe to re-run. Run in Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1. Same-incident dedupe
--    Cluster by first 60 chars of normalized title within a 3-day window and
--    keep only the earliest published row. The rest get demoted to 'pending'
--    with a hold_reason so we can audit.
-- ---------------------------------------------------------------------------
with clusters as (
  select
    id,
    status,
    publish_date,
    lower(regexp_replace(coalesce(title,''), '[^a-z0-9 ]', '', 'gi')) as norm_title,
    date_trunc('day', publish_date) as day_bucket
  from public.content_queue
  where status = 'auto_published'
    and publish_date > now() - interval '14 days'
),
ranked as (
  select
    id,
    row_number() over (
      partition by left(norm_title, 60)
      order by publish_date asc
    ) as rn
  from clusters
  where length(norm_title) >= 20
)
update public.content_queue cq
set status = 'pending',
    hold_reason = 'duplicate_incident',
    decision_path = coalesce(decision_path,'') || '|dedupe_pass'
from ranked r
where cq.id = r.id
  and r.rn > 1;

-- ---------------------------------------------------------------------------
-- 2. Whitewater-only demotion
--    Whitewater sits on the Walworth/Jefferson line and is not part of the
--    Lake Geneva orbit. If a story mentions Whitewater but NOT any of our
--    actual coverage towns, drop it to geo_tier 0 and hold it for review.
-- ---------------------------------------------------------------------------
update public.content_queue
set geo_tier = 0,
    geo_label = 'Regional',
    status = case when status = 'auto_published' then 'pending' else status end,
    hold_reason = coalesce(hold_reason, 'whitewater_only_not_hyperlocal'),
    decision_path = coalesce(decision_path,'') || '|whitewater_demote'
where (
    title ilike '%whitewater%' or content ilike '%whitewater%'
  )
  and not (
    title ilike '%lake geneva%' or content ilike '%lake geneva%'
    or title ilike '%fontana%'     or content ilike '%fontana%'
    or title ilike '%williams bay%' or content ilike '%williams bay%'
    or title ilike '%delavan%'      or content ilike '%delavan%'
    or title ilike '%elkhorn%'      or content ilike '%elkhorn%'
    or title ilike '%lake como%'    or content ilike '%lake como%'
    or title ilike '%genoa city%'   or content ilike '%genoa city%'
    or title ilike '%linn %'        or content ilike '%linn township%'
  )
  and publish_date > now() - interval '30 days';

-- ---------------------------------------------------------------------------
-- 3. Prevent re-ingestion: extend the hyperlocal gate so Whitewater-only
--    stories are auto-held on insert going forward.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_whitewater_scope()
returns trigger
language plpgsql
as $$
declare
  txt text := lower(coalesce(new.title,'') || ' ' || coalesce(new.content,''));
begin
  if txt like '%whitewater%'
     and txt not like '%lake geneva%'
     and txt not like '%fontana%'
     and txt not like '%williams bay%'
     and txt not like '%delavan%'
     and txt not like '%elkhorn%'
     and txt not like '%lake como%'
     and txt not like '%genoa city%'
     and txt not like '%linn township%'
  then
    new.geo_tier   := 0;
    new.geo_label  := 'Regional';
    if new.status = 'auto_published' then
      new.status      := 'pending';
      new.hold_reason := coalesce(new.hold_reason, 'whitewater_only_not_hyperlocal');
      new.decision_path := coalesce(new.decision_path,'') || '|whitewater_gate';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_whitewater_scope on public.content_queue;
create trigger trg_enforce_whitewater_scope
  before insert or update of title, content, geo_tier, status
  on public.content_queue
  for each row execute function public.enforce_whitewater_scope();

-- ---------------------------------------------------------------------------
-- 4. Same-incident dedupe on insert (best-effort). If a row lands with the
--    same normalized 60-char title as an auto_published item in the last
--    3 days, hold the new one for review instead of publishing.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_incident_dedupe()
returns trigger
language plpgsql
as $$
declare
  norm text := left(lower(regexp_replace(coalesce(new.title,''), '[^a-z0-9 ]', '', 'gi')), 60);
  existing_id uuid;
begin
  if length(norm) < 20 then return new; end if;
  if new.status <> 'auto_published' then return new; end if;

  select id into existing_id
  from public.content_queue
  where id <> new.id
    and status = 'auto_published'
    and publish_date > now() - interval '3 days'
    and left(lower(regexp_replace(coalesce(title,''), '[^a-z0-9 ]', '', 'gi')), 60) = norm
  limit 1;

  if existing_id is not null then
    new.status := 'pending';
    new.hold_reason := coalesce(new.hold_reason, 'duplicate_incident');
    new.decision_path := coalesce(new.decision_path,'') || '|dedupe_gate';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_incident_dedupe on public.content_queue;
create trigger trg_enforce_incident_dedupe
  before insert on public.content_queue
  for each row execute function public.enforce_incident_dedupe();