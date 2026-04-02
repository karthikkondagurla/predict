import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const challenge_id = "4da05f86-65f5-480c-9e1f-b192c6016099";

  const { data, error } = await supabase.from('feed_posts').select('*').eq('challenge_id', challenge_id);
  console.log("Feed posts for challenge:", data?.length);
  process.exit(0);
}
run();
