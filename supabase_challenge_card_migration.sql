-- Challenge Card System: Add short_id column
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Add short_id column to challenges table
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS short_id TEXT;

-- 2. Ensure is_resolved column exists
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT FALSE;

-- 3. Add delete policy for challenge_responses (needed for cleanup)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow delete for challenge_responses'
  ) THEN
    CREATE POLICY "Allow delete for challenge_responses" ON challenge_responses FOR DELETE USING (true);
  END IF;
END $$;
