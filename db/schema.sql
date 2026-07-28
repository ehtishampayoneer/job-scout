-- ===========================================================================
-- Job Scout + Apply Copilot — full data model (spec section 4)
--
-- HOW TO RUN: open your Supabase project -> SQL Editor -> New query ->
-- paste this whole file -> Run. Safe to re-run (idempotent-ish: uses
-- IF NOT EXISTS and drops/recreates policies).
--
-- Design notes:
--  * Single-user product, but built multi-user-ready: every row is owned by a
--    user (user_id -> auth.users) and Row Level Security ensures a user only
--    ever sees their own rows.
--  * Phase 1 only writes `profile` and `projects`. The rest of the tables are
--    created now so the schema is complete (jobs, scores, applications, emails,
--    warm_targets, learnings are used in Phases 2-5).
-- ===========================================================================

-- Needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. profile — the master profile (ONE row per user). Source of truth.
-- ---------------------------------------------------------------------------
create table if not exists public.profile (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  full_name            text,
  headline             text,          -- e.g. "CTO / Head of AI / Founding Engineer"
  location             text,          -- where the user is based
  contact_email        text,          -- contact email for applications
  contact_phone        text,
  education_note       text,          -- e.g. "No formal CS degree; self-taught over 16 years"
  summary              text,          -- narrative professional summary
  salary_floor_usd     integer,       -- monthly floor; nothing below this passes the filter
  salary_notes         text,          -- context: "$2.5-8k first role; $10k+ after verified remote history"
  target_roles         text[] default '{}',      -- ["CTO","Head of AI","Founding Engineer", ...]
  acceptable_locations text[] default '{}',      -- ["remote-worldwide","Germany","UK", ...]
  visa_status          text,          -- "USA B1/B2 + Canada visitor; open to relocation"
  tone_notes           text,          -- how the user wants outreach to sound
  strengths            text[] default '{}',
  weaknesses           text[] default '{}',
  links                jsonb  default '[]'::jsonb,  -- [{label,url}] LinkedIn/GitHub/portfolio
  raw_cv               text,          -- the pasted CV text, kept for re-generation
  public_token         text unique,   -- unguessable slug for the public microsite
  public_enabled       boolean default false,
  public_show_email    boolean default false,
  onboarding_complete  boolean default false,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 2. projects — shipped products, with the story/decisions/stack per row.
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  one_liner   text,                       -- short pitch
  description text,                        -- what it does
  story       text,                        -- what broke, what they decided, what they'd redo
  stack       text[] default '{}',         -- ["Next.js","Supabase","WebXR", ...]
  links       jsonb  default '[]'::jsonb,  -- [{label,url}, ...]
  sort_order  integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists projects_user_idx on public.projects (user_id, sort_order);

-- ---------------------------------------------------------------------------
-- 2b. employment — real work history, one row per role, with month/year dates.
-- ---------------------------------------------------------------------------
create table if not exists public.employment (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  company     text,
  title       text,
  start_month int,
  start_year  int,
  end_month   int,
  end_year    int,
  is_current  boolean default false,
  location    text,
  summary     text,
  sort_order  int default 0,
  created_at  timestamptz default now()
);
create index if not exists employment_user_idx on public.employment (user_id, sort_order);

-- ---------------------------------------------------------------------------
-- 2c. education — degrees, courses, or self-study entries.
-- ---------------------------------------------------------------------------
create table if not exists public.education (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  institution text,
  credential  text,
  field       text,
  start_year  int,
  end_year    int,
  notes       text,
  sort_order  int default 0,
  created_at  timestamptz default now()
);
create index if not exists education_user_idx on public.education (user_id, sort_order);

-- ---------------------------------------------------------------------------
-- 3. jobs — every scraped posting (Phase 2+).
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  source        text,                       -- remoteok | wwr | greenhouse | ashby | hn | ...
  url           text,
  company       text,
  title         text,
  raw_text      text,
  salary_range  text,
  location_type text,                       -- remote-worldwide | visa | onsite | ...
  location_raw  text,                       -- the raw location string (e.g. "Remote, US")
  apply_channel text,                       -- email-apply | direct-form | login-wall
  first_seen    timestamptz default now(),  -- being early matters
  created_at    timestamptz default now(),
  unique (user_id, source, url)
);
create index if not exists jobs_user_seen_idx on public.jobs (user_id, first_seen desc);

-- ---------------------------------------------------------------------------
-- 4. job_scores — fit + trust scoring (Phase 2+).
-- ---------------------------------------------------------------------------
create table if not exists public.job_scores (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  fit_score   integer,                      -- 0-100
  why_it_fits text,
  trust_score integer,                      -- 0-100
  scam_flags  jsonb default '[]'::jsonb,
  status      text default 'new',           -- new | shortlisted | dismissed
  created_at  timestamptz default now(),
  unique (job_id)
);
create index if not exists job_scores_user_idx on public.job_scores (user_id, fit_score desc);

