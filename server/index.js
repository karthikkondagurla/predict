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

// Initialize Supabase (Server-side)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// --- MULTI-KEY ROTATION CONFIGURATION ---
const cricApiKeys = process.env.CRICAPI_KEYS
  ? process.env.CRICAPI_KEYS.split(',').map(k => k.trim()).filter(Boolean)
  : [process.env.VITE_CRICAPI_KEY].filter(Boolean);

const geminiKeys = process.env.GEMINI_KEYS
  ? process.env.GEMINI_KEYS.split(',').map(k => k.trim()).filter(Boolean)
  : [process.env.GEMINI_API_KEY].filter(Boolean);

let currentCricApiIndex = 0;
let currentGeminiIndex = 0;

console.log(`🔑 Loaded ${cricApiKeys.length} CricAPI keys and ${geminiKeys.length} Gemini keys.`);

// Helper: Fetch from CricAPI with Key Rotation
async function fetchWithCricApiRotation(endpointBuilder) {
  if (cricApiKeys.length === 0) throw new Error("No CricAPI keys configured");

  let attempts = 0;
  while (attempts < cricApiKeys.length) {
    const currentKey = cricApiKeys[currentCricApiIndex];
    const url = endpointBuilder(currentKey);

    try {
      const res = await fetch(url);
      const data = await res.json();

      // Check if limit exceeded or unauthorized
      if (data.status !== "success" && data.reason && /limit|upgrade|quota|apikey|hits|blocked/i.test(data.reason)) {
        console.warn(`⚠️ CricAPI key ${currentCricApiIndex + 1}/${cricApiKeys.length} exhausted or invalid. Reason: ${data.reason}. Switching to next key...`);
        currentCricApiIndex = (currentCricApiIndex + 1) % cricApiKeys.length;
        attempts++;
        continue;
      }
      return data;
    } catch (err) {
      console.error(`❌ CricAPI fetch failed with key ${currentCricApiIndex + 1}:`, err.message);
      currentCricApiIndex = (currentCricApiIndex + 1) % cricApiKeys.length;
      attempts++;
    }
  }
  throw new Error("All CricAPI keys exhausted or failed.");
}

