# WhataCampaign

WhatsApp campaign planning MVP built with Next.js, Supabase, PapaParse, and Gemini message screening.

This app plans safe, rate-aware sending batches. It does not send WhatsApp messages.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env.local` and fill the values.

The UI works without AI quota by using a local message-risk fallback. Add `GEMINI_API_KEY` and `GEMINI_MODEL` to use the real `/api/ai-screen` integration.

## Supabase

Create a Supabase project, then run `supabase/schema.sql` in the SQL editor. It creates:

- `users`
- `campaigns`
- `contacts`
- `messages`
- RLS policies scoped by `auth.uid()`
- a trigger that inserts a `users` row when a Supabase Auth user signs up

The app saves campaign history locally and attempts Supabase cloud sync when anonymous auth is available for the configured project.

## MVP Flow

1. Set campaign dates, daily limit, and cooldown days.
2. Upload a contacts CSV with a `phone` column and optional `name` column.
3. Screen the campaign message.
4. Generate daily shuffled batches.
5. Download one CSV per scheduled day.
