# Cloudflare Migration Plan

## Executive Summary
This document outlines the step-by-step plan to migrate the backend API from Vercel (using Express and `ioredis`) to Cloudflare Workers. Cloudflare provides excellent performance and generous limits (100,000 requests/day free), making it a perfect fit for our dynamic cron-based architecture.

## Architecture Alignment

The system will rely on Cloudflare Scheduled Events (Cron Triggers) with "Smart Logic" to dynamically act based on match states, minimizing CricAPI and Gemini API calls:

1. **The Daily Setup (Runs at Midnight `0 0 * * *`)**
   - Fetches the series schedule and identifies today's matches.
   - Initializes Match State objects in Redis for today's matches (e.g., `toss_declared: false`, `match_started: false`, `match_ended: false`).

2. **The Smart Match Tracker (Runs every 2 mins `*/2 * * * *`)**
   - Combines Toss and Scorecard tracking to avoid overlapping CricAPI calls.
   - **Pre-match (Toss Tracking):** If within 30 mins of the start time and `toss_declared` is false, it fetches CricAPI to check for the toss. Once found, marks `toss_declared: true`.
   - **Live Match (Scorecard Tracking):** If `match_started` is true and `match_ended` is false, it dynamically limits CricAPI fetching to every 5 minutes (using timestamp checks). Updates the scorecard in Redis.
   - Once CricAPI reports the match is over, sets `match_ended: true` so fetching stops entirely.

3. **The AI Umpire (Runs every 2 mins `*/2 * * * *`)**
   - Evaluates unresolved challenges for active matches.
   - Uses Gemini 2.5 Flash to grade all questions in a challenge at once (~2 seconds).
   - Once all questions in a challenge are resolved, bulk updates Supabase scores, posts results, and generates the leaderboard.

## Key Optimizations for Cloudflare

1. **Framework Switch:** Replace Express with `Hono`, a lightweight, ultra-fast web framework built specifically for Cloudflare Workers.
2. **Redis Protocol Swap:** Replace `ioredis` (TCP) with `@upstash/redis` (HTTP REST). Upstash works natively with Cloudflare Workers without requiring complex TCP socket polyfills.
3. **Database Bulk Updates:** To avoid Cloudflare's 30-second execution limit for cron jobs, sequential Supabase updates will be replaced with `Promise.all()` for simultaneous execution. This drops processing time from ~10 seconds down to ~1 second.
4. **State Isolation:** Ensure match tracking logic operates independently per `match_id` so double-header days (two matches overlapping) process correctly without terminating each other.

## Step-by-Step Execution Plan

### Step 1: Install Dependencies
- Install Cloudflare's CLI: `npm install -D wrangler`
- Install Hono: `npm install hono`
- Install Upstash Redis: `npm install @upstash/redis`

### Step 2: Rewrite the Backend (`src/worker.js`)
- Translate the Express routes to Hono routes.
- Implement the `scheduled` event handler for Cloudflare Cron Triggers.
- Swap `ioredis` syntax for `@upstash/redis` syntax.
- Implement the intelligent API rotation (CricAPI and Gemini) as currently designed.
- Implement the optimized `Promise.all()` batching for Supabase updates.

### Step 3: Configure Cloudflare (`wrangler.toml`)
- Set up the environment variables binding.
- Define the cron triggers:
  ```toml
  [triggers]
  crons = ["0 0 * * *", "*/2 * * * *"]
  ```

### Step 4: Local Testing
- Use `wrangler dev` to spin up a local instance.
- Test endpoints and mock cron job executions to ensure Redis updates and AI grading operate flawlessly.

### Step 5: Deployment
- Run `npx wrangler deploy` to push the worker live.
- Update frontend environment variables to point to the new Cloudflare Worker URL.
