-- Supabase SQL Migration: AI Umpire & Feed Posts
-- Run this in your Supabase SQL Editor

-- 1. Add `is_resolved` column to challenges table
ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT false;

-- 2. Create feed_posts table
CREATE TABLE IF NOT EXISTS feed_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  match_id TEXT NOT NULL,
  match_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_id) -- Only one result post per challenge
);

-- 3. Enable RLS
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for feed_posts
-- Anyone can view posts
CREATE POLICY "Anyone can view feed posts"
  ON feed_posts FOR SELECT
  USING (true);

-- Only authenticated users (or service role) can insert
CREATE POLICY "Authenticated users can insert feed posts"
  ON feed_posts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 5. Add UPDATE policies for AI Umpire grading
CREATE POLICY "Allow AI Umpire to update challenge resolution"
  ON challenges FOR UPDATE
  USING (true);

CREATE POLICY "Allow AI Umpire to update response scores"
  ON challenge_responses FOR UPDATE
  USING (true);

