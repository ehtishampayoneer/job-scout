-- ===========================================================================
-- Job Scout — RUN ALL MIGRATIONS (002 through 007) in one paste.
-- Safe to run on a database that already has some of these. Everything here is
-- idempotent (IF NOT EXISTS / DROP+CREATE POLICY). Paste the whole thing into
-- Supabase -> SQL Editor -> Run. Run db/schema.sql first if this is a fresh DB.
-- ===========================================================================

-- --- 002: profile links -----------------------------------------------------
alter table public.profile add column if not exists links jsonb default '[]'::jsonb;

-- --- 003: contact + education + employment/education tables ------------------
alter table public.profile add column if not exists contact_email  text;
alter table public.profile add column if not exists contact_phone  text;
alter table public.profile add column if not exists education_note text;

create table if not exists public.employment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company text, title text, start_month int, start_year int,
  end_month int, end_year int, is_current boolean default false,
  location text, summary text, sort_order int default 0,
  created_at timestamptz default now()
);
create index if not exists employment_user_idx on public.employment (user_id, sort_order);

create table if not exists public.education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution text, credential text, field text,
  start_year int, end_year int, notes text, sort_order int default 0,
  created_at timestamptz default now()
);
create index if not exists education_user_idx on public.education (user_id, sort_order);

alter table public.employment enable row level security;
alter table public.education  enable row level security;
drop policy if exists employment_owner on public.employment;
create policy employment_owner on public.employment for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists education_owner on public.education;
create policy education_owner on public.education for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- 004: application fields -------------------------------------------------
alter table public.applications add column if not exists subject   text;
alter table public.applications add column if not exists resume_md text;
alter table public.applications add column if not exists to_email  text;
create unique index if not exists applications_user_job_idx on public.applications (user_id, job_id);

-- --- 005: public microsite --------------------------------------------------
alter table public.profile add column if not exists public_token      text;
alter table public.profile add column if not exists public_enabled    boolean default false;
alter table public.profile add column if not exists public_show_email boolean default false;
create unique index if not exists profile_public_token_idx on public.profile (public_token);

-- --- 006: warm person fields ------------------------------------------------
alter table public.warm_targets add column if not exists person_name text;
alter table public.warm_targets add column if not exists person_role text;
alter table public.warm_targets add column if not exists person_url  text;
alter table public.warm_targets add column if not exists channel     text;
alter table public.warm_targets add column if not exists contact     text;
alter table public.warm_targets add column if not exists source_url  text;

-- --- 007: interviews --------------------------------------------------------
create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  job_id uuid references public.jobs (id) on delete set null,
  status text default 'proposed', scheduled_at timestamptz, location text,
  proposed_slots jsonb default '[]'::jsonb, notes text, prep jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists interviews_user_idx on public.interviews (user_id, scheduled_at);
alter table public.interviews enable row level security;
drop policy if exists interviews_owner on public.interviews;
create policy interviews_owner on public.interviews for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 008: raw location on jobs (show the actual country/region)
alter table public.jobs add column if not exists location_raw text;
