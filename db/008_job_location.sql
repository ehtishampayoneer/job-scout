-- Migration 008: store the raw location string on jobs so the UI can show the
-- actual country/region (many "remote" roles are secretly US-only, which matters
-- a lot for a candidate applying from outside the US).
-- Run in the Supabase SQL editor. Safe to re-run.
alter table public.jobs add column if not exists location_raw text;
