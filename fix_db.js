import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: challenges } = await supabase
    .from('challenges')
    .select('*')
    .eq('is_resolved', false);

  for (let c of challenges) {
    if (c.questions) {
      // Create response for creator if they don't have one
      const { data: resp } = await supabase.from('challenge_responses').select('*').eq('challenge_id', c.id).eq('user_id', c.creator_id);
      if (resp && resp.length === 0) {
        console.log(`Creating response for creator of ${c.id}`);
        const answers = c.questions.map(q => q.answer >= 0 ? q.answer : -1);
        await supabase.from('challenge_responses').insert({
          challenge_id: c.id,
          user_id: c.creator_id,
          answers: answers,
          score: 0
        });
      }

      // Reset answers to -1 for grading
      c.questions.forEach(q => q.answer = -1);
      await supabase.from('challenges').update({ questions: c.questions }).eq('id', c.id);
      console.log('Reset challenge', c.id);
    }
  }
  process.exit(0);
}
run();
