import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // 1. Get users
  const { data: users } = await supabase.from('profiles').select('*').limit(2);
  if (users.length < 2) {
     console.log("Need at least 2 users.");
     process.exit(0);
  }
  
  const u1 = users[0].id;
  const u2 = users[1].id;
  
  console.log(`Creating friendship between ${users[0].email} and ${users[1].email}`);
  
  const { error } = await supabase.from('friendships').insert({
    requester_id: u1,
    receiver_id: u2,
    status: 'accepted'
  });
  
  if (error) console.error(error);
  else console.log("Success!");
  
  process.exit(0);
}
run();
