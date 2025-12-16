-- Fix search_path for normalize_url function
create or replace function public.normalize_url(input text)
returns text
language plpgsql
set search_path = public
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