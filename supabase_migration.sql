-- Supabase SQL Migration: Challenge Feature
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 0. Drop existing tables if they exist (safe to re-run)
DROP TABLE IF EXISTS challenge_responses CASCADE;
DROP TABLE IF EXISTS challenges CASCADE;

-- 1. Challenges table
CREATE TABLE challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  match_id TEXT NOT NULL,
  match_name TEXT NOT NULL,
  match_date TIMESTAMPTZ,
  questions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Challenge responses table
CREATE TABLE IF NOT EXISTS challenge_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]',
  score INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_id, user_id)
);

-- 3. Enable Row Level Security
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_responses ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for challenges
CREATE POLICY "Anyone can view challenges"
  ON challenges FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create challenges"
  ON challenges FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Creators can delete their own challenges"
  ON challenges FOR DELETE
  USING (auth.uid() = creator_id);

-- 5. RLS Policies for challenge_responses
CREATE POLICY "Anyone can view responses"
  ON challenge_responses FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create responses"
  ON challenge_responses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own responses"
  ON challenge_responses FOR UPDATE
  USING (auth.uid() = user_id);
