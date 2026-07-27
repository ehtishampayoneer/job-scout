-- Migration 004: fields the Apply Copilot writes per application.
-- Run in the Supabase SQL editor. Safe to re-run.
alter table public.applications add column if not exists subject    text;  -- email subject line
alter table public.applications add column if not exists resume_md  text;  -- tailored one-page resume (markdown)
alter table public.applications add column if not exists to_email   text;  -- recipient for email-apply jobs

-- One application per job per user (lets the Copilot upsert drafts safely).
create unique index if not exists applications_user_job_idx on public.applications (user_id, job_id);
