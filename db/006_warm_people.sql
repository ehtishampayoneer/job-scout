-- Migration 006: person-level warm targets (right-person outreach).
-- Warm targets can now name a specific person (a founder or an engineer who
-- could refer you) and the best channel to reach them, not just a company.
-- Run in the Supabase SQL editor. Safe to re-run.
alter table public.warm_targets add column if not exists person_name text;
alter table public.warm_targets add column if not exists person_role text;   -- e.g. "Engineer", "Founder"
alter table public.warm_targets add column if not exists person_url  text;   -- their public profile (GitHub, site)
alter table public.warm_targets add column if not exists channel     text;   -- github | linkedin | email | site
alter table public.warm_targets add column if not exists contact     text;   -- public email/handle if found
alter table public.warm_targets add column if not exists source_url  text;   -- where we found them
