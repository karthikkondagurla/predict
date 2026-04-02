import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('feed_posts').select('*').order('created_at', { ascending: false });
  console.log("Total Feed posts:", data?.length);
  if (data?.length) {
    console.log(JSON.stringify(data.slice(0, 3), null, 2));
  }
  process.exit(0);
}
run();
