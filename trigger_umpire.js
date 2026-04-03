import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const geminiKeys = process.env.GEMINI_KEYS
  ? process.env.GEMINI_KEYS.split(',').map(k => k.trim()).filter(Boolean)
  : [process.env.GEMINI_API_KEY].filter(Boolean);

const genAI = new GoogleGenerativeAI(geminiKeys[0] || '');
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const cricApiKeys = process.env.CRICAPI_KEYS ? process.env.CRICAPI_KEYS.split(',') : [];

async function getMatchScorecard(matchId) {
  const cachedScorecard = await redis.get(`scorecard:${matchId}`);
  if (cachedScorecard) return JSON.parse(cachedScorecard);

  if (cricApiKeys.length > 0) {
    console.log(`📡 Fetching from CricAPI for match ${matchId}... key: ${cricApiKeys[0]}`);
    const res = await fetch(`https://api.cricapi.com/v1/match_scorecard?apikey=${cricApiKeys[0]}&id=${matchId}`);
    const data = await res.json();
    if (data.status === 'success' && data.data) {
        await redis.set(`scorecard:${matchId}`, JSON.stringify(data.data), 'EX', 600);
        return data.data;
    }
  }
  return null;
}

async function runManualUmpire() {
  console.log('🤖 Running Manual AI Umpire Trigger...');

  // Fetch only unresolved challenges
  const { data: challenges, error: fetchErr } = await supabase
    .from('challenges')
    .select('*')
    .eq('is_resolved', false);

  if (!challenges || challenges.length === 0) {
    console.log('📭 No unresolved challenges found');
    process.exit(0);
  }

  console.log(`🔍 Found ${challenges.length} unresolved challenge(s) to evaluate`);

  for (const challenge of challenges) {
    console.log(`🏏 Evaluating Challenge ${challenge.id} (Match: ${challenge.match_id})...`);

    const scoreData = await getMatchScorecard(challenge.match_id);
    if (!scoreData) {
      console.log(`⚠️ No scorecard available for match ${challenge.match_id}, skipping.`);
      continue;
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const questionsToGrade = challenge.questions.map((q, i) => ({ ...q, originalIndex: i }))
                                                .filter(q => q.answer === -1);
    
    if (questionsToGrade.length === 0) {
       console.log(`⏭️ No pending questions for challenge ${challenge.id}, skipping.`);
       continue;
    }

    const prompt = `
You are an expert incremental cricket AI Umpire. Analyze the provided LIVE match scorecard and cautiously evaluate ONLY the specific pending questions.

LIVE MATCH SCORECARD:
${JSON.stringify(scoreData)}

PENDING QUESTIONS TO GRADE:
${questionsToGrade.map(q => `Q_IDX_${q.originalIndex}: ${q.question} (Options: ${q.options.map((o, j) => `${j}:${o}`).join(', ')})`).join('\n')}

STRICT RULES (NO HALLUCINATION):
1. BE EXTREMELY STRICT ABOUT EVENTS NOT CONCLUDING YET.
2. If matchEnded is true, you can grade match winner questions.
3. If there is absolute, definitive evidence in the scorecard that the specific event for the question has concluded permanently, then return "RESOLVED" and provide the correct "answer_index" (0-based) and "result_text". 
4. Be smart about typos or shortened names in the options (e.g., "lsg" matches "Lucknow Super Giants").

Format your exact JSON response as an array of objects corresponding to the questions asked, respecting their original order:
[
  { "status": "RESOLVED", "answer_index": 0, "result_text": "Lucknow Super Giants won the match" }
]
    `;

    console.log(`🤖 Sending ${questionsToGrade.length} questions to Gemini...`);
    const result = await model.generateContent(prompt);
    
    let geminiResults = [];
    try {
       geminiResults = JSON.parse(result.response.text());
    } catch (e) {
       console.error("❌ Failed to parse Gemini JSON:", e);
       continue;
    }

    let hasNewResolvedQuestions = false;
    const newlyResolvedQuestionIndexes = [];

    geminiResults.forEach((res, indexInList) => {
       const origIndex = questionsToGrade[indexInList].originalIndex;
       if (res.status === "RESOLVED") {
          challenge.questions[origIndex].answer = res.answer_index;
          hasNewResolvedQuestions = true;
          newlyResolvedQuestionIndexes.push({ origIndex, res });
       }
    });

    if (!hasNewResolvedQuestions) continue;

    const { data: rawResponses } = await supabase.from('challenge_responses').select('*').eq('challenge_id', challenge.id);
    let responses = rawResponses || [];

    if (responses.length > 0) {
      const userIds = [...new Set(responses.map(r => r.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url, email').in('id', userIds);
      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });
      responses = responses.map(r => ({ ...r, profiles: profileMap[r.user_id] || null }));
    }

    for (const { origIndex, res: aiRes } of newlyResolvedQuestionIndexes) {
       const q = challenge.questions[origIndex];
       const officialAnsText = aiRes.result_text || (q.answer !== null ? q.options[q.answer] : "None of the options");
       
       const participants = responses.map(resp => {
         const name = resp.profiles?.full_name || resp.profiles?.email?.split('@')[0] || 'Unknown User';
         const isCorrect = q.answer !== null && resp.answers[origIndex] === q.answer;
         return {
            id: resp.user_id,
            n: name,
            img: resp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`,
            pts: isCorrect ? "+20" : "0", 
            ok: isCorrect,
            ans: q.options[resp.answers[origIndex]] || "Skipped/Pending" 
         };
       });

       const postData = { type: 'q_result', q: q.question, off: officialAnsText, total_q: challenge.questions.length, parts: participants };

       await supabase.from('feed_posts').insert({
         challenge_id: challenge.id,
         creator_id: challenge.creator_id,
         match_id: challenge.match_id,
         match_name: challenge.match_name,
         content: JSON.stringify(postData)
       });
       console.log(`✅ Posted incremental result to feed for question ${origIndex}`);
    }

    const isCompletelyResolved = challenge.questions.every(q => q.answer !== -1);
    if (isCompletelyResolved) {
       for (const resp of responses) {
          let score = 0;
          resp.answers.forEach((ans, i) => { if (ans !== -1 && ans === challenge.questions[i].answer) score += 20; });
          await supabase.from('challenge_responses').update({ score }).eq('id', resp.id);
          resp.score = score;
       }

       const leaderboardParticipants = responses.map(resp => {
          const name = resp.profiles?.full_name || resp.profiles?.email?.split('@')[0] || 'Unknown User';
          return { id: resp.user_id, n: name, img: resp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`, score: resp.score };
       }).sort((a, b) => b.score - a.score);

       leaderboardParticipants.forEach((p, idx) => { p.medal = p.score === 0 ? '💔' : (idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : '🏅'))); });

       const leaderboardData = { type: 'leaderboard', match_name: challenge.match_name, short_id: challenge.short_id, total_q: challenge.questions.length, parts: leaderboardParticipants };

       await supabase.from('feed_posts').insert({
          challenge_id: challenge.id,
          creator_id: challenge.creator_id,
          match_id: challenge.match_id,
          match_name: challenge.match_name,
          content: JSON.stringify(leaderboardData)
       });
       console.log(`✅ Posted final leaderboard to feed`);
    }

    await supabase.from('challenges').update({ is_resolved: isCompletelyResolved, questions: challenge.questions }).eq('id', challenge.id);
    console.log(`✅ Saved state to Supabase!`);
  }
  process.exit(0);
}

runManualUmpire();
