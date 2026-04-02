import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('challenges')
    .select('id, match_id, is_resolved, questions, created_at')
    .eq('match_id', 'mock-live-match-123')
    .order('created_at', { ascending: false })
    .limit(1);

  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}
run();