// Helper: Generate with Gemini with Key Rotation
async function generateWithGeminiRotation(prompt) {
  if (geminiKeys.length === 0) throw new Error("No Gemini keys configured");

  let attempts = 0;
  while (attempts < geminiKeys.length) {
    const currentKey = geminiKeys[currentGeminiIndex];
    const genAI = new GoogleGenerativeAI(currentKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    try {
      return await model.generateContent(prompt);
    } catch (err) {
      const errMsg = err.message || "";
      if (/429|quota|exhausted|limit|overloaded/i.test(errMsg)) {
        console.warn(`⚠️ Gemini key ${currentGeminiIndex + 1}/${geminiKeys.length} exhausted. Error: ${errMsg}. Switching to next key...`);
        currentGeminiIndex = (currentGeminiIndex + 1) % geminiKeys.length;
        attempts++;
        continue;
      }
      throw err; // Not a rate limit issue, bubble it up
    }
  }
  throw new Error("All Gemini keys exhausted or failed.");
}

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
const BASE_URL = 'https://api.cricapi.com/v1';
const IPL_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f";

// --- IST HELPERS ---
function nowIST() {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(Date.now() + istOffsetMs);
}

function todayISTString() {
  return nowIST().toISOString().split('T')[0]; // "YYYY-MM-DD"
}

// --- MATCH WINDOW CONFIG (IST = UTC+5:30) ---
// Afternoon match: toss ~3:00 PM IST, ends ~7:30 PM IST
// Evening match:   toss ~7:00 PM IST, ends ~11:30 PM IST
function isInMatchWindow() {
  const ist = nowIST();
  const h = ist.getUTCHours();
  const m = ist.getUTCMinutes();
  const totalMin = h * 60 + m;
  const afternoonStart = 14 * 60 + 30; // 2:30 PM IST (buffer before 3 PM toss)
  const eveningEnd     = 23 * 60 + 30; // 11:30 PM IST
  return totalMin >= afternoonStart && totalMin <= eveningEnd;
}

let seriesInfoFetchedDate = null;

// Timestamps to enforce intervals within the window
let lastScorecardsRefresh = 0;
let lastAIUmpire          = 0;
const SCORECARD_INTERVAL_MS   = 1 * 60 * 1000;  // 1 minute
const AI_UMPIRE_INTERVAL_MS   = 1 * 60 * 1000;  // 1 minute

// --- 1a. FETCH SERIES INFO (once per day, also called on startup) ---
async function fetchAndCacheSeriesInfo(forceFetch = false) {
  if (cricApiKeys.length === 0) return;

  const todayStr = todayISTString();

  if (!forceFetch) {
    // Skip if already fetched today in this process
    if (seriesInfoFetchedDate === todayStr) {
      console.log('📡 Series info already fetched today in this process, skipping.');
      return;
    }

    // Check if we already have today's matches in Redis to avoid hitting CricAPI on server reload
    const cachedMatches = await redis.get('live_matches');
    if (cachedMatches) {
      try {
        const matchesArray = JSON.parse(cachedMatches);
        if (matchesArray.length > 0 && matchesArray[0].dateTimeGMT?.startsWith(todayStr)) {
          console.log("📦 Today's live_matches already in Redis. Skipping CricAPI series info fetch.");
          seriesInfoFetchedDate = todayStr;
          return;
        }
      } catch (e) {
        console.error('Error parsing cached matches', e);
      }
    }

    if (!isInMatchWindow()) {
      console.log("⚠️ Not in match window and Redis lacks today's matches. Skipping CricAPI series info fetch to save quota. Will fetch when match window starts.");
      return;
    }
  }

  console.log('📡 Fetching series info from CricAPI...');
  try {
    const data = await fetchWithCricApiRotation((key) => `${BASE_URL}/series_info?apikey=${key}&id=${IPL_SERIES_ID}`);

    if (data.status !== "success") throw new Error(data.reason || "Failed to fetch series info");

    const rawMatches = data.data?.matchList || [];

    const todayMatches = rawMatches.filter(m => m.dateTimeGMT?.startsWith(todayStr));

    if (todayMatches.length > 0) {
      // Cache with 24hr TTL — won't change during the day
      await redis.set('live_matches', JSON.stringify(todayMatches), 'EX', 86400);
      console.log(`💾 Cached ${todayMatches.length} today's match(es) from series_info`);
    } else {
      console.log('⚠️ No matches scheduled for today per series_info.');
      await redis.del('live_matches');
    }

    seriesInfoFetchedDate = todayStr;
  } catch (error) {
    console.error('❌ Error fetching series info:', error);
  }
}

// --- 1b. REFRESH SCORECARDS EVERY 5 MIN (updates match cards on frontend) ---
async function refreshScorecards() {
  if (cricApiKeys.length === 0) return;

  const cached = await redis.get('live_matches');
  if (!cached) {
    console.log('⚠️ No live_matches in Redis, skipping scorecard refresh.');
    return;
  }

  const matches = JSON.parse(cached);
  for (const match of matches) {
    try {
      const scoreData = await fetchWithCricApiRotation((key) => `${BASE_URL}/match_scorecard?apikey=${key}&id=${match.id}`);

      if (scoreData.status === "success" && scoreData.data) {
        // Update the scorecard cache (used by AI umpire)
        await redis.set(`scorecard:${match.id}`, JSON.stringify(scoreData.data), 'EX', 600);

        // Merge live status fields into the match card so the frontend stays updated
        const updatedMatch = {
          ...match,
          matchStarted: scoreData.data.matchStarted ?? match.matchStarted,
          matchEnded:   scoreData.data.matchEnded   ?? match.matchEnded,
          status:       scoreData.data.status       ?? match.status,
          score:        scoreData.data.score        ?? match.score,
        };
        matches[matches.indexOf(match)] = updatedMatch;

        console.log(`💾 Refreshed scorecard for ${match.id}`);
      }
    } catch (e) {
      console.error(`❌ Failed to refresh scorecard for ${match.id}`, e);
    }
  }

  // Write updated match list back so /api/matches serves fresh card data
  await redis.set('live_matches', JSON.stringify(matches), 'EX', 86400);
}

// --- DAILY SERIES INFO FETCH (midnight IST = 18:30 UTC) ---
cron.schedule('30 18 * * *', async () => {
  // Reset API key rotation indices and date guard for the new day
  currentCricApiIndex = 0;
  currentGeminiIndex = 0;
  seriesInfoFetchedDate = null;
  console.log('🔄 Reset API key rotation indices for the new day');

  await fetchAndCacheSeriesInfo(true);
}, { timezone: 'UTC' });
console.log('✅ Series info scheduled daily at midnight IST (18:30 UTC)');

// --- STARTUP: fetch series info immediately so live_matches is current ---
fetchAndCacheSeriesInfo().catch(err => console.error('❌ Startup series info fetch failed:', err));

// --- MASTER SCHEDULER (runs every minute during match window) ---
cron.schedule('* * * * *', async () => {
  // Refresh series info if not done today (e.g. server restarted after midnight)
  if (seriesInfoFetchedDate !== todayISTString()) {
    await fetchAndCacheSeriesInfo();
  }

  if (!isInMatchWindow()) return;

  const now = Date.now();

  // Refresh scorecards every 5 min
  if (now - lastScorecardsRefresh >= SCORECARD_INTERVAL_MS) {
    lastScorecardsRefresh = now;
    await refreshScorecards();
  }

  // Run AI umpire every 2 min
  if (now - lastAIUmpire >= AI_UMPIRE_INTERVAL_MS) {
    lastAIUmpire = now;
    await runAIUmpire();
  }
});

console.log('✅ Match window scheduler is ENABLED (2:30 PM – 11:30 PM IST, covers both afternoon and evening matches)');

// --- 2. API ROUTE: GET LIVE MATCHES ---
app.get('/api/matches', async (req, res) => {
  try {
    // Only serve from Redis (populated by series_info once/day, updated by scorecards every 5 min)
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

// --- 3. HELPER: FETCH SCORECARD (Redis first, then CricAPI fallback) ---
async function getMatchScorecard(matchId) {
  // 1. Check Redis first
  const cachedScorecard = await redis.get(`scorecard:${matchId}`);
  if (cachedScorecard) {
    return JSON.parse(cachedScorecard);
  }

  // 2. Fallback: fetch directly from CricAPI and cache it
  if (cricApiKeys.length === 0) {
    console.log(`⚠️ No scorecard in Redis for ${matchId} and no CricAPI keys configured.`);
    return null;
  }

  console.log(`📡 Scorecard not in Redis for ${matchId}, fetching from CricAPI...`);
  try {
    const scoreData = await fetchWithCricApiRotation((key) => `${BASE_URL}/match_scorecard?apikey=${key}&id=${matchId}`);
    if (scoreData.status === 'success' && scoreData.data) {
      await redis.set(`scorecard:${matchId}`, JSON.stringify(scoreData.data), 'EX', 600);
      console.log(`💾 Fetched and cached scorecard for ${matchId}`);
      return scoreData.data;
    }
    console.log(`⚠️ CricAPI returned no scorecard for ${matchId}: ${scoreData.reason || 'unknown'}`);
  } catch (e) {
    console.error(`❌ Failed to fetch scorecard for ${matchId} from CricAPI:`, e.message);
  }
  return null;
}

// --- 4. INCREMENTAL AI UMPIRE CRON JOB ---
async function runAIUmpire() {
  console.log('🤖 Running Incremental AI Umpire Cron Job...');
  if (geminiKeys.length === 0) {
    console.log('⚠️ No Gemini keys configured. Skipping AI Umpire.');
    return;
  }

  try {
    // 1. Fetch unresolved challenges
    const { data: challenges, error: fetchErr } = await supabase
      .from('challenges')
      .select('*')
      .eq('is_resolved', false);

    if (fetchErr) {
      console.error('❌ Error fetching challenges:', fetchErr);
      return;
    }

    if (!challenges || challenges.length === 0) {
      console.log('📭 No unresolved challenges found');
      return;
    }

    console.log(`🔍 Found ${challenges.length} unresolved challenge(s) to evaluate`);

    for (const challenge of challenges) {
      console.log(`🏏 Live Match ${challenge.match_name} detected! Evaluating pending questions for Challenge ${challenge.id}...`);

      // Fetch Live Scorecard (from Redis or API)
      console.log(`📊 Checking scorecard for match ${challenge.match_id}...`);
      const scoreData = await getMatchScorecard(challenge.match_id);

      if (!scoreData) {
        console.log(`⚠️ No live scorecard available for match ${challenge.match_id}, skipping.`);
        console.log(`   (Scorecard may need to be fetched from CricAPI first)`);
        continue;
      }
      console.log(`✅ Found scorecard for match ${challenge.match_id}`);

      // 3. Strict Prompting to Gemini 2.5 Flash

      // Filter only questions that haven't been resolved yet (answer === -1)
      console.log(`📝 Challenge has ${challenge.questions?.length || 0} total questions`);
      const questionsToGrade = challenge.questions.map((q, i) => ({ ...q, originalIndex: i }))
                                                  .filter(q => q.answer === -1);
      console.log(`📝 ${questionsToGrade.length} question(s) pending evaluation`);

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
1. The match might be LIVE (matchEnded: false) or already over (matchEnded: true). Look closely at the scorecard.
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

      console.log(`🤖 Sending ${questionsToGrade.length} questions to Gemini for evaluation...`);
      const result = await generateWithGeminiRotation(prompt);
      let geminiResults = [];
      try {
         geminiResults = JSON.parse(result.response.text());
         console.log(`🤖 Gemini returned ${geminiResults.length} results:`, JSON.stringify(geminiResults, null, 2));
      } catch (e) {
         console.error("❌ Failed to parse Gemini JSON:", e);
         console.error("Raw response:", result.response.text());
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

         console.log(`📝 Creating feed post for question: "${q.question.substring(0, 50)}..."`);

         const { data: postResult, error: postError } = await supabase.from('feed_posts').insert({
           challenge_id: challenge.id,
           creator_id: challenge.creator_id,
           match_id: challenge.match_id,
           match_name: challenge.match_name,
           content: JSON.stringify(postData)
         }).select();

         if (postError) {
           console.error(`❌ Failed to insert feed post for challenge ${challenge.id}:`, postError);
         } else {
           console.log(`✅ Posted result to feed for challenge ${challenge.id}, question ${origIndex}`);
         }
      }

      // ALWAYS calculate current scores across all resolved questions so far
      for (const resp of responses) {
         let score = 0;
         resp.answers.forEach((ans, i) => {
           if (ans !== -1 && ans === challenge.questions[i].answer) score += 20;
         });
         await supabase.from('challenge_responses').update({ score }).eq('id', resp.id);
         resp.score = score; // sync for leaderboard
      }

      // Check if ALL questions across the challenge are now fully resolved
      const isCompletelyResolved = challenge.questions.every(q => q.answer !== -1);

      if (isCompletelyResolved) {
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

         console.log(`🏆 Creating leaderboard post for challenge ${challenge.id}`);

         const { error: lbError } = await supabase.from('feed_posts').insert({
            challenge_id: challenge.id,
            creator_id: challenge.creator_id,
            match_id: challenge.match_id,
            match_name: challenge.match_name,
            content: JSON.stringify(leaderboardData)
         });

         if (lbError) {
            console.error(`❌ Failed to insert leaderboard for challenge ${challenge.id}:`, lbError);
         } else {
            console.log(`✅ Posted leaderboard for challenge ${challenge.id}`);
         }
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

// (AI Umpire is triggered by the master scheduler above)

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
