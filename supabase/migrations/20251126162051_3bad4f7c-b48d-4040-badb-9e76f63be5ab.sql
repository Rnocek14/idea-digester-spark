-- Create distribution_channels table
create table public.distribution_channels (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('website', 'newsletter', 'facebook', 'instagram', 'x')),
  name text not null,
  is_active boolean not null default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Create content_targets table
create table public.content_targets (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_queue(id) on delete cascade,
  channel_id uuid not null references public.distribution_channels(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'posted', 'failed')),
  scheduled_for timestamptz,
  posted_at timestamptz,
  external_post_id text,
  error_message text,
  created_at timestamptz not null default now(),
  unique(content_id, channel_id)
);

-- Enable RLS
alter table public.distribution_channels enable row level security;
alter table public.content_targets enable row level security;

-- RLS policies for distribution_channels
create policy "Admins can view all channels"
  on public.distribution_channels
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage channels"
  on public.distribution_channels
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- RLS policies for content_targets
create policy "Admins can view all targets"
  on public.content_targets
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage targets"
  on public.content_targets
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Insert default distribution channels
insert into public.distribution_channels (type, name, is_active) values
  ('website', 'Lake Geneva Main Site', true),
  ('newsletter', 'Lake Geneva Weekly Newsletter', true),
  ('facebook', 'Lake Geneva FB Page', true),
  ('instagram', 'Lake Geneva IG Account', true),
  ('x', 'Lake Geneva X Account', false);