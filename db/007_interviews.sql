-- Migration 007: the Interview Hub.
-- When a company invites you to interview, it becomes a scheduled event with a
-- prep brief grounded in the exact application we sent them.
-- Run in the Supabase SQL editor. Safe to re-run.
create table if not exists public.interviews (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  job_id         uuid references public.jobs (id) on delete set null,
  status         text default 'proposed',    -- proposed | scheduled | completed | cancelled
  scheduled_at   timestamptz,                 -- confirmed date/time
  location       text,                        -- video link / phone / address
  proposed_slots jsonb default '[]'::jsonb,   -- availability offered to the company
  notes          text,
  prep           jsonb,                        -- generated prep dossier (cached)
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists interviews_user_idx on public.interviews (user_id, scheduled_at);

alter table public.interviews enable row level security;
drop policy if exists interviews_owner on public.interviews;
create policy interviews_owner on public.interviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists interviews_touch on public.interviews;
create trigger interviews_touch before update on public.interviews
  for each row execute function public.touch_updated_at();
