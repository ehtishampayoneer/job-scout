# Job Scout + Apply Copilot

A personal AI job-application system. Finds the right senior roles, tailors every
application, and lines them up for you to send with one tap. Built for one user,
architected multi-user-ready.

> **Phase 1 (this build): Foundation.** Auth, the full data model, the free-tier
> AI router, and the conversational onboarding that ingests your CV and builds
> your master profile. Scout, scoring, and the Apply Copilot arrive in later phases.

## The rules this product never breaks
- Never auto-submits an application without your tap.
- Never creates accounts, stores passwords, or solves CAPTCHAs.
- Every application is uniquely tailored. Human, plain prose. No AI filler.
- Honesty over inflation. It never fabricates.

## Stack
Next.js (App Router, JavaScript) · Supabase (Postgres + Auth + RLS) · Vercel ·
free-tier LLMs (Gemini, with Groq/OpenRouter failover) via `lib/ai-router.js`.

## Setup (about 10 minutes)

### 1. Install
```bash
npm install
```

### 2. Create a Supabase project
At https://supabase.com/dashboard create a new project. Then open **SQL Editor →
New query**, paste the whole of [`db/schema.sql`](db/schema.sql), and run it.

### 3. Get a free LLM key
Get a free Gemini key at https://aistudio.google.com/apikey. That one key is
enough for Phase 1. (Groq / OpenRouter keys are optional failovers.)

### 4. Environment
Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  (Supabase → Settings → API)
- `GEMINI_API_KEY`

### 5. Run
```bash
npm run dev
```
Open http://localhost:3000. Create an account, and the onboarding interview
starts. Paste your CV (or click **Load example CV**), answer a handful of
questions, and save. Your master profile lands on `/profile`.

> **Email confirmation:** by default Supabase asks new users to confirm their
> email. For a single-user setup you can turn that off at
> **Supabase → Authentication → Sign In / Providers → Email → Confirm email (off)**
> so you can sign in immediately.

## Deploy to Vercel
Import the repo in Vercel, add the same environment variables in **Project →
Settings → Environment Variables**, and deploy. Set your Vercel URL as `APP_URL`.

## Project structure
```
app/
  page.js                  gate: routes to login / onboarding / profile
  login/                   email + password auth (Supabase)
  onboarding/              the conversational interview UI
  profile/                 master profile view + editor
  api/onboarding/          message (one turn), complete (save), example (seed CV)
  api/profile/             GET + PUT the master profile
lib/
  ai-router.js             multi-provider free-tier LLM failover
  onboarding.js            interview prompt, turn logic, guardrails, example CV
  supabase/                browser / server / admin clients
db/schema.sql              the full section-4 data model + RLS
```
