-- Create activity_log table for tracking user and system events
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  
  -- who did it
  user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'user' check (actor_type in ('user', 'system')),

  -- what it was about
  entity_type text not null check (
    entity_type in ('content', 'source', 'sponsor', 'system')
  ),
  entity_id uuid, -- nullable for pure system events

  -- what happened
  action text not null,              -- e.g. 'created', 'updated', 'approved', 'rejected', 'published', 'status_changed'
  message text,                      -- readable string for UI
  details jsonb default '{}'::jsonb, -- extra context

  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.activity_log enable row level security;

-- Admins can view all activity
create policy "Admins can view all activity"
  on public.activity_log
  for select
  using (has_role(auth.uid(), 'admin'));

-- Admins can insert activity
create policy "Admins can insert activity"
  on public.activity_log
  for insert
  with check (has_role(auth.uid(), 'admin'));

-- Create index for better query performance
create index idx_activity_log_created_at on public.activity_log(created_at desc);
create index idx_activity_log_entity on public.activity_log(entity_type, entity_id);