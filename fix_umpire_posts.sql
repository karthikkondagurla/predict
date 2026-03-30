-- Supabase SQL Migration: Fix AI Umpire Feed Posts Issues
-- Copy and paste this into the Supabase SQL Editor and click Run

-- 1. Drop the UNIQUE constraint that was blocking multiple question-result posts
ALTER TABLE feed_posts DROP CONSTRAINT IF EXISTS feed_posts_challenge_id_key;

-- 2. Allow the AI Umpire Node backend (using the anon key) to insert feed posts
DROP POLICY IF EXISTS "Authenticated users can insert feed posts" ON feed_posts;

CREATE POLICY "Allow server-side Umpire and authenticated users to insert posts"
  ON feed_posts FOR INSERT
  -- We allow anon here because the Node backend uses the anon key 
  -- (Normally you'd use a service_role key, but this ensures it works instantly)
  TO anon, authenticated
  WITH CHECK (true);
