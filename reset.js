import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function reset() {
  console.log('Clearing old feed posts...');
  await supabase.from('feed_posts').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('Un-resolving all challenges...');
  await supabase.from('challenges').update({ is_resolved: false }).neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log('✅ Done! The AI Umpire will now cleanly evaluate your challenges using the new UI layout on its next 5-minute sweep.');
}

reset();