-- ---------------------------------------------------------------------------
-- 5. applications — the prepared/sent application per job (Phase 3+).
-- ---------------------------------------------------------------------------
create table if not exists public.applications (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid references public.jobs (id) on delete set null,
  user_id             uuid not null references auth.users (id) on delete cascade,
  tailored_resume_ref text,                 -- storage ref / generated variant id
  resume_md           text,                 -- tailored one-page resume (markdown)
  note_text           text,                 -- the human outreach note
  subject             text,                 -- email subject line
  to_email            text,                 -- recipient for email-apply jobs
  answers_json        jsonb default '{}'::jsonb,  -- pre-filled form answers
  salary_ask          text,                 -- calibrated per-company ask
  status              text default 'draft', -- draft | sent | responded | interviewing | rejected | offer
  sent_at             timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (user_id, job_id)
);
create index if not exists applications_user_idx on public.applications (user_id, status);

-- ---------------------------------------------------------------------------
-- 6. emails — two-way inbox: outbound applications + inbound replies (Phase 4+).
-- ---------------------------------------------------------------------------
create table if not exists public.emails (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  direction      text not null,             -- in | out
  from_addr      text,
  to_addr        text,
  subject        text,
  body           text,
  ai_tag         text,                       -- interview | rejection | question | scam
  received_at    timestamptz default now(),
  created_at     timestamptz default now()
);
create index if not exists emails_user_idx on public.emails (user_id, received_at desc);

-- ---------------------------------------------------------------------------
-- 7. warm_targets — people/companies to reach, with a draft intro (Phase 5).
-- ---------------------------------------------------------------------------
create table if not exists public.warm_targets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  kind          text,                        -- person | company
  name          text,                        -- company name
  person_name   text,
  person_role   text,                        -- Engineer | Founder | ...
  person_url    text,                        -- their public profile
  channel       text,                        -- github | linkedin | email | site
  contact       text,                        -- public email/handle if found
  source_url    text,
  why           text,                        -- why reach this person/company
  draft_message text,
  status        text default 'new',          -- new | reached | replied | dismissed
  created_at    timestamptz default now()
);
create index if not exists warm_targets_user_idx on public.warm_targets (user_id, status);

-- ---------------------------------------------------------------------------
-- 8. learnings — weekly notes on what's converting + scorer adjustments (Phase 5).
-- ---------------------------------------------------------------------------
create table if not exists public.learnings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  week_of     date,
  notes       text,
  adjustments jsonb default '{}'::jsonb,
  created_at  timestamptz default now()
);
create index if not exists learnings_user_idx on public.learnings (user_id, week_of desc);

-- ---------------------------------------------------------------------------
-- 9. interviews — scheduled interviews + prep brief (Phase 4 / Interview Hub).
-- ---------------------------------------------------------------------------
create table if not exists public.interviews (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  job_id         uuid references public.jobs (id) on delete set null,
  status         text default 'proposed',
  scheduled_at   timestamptz,
  location       text,
  proposed_slots jsonb default '[]'::jsonb,
  notes          text,
  prep           jsonb,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists interviews_user_idx on public.interviews (user_id, scheduled_at);

-- ===========================================================================
-- ROW LEVEL SECURITY — every table: a user can only touch their own rows.
-- ===========================================================================
alter table public.profile      enable row level security;
alter table public.projects     enable row level security;
alter table public.employment   enable row level security;
alter table public.education    enable row level security;
alter table public.jobs         enable row level security;
alter table public.job_scores   enable row level security;
alter table public.applications enable row level security;
alter table public.emails       enable row level security;
alter table public.warm_targets enable row level security;
alter table public.learnings    enable row level security;
alter table public.interviews   enable row level security;

-- Helper: create a full CRUD policy scoped to auth.uid() = user_id.
do $$
declare
  t text;
  tables text[] := array[
    'profile','projects','employment','education','jobs','job_scores',
    'applications','emails','warm_targets','learnings','interviews'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I;', t || '_owner', t);
    execute format(
      'create policy %I on public.%I
         for all
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id);',
      t || '_owner', t
    );
  end loop;
end $$;

-- ===========================================================================
-- updated_at auto-touch
-- ===========================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare
  t text;
  tables text[] := array['profile','projects','applications','interviews'];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists %I on public.%I;', t || '_touch', t);
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.touch_updated_at();',
      t || '_touch', t
    );
  end loop;
end $$;
