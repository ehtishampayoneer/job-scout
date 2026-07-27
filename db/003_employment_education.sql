-- Migration 003: real work history (with dates), education, and contact fields.
-- Job application forms always ask for these, so they are first-class now.
-- Run this in the Supabase SQL editor. Safe to re-run.

-- Contact + education summary on the master profile
alter table public.profile add column if not exists contact_email   text;
alter table public.profile add column if not exists contact_phone   text;
alter table public.profile add column if not exists education_note  text;

-- Employment history — one row per role, with month/year dates.
create table if not exists public.employment (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  company     text,
  title       text,
  start_month int,                 -- 1-12 (nullable if unknown)
  start_year  int,
  end_month   int,
  end_year    int,
  is_current  boolean default false,
  location    text,
  summary     text,                -- what you built/led there
  sort_order  int default 0,
  created_at  timestamptz default now()
);
create index if not exists employment_user_idx on public.employment (user_id, sort_order);

-- Education — degrees, courses, or self-study entries.
create table if not exists public.education (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  institution text,
  credential  text,                -- e.g. "BSc", "Self-taught", "Bootcamp"
  field       text,                -- e.g. "Computer Science"
  start_year  int,
  end_year    int,
  notes       text,
  sort_order  int default 0,
  created_at  timestamptz default now()
);
create index if not exists education_user_idx on public.education (user_id, sort_order);

-- RLS: a user only ever touches their own rows.
alter table public.employment enable row level security;
alter table public.education  enable row level security;

drop policy if exists employment_owner on public.employment;
create policy employment_owner on public.employment
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists education_owner on public.education;
create policy education_owner on public.education
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
