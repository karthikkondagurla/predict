import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Redis from 'ioredis';
import cron from 'node-cron';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from the root .env file
dotenv.config({ path: '.env' });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const CACHE_TTL_SECONDS = 3600; // Cache for 1 hour

// Initialize Supabase & Gemini (Server-side)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Initialize Redis client with retry config
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
  retryStrategy: (times) => {
  const delay = Math.min(times * 50, 2000);
  return delay;
},
  reconnectOnError: (err) => {
    const targetErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'];
    return targetErrors.some(e => err.message.includes(e));
  }
});

redis.on('connect', () => {
  console.log('✅ Connected to Redis successfully');
});
redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});

// --- CRICAPI CONFIG ---
const API_KEY = process.env.VITE_CRICAPI_KEY;
const BASE_URL = 'https://api.cricapi.com/v1';
const IPL_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f";

// --- 1. FETCH & CACHE LIVE MATCHES & SCORECARDS (Runs every 30 mins) ---
async function fetchAndCacheMatches() {
  if (!process.env.VITE_CRICAPI_KEY) {
    console.log('⚠️ No CricAPI Key found in .env. Skipping fetch.');
    return;
  }

  console.log('📡 Fetching live matches from CricAPI...');
  try {
    const response = await fetch(`${BASE_URL}/series_info?apikey=${API_KEY}&id=${IPL_SERIES_ID}`);
    const data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.reason || "Failed to fetch matches");
    }

    const rawMatches = data.data?.matchList || [];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Filter matches from today and yesterday
    const filteredMatches = rawMatches.filter(match => {
      return match.dateTimeGMT && (match.dateTimeGMT.startsWith(todayStr) || match.dateTimeGMT.startsWith(yesterdayStr));
    });

    // Store in Redis with 1-hour expiry
    if (filteredMatches.length > 0) {
      await redis.set('live_matches', JSON.stringify(filteredMatches));
      console.log(`💾 Cached ${filteredMatches.length} matches to Redis`);

      // Also fetch and cache scorecards for these matches
      for (const match of filteredMatches) {
        await fetchAndCacheScorecard(match.id);
      }
    } else {
      console.log('⚠️ No matches found for today/yesterday.');
    }

  } catch (error) {
    console.error('❌ Error fetching matches:', error);
  }
}

async function fetchAndCacheScorecard(matchId) {
  if (!process.env.VITE_CRICAPI_KEY) return;
  
  try {
    const scoreRes = await fetch(`${BASE_URL}/match_scorecard?apikey=${API_KEY}&id=${matchId}`);
    const scoreData = await scoreRes.json();
    
    if (scoreData.status === "success" && scoreData.data) {
      // Cache it for 30 minutes (TTL matches the fetch interval)
      await redis.set(`scorecard:${matchId}`, JSON.stringify(scoreData.data), 'EX', 1800);
      console.log(`💾 Cached scorecard for ${matchId}`);
    }
  } catch (e) {
    console.error(`Failed to fetch/cache scorecard for ${matchId}`, e);
  }
}

// Run every 30 minutes
cron.schedule('*/30 * * * *', fetchAndCacheMatches);

// Run immediately on boot to populate cache
fetchAndCacheMatches();

// --- 2. API ROUTE: GET LIVE MATCHES ---
app.get('/api/matches', async (req, res) => {
  try {
    // Only serve from Redis (populated by cron job every 30 mins)
    const cachedMatches = await redis.get('live_matches');
    
    if (cachedMatches) {
      console.log('📦 Serving matches from Redis Cache');
      return res.json({ status: 'success', data: JSON.parse(cachedMatches), source: 'cache' });
    }

    console.log('⚠️ No matches in Redis (waiting for cron job)');
    return res.status(200).json({ status: 'success', data: [], source: 'empty' });

  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ status: 'error', reason: error.message });
  }
});

// --- 3. HELPER: FETCH SCORECARD ---
async function getMatchScorecard(matchId) {
  // 1. Check Redis only
  const cachedScorecard = await redis.get(`scorecard:${matchId}`);
  if (cachedScorecard) {
    return JSON.parse(cachedScorecard);
  }

  console.log(`⚠️ No scorecard found in Redis for ${matchId}. Waiting for cron job to populate cache.`);
  return null;
}

