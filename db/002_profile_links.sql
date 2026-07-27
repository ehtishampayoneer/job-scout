-- Migration 002: profile-level links (LinkedIn, GitHub, portfolio).
-- Run this in the Supabase SQL editor if you created your DB before this column
-- existed. Safe to re-run.
alter table public.profile
  add column if not exists links jsonb default '[]'::jsonb;
