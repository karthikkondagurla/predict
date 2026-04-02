import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const challenge_id = "4da05f86-65f5-480c-9e1f-b192c6016099";
  const creator_id = "af94ae45-0628-48a6-8cb0-ccc7d5e75423";

  const { data, error } = await supabase.from('feed_posts').insert({
    challenge_id,
    creator_id,
    match_id: "ae676d7c-3082-489c-96c5-5620f393c900",
    match_name: "test",
    content: "{}"
  }).select();

  console.log("Data:", data);
  console.log("Error:", JSON.stringify(error, null, 2));
  process.exit(0);
}
run();