// --- 4. INCREMENTAL AI UMPIRE CRON JOB ---
async function runAIUmpire() {
  console.log('🤖 Running Incremental AI Umpire Cron Job...');
  if (!process.env.GEMINI_API_KEY) {
    console.log('⚠️ No GEMINI_API_KEY found in .env. Skipping AI Umpire.');
    return;
  }

  try {
    // 1. Fetch unresolved challenges
    const { data: challenges, error: fetchErr } = await supabase
      .from('challenges')
      .select('*')
      .eq('is_resolved', false);

    if (fetchErr || !challenges || challenges.length === 0) {
      return;
    }

    for (const challenge of challenges) {
      console.log(`🏏 Live Match ${challenge.match_name} detected! Evaluating pending questions for Challenge ${challenge.id}...`);

      // Fetch Live Scorecard (from Redis or API)
      const scoreData = await getMatchScorecard(challenge.match_id);
      
      if (!scoreData) {
        console.log(`⚠️ No live scorecard available for match ${challenge.match_id}, skipping.`);
        continue;
      }

      // 3. Strict Prompting to Gemini 2.5 Flash
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });

      // Filter only questions that haven't been resolved yet (answer === -1)
      const questionsToGrade = challenge.questions.map((q, i) => ({ ...q, originalIndex: i }))
                                                  .filter(q => q.answer === -1);

      if (questionsToGrade.length === 0) {
         // Should realistically never happen since is_resolved=false
         continue; 
      }

      const prompt = `
You are an expert incremental cricket AI Umpire. Analyze the provided LIVE match scorecard and cautiously evaluate ONLY the specific pending questions.

LIVE MATCH SCORECARD:
${JSON.stringify(scoreData)}

PENDING QUESTIONS TO GRADE:
${questionsToGrade.map(q => `Q_IDX_${q.originalIndex}: ${q.question} (Options: ${q.options.map((o, j) => `${j}:${o}`).join(', ')})`).join('\n')}

STRICT RULES (NO HALLUCINATION):
1. The match is currently LIVE (matchEnded: false). 
2. BE EXTREMELY STRICT ABOUT EVENTS NOT CONCLUDING YET. Never assume or project future outcomes.
3. If checking a player's final score (e.g. ">50"), check the "dismissal-text" or "out" status. If they are "not out", the event has not concluded. Even if they currently have 51 runs ("not out"), return "UNRESOLVED" because their final score might be >80 later. You can only grade a batsman's score if they are definitively "out" (dismissed), or if the innings is completely over.
4. If a question is about who wins the match/Man of the Match, and matchEnded is false, return "UNRESOLVED".
5. If there is absolute, definitive evidence in the scorecard that the specific event for the question has concluded permanently, then return "RESOLVED" and provide the correct "answer_index" (0-based) and "result_text". 
6. When "RESOLVED", if the true answer is NOT in the options, set "answer_index" to null.
7. Be smart about typos or shortened names in the options (e.g., "Virat Kohli" matches "Virat").

Format your exact JSON response as an array of objects corresponding to the questions asked, respecting their original order:
[
  { "status": "RESOLVED", "answer_index": 0, "result_text": "Virat Kohli was dismissed lbw for 35 runs" },
  { "status": "UNRESOLVED", "answer_index": null, "result_text": "Faf du Plessis is still batting (not out)" }
]
      `;

      const result = await model.generateContent(prompt);
      let geminiResults = [];
      try {
         geminiResults = JSON.parse(result.response.text());
      } catch (e) {
         console.error("Failed to parse Gemini JSON:", e);
         continue;
      }

      let hasNewResolvedQuestions = false;
      const newlyResolvedQuestionIndexes = [];

      // Apply the AI's grading back to our challenge object
      geminiResults.forEach((res, indexInList) => {
         const origIndex = questionsToGrade[indexInList].originalIndex;
         if (res.status === "RESOLVED") {
            challenge.questions[origIndex].answer = res.answer_index;
            hasNewResolvedQuestions = true;
            newlyResolvedQuestionIndexes.push({ origIndex, res });
         }
      });

      if (!hasNewResolvedQuestions) {
         console.log(`⏳ No new events conclusively finished for challenge ${challenge.id}. Waiting for next cycle.`);
         continue;
      }

      console.log(`🌟 Newly Resolved Questions for challenge ${challenge.id}: ${newlyResolvedQuestionIndexes.length}`);

      // 4. Grade Responses & Fetch Profiles
      const { data: rawResponses } = await supabase
        .from('challenge_responses')
        .select('*')
        .eq('challenge_id', challenge.id);

      let responses = rawResponses || [];
      if (responses.length > 0) {
        const userIds = [...new Set(responses.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .in('id', userIds);
        
        const profileMap = {};
        (profiles || []).forEach(p => { profileMap[p.id] = p; });
        
        responses = responses.map(r => ({ ...r, profiles: profileMap[r.user_id] || null }));
      }

      // 5. Generate a Feed Post specifically for each newly resolved question!
      // This is the true incremental feed feature.
      for (const { origIndex, res: aiRes } of newlyResolvedQuestionIndexes) {
         const q = challenge.questions[origIndex];
         const officialAnsText = aiRes.result_text || (q.answer !== null ? q.options[q.answer] : "None of the options");
         
         const participants = responses ? responses.map(resp => {
           const name = resp.profiles?.full_name || resp.profiles?.email?.split('@')[0] || 'Unknown User';
           const img = resp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
           const isCorrect = q.answer !== null && resp.answers[origIndex] === q.answer;
           return {
              id: resp.user_id,
              n: name,
              img: img,
              pts: isCorrect ? "+20" : "0", 
              ok: isCorrect,
              ans: q.options[resp.answers[origIndex]] || "Skipped/Pending" 
           };
         }) : [];

         const postData = {
            type: 'q_result',
            q: q.question,
            off: officialAnsText,
            total_q: challenge.questions.length,
            parts: participants
         };

         await supabase.from('feed_posts').insert({
           challenge_id: challenge.id,
           creator_id: challenge.creator_id,
           match_id: challenge.match_id,
           match_name: challenge.match_name,
           content: JSON.stringify(postData)
         });
      }

      // Check if ALL questions across the challenge are now fully resolved
      const isCompletelyResolved = challenge.questions.every(q => q.answer !== -1);

      if (isCompletelyResolved) {
         // Calculate final scores across all questions
         for (const resp of responses) {
            let score = 0;
            resp.answers.forEach((ans, i) => {
              if (ans !== -1 && ans === challenge.questions[i].answer) score += 20;
            });
            await supabase.from('challenge_responses').update({ score }).eq('id', resp.id);
            resp.score = score; // sync for leaderboard
         }

         // Generate Final Leaderboard Post
         const leaderboardParticipants = responses.map(resp => {
            const name = resp.profiles?.full_name || resp.profiles?.email?.split('@')[0] || 'Unknown User';
            const img = resp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
            return { id: resp.user_id, n: name, img, score: resp.score };
         }).sort((a, b) => b.score - a.score);

         leaderboardParticipants.forEach((p, idx) => {
            if (p.score === 0) p.medal = '💔';
            else if (idx === 0) p.medal = '🥇';
            else if (idx === 1) p.medal = '🥈';
            else if (idx === 2) p.medal = '🥉';
            else p.medal = '🏅';
         });

         const leaderboardData = {
            type: 'leaderboard',
            match_name: challenge.match_name,
            short_id: challenge.short_id,
            total_q: challenge.questions.length,
            parts: leaderboardParticipants
         };

         await supabase.from('feed_posts').insert({
            challenge_id: challenge.id,
            creator_id: challenge.creator_id,
            match_id: challenge.match_id,
            match_name: challenge.match_name,
            content: JSON.stringify(leaderboardData)
         });
      }

      // 6. Save the partial or fully updated state to Supabase
      await supabase.from('challenges').update({ 
        is_resolved: isCompletelyResolved,
        questions: challenge.questions 
      }).eq('id', challenge.id);
        
      console.log(`✅ Saved incremental updates (Fully Resolved: ${isCompletelyResolved}) for Challenge ${challenge.id}!`);
    }
  } catch (error) {
    console.error('❌ AI Umpire Error:', error);
  }
}

// Run every 2 minutes
cron.schedule('*/2 * * * *', runAIUmpire);

// Run immediately on boot
runAIUmpire();

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
