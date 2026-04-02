import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('challenges')
    .select('*');

  console.log("Total challenges:", data.length);
  const unresolved = data.filter(c => !c.is_resolved);
  console.log("Unresolved challenges:", unresolved.length);
  console.log(JSON.stringify(unresolved, null, 2));
  process.exit(0);
}
run();
