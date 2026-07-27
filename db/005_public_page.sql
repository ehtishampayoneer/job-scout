-- Migration 005: the public candidate microsite.
-- A shareable, unguessable-token page the candidate publishes on their own terms.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- NOTE: we deliberately DO NOT open anon RLS on these tables. The public page is
-- rendered server-side with the service-role client, which selects only the
-- safe, presentational columns (never salary, raw CV, etc.). RLS stays fully
-- locked, so nothing sensitive is ever reachable through the public API.
alter table public.profile add column if not exists public_token      text;
alter table public.profile add column if not exists public_enabled    boolean default false;
alter table public.profile add column if not exists public_show_email boolean default false;

create unique index if not exists profile_public_token_idx on public.profile (public_token);
