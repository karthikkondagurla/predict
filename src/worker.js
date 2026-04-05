import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Redis } from '@upstash/redis/cloudflare';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const app = new Hono();
app.use('*', cors());

// --- CRICAPI CONFIG ---
const BASE_URL = 'https://api.cricapi.com/v1';
const IPL_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f";

// Helper: Calculate IST Date String
function todayISTString() {
  const now = new Date();
  const istOffsetMs = (5.5 * 60 * 60 * 1000) + (15 * 60 * 1000);
  const ist = new Date(now.getTime() + istOffsetMs);
  return ist.toISOString().split('T')[0];
}

// --- HELPER: API ROTATION ---
class ApiRotator {
  constructor(cricKeys, geminiKeys) {
    this.cricKeys = cricKeys;
    this.geminiKeys = geminiKeys;
    this.cricIdx = 0;
    this.geminiIdx = 0;
  }

  async fetchCricApi(endpointBuilder) {
    if (this.cricKeys.length === 0) throw new Error("No CricAPI keys configured");
    let attempts = 0;
    while (attempts < this.cricKeys.length) {
      const currentKey = this.cricKeys[this.cricIdx];
      const url = endpointBuilder(currentKey);
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== "success" && data.reason && /limit|upgrade|quota|apikey|hits|blocked/i.test(data.reason)) {
          console.warn(`⚠️ CricAPI key ${this.cricIdx + 1} exhausted. Switching...`);
          this.cricIdx = (this.cricIdx + 1) % this.cricKeys.length;
          attempts++;
          continue;
        }
        return data;
      } catch (err) {
        console.error(`❌ CricAPI fetch failed with key ${this.cricIdx + 1}`);
        this.cricIdx = (this.cricIdx + 1) % this.cricKeys.length;
        attempts++;
      }
    }
    throw new Error("All CricAPI keys exhausted or failed.");
  }

  async generateGemini(prompt) {
    if (this.geminiKeys.length === 0) throw new Error("No Gemini keys configured");
    let attempts = 0;
    while (attempts < this.geminiKeys.length) {
      const currentKey = this.geminiKeys[this.geminiIdx];
      const genAI = new GoogleGenerativeAI(currentKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });
      try {
        return await model.generateContent(prompt);
      } catch (err) {
        if (/429|quota|exhausted|limit|overloaded/i.test(err.message || "")) {
          console.warn(`⚠️ Gemini key ${this.geminiIdx + 1} exhausted. Switching...`);
          this.geminiIdx = (this.geminiIdx + 1) % this.geminiKeys.length;
          attempts++;
          continue;
        }
        throw err;
      }
    }
    throw new Error("All Gemini keys exhausted or failed.");
  }
}

// --- API ROUTES ---

// 1. Get Live Matches (Frontend Endpoint)
const matchesHandler = async (c) => {
  const redis = new Redis({
    url: c.env.UPSTASH_REDIS_REST_URL,
    token: c.env.UPSTASH_REDIS_REST_TOKEN,
  });

  try {
    const cachedMatches = await redis.get('live_matches');

    // Cloudflare Edge Cache headers
    c.header('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

    if (cachedMatches && Array.isArray(cachedMatches) && cachedMatches.length > 0) {
      return c.json({ status: 'success', data: cachedMatches, source: 'cache' });
    }
    return c.json({ status: 'success', data: [], source: 'empty' });
  } catch (error) {
    return c.json({ status: 'error', reason: error.message }, 500);
  }
};

app.get('/api/matches', matchesHandler);
app.get('/matches', matchesHandler);

// --- CRON JOB LOGIC ---

async function runDailySetup(env) {
  console.log('🔄 Running Daily Setup (Midnight)');
  const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
  const cricKeys = env.CRICAPI_KEYS ? env.CRICAPI_KEYS.split(',').map(k => k.trim()) : [];
  const rotator = new ApiRotator(cricKeys, []);

  const data = await rotator.fetchCricApi((key) => `${BASE_URL}/series_info?apikey=${key}&id=${IPL_SERIES_ID}`);
  if (data.status !== "success") throw new Error(data.reason || "Failed to fetch series");

  const rawMatches = data.data?.matchList || [];
  const todayStr = todayISTString();
  const todayMatches = rawMatches.filter(m => m.dateTimeGMT?.startsWith(todayStr));

  if (todayMatches.length > 0) {
    // Initialize Match State logic
    const matchesWithState = todayMatches.map(m => ({
      ...m,
      toss_declared: false,
      challenges_resolved: false,
      last_scorecard_fetch: 0
    }));

    // Cache with 24hr TTL
    await redis.set('live_matches', matchesWithState, { ex: 86400 });
    console.log(`💾 Cached ${matchesWithState.length} today's match(es)`);
  } else {
    console.log('⚠️ No matches scheduled for today.');
    await redis.del('live_matches');
  }
}

async function runSmartMatchTrackerAndUmpire(env) {
  console.log('🔄 Running Smart Match Tracker & AI Umpire');
  const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
  const cricKeys = env.CRICAPI_KEYS ? env.CRICAPI_KEYS.split(',').map(k => k.trim()) : [];
  const geminiKeys = env.GEMINI_KEYS ? env.GEMINI_KEYS.split(',').map(k => k.trim()) : [];
  const rotator = new ApiRotator(cricKeys, geminiKeys);
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

  let cachedMatches = await redis.get('live_matches');
  if (!cachedMatches || !Array.isArray(cachedMatches)) {
    console.log('⚠️ No live_matches in Redis.');
    return;
  }

  const now = Date.now();
  let hasChanges = false;

  for (let match of cachedMatches) {
    // Determine start time
    const timeStr = match.dateTimeGMT?.endsWith('Z') ? match.dateTimeGMT : match.dateTimeGMT + 'Z';
    const startTime = new Date(timeStr).getTime();
    
    // 1. TOSS TRACKING (If within 30 mins of start and toss not declared)
    if (!match.toss_declared && now >= (startTime - 30 * 60 * 1000) && !match.matchEnded) {
      console.log(`🪙 Checking Toss for ${match.id}`);
      try {
        const scoreData = await rotator.fetchCricApi((key) => `${BASE_URL}/match_scorecard?apikey=${key}&id=${match.id}`);
        if (scoreData.status === "success" && scoreData.data) {
          await redis.set(`scorecard:${match.id}`, scoreData.data, { ex: 600 });
          
          match.matchStarted = scoreData.data.matchStarted ?? match.matchStarted;
          match.status = scoreData.data.status ?? match.status;

          // If toss is in the status or match started, we consider it declared
          if (match.matchStarted || match.status?.toLowerCase().includes('toss')) {
            match.toss_declared = true;
            hasChanges = true;
            console.log(`✅ Toss Declared for ${match.id}`);
          }
        }
      } catch (e) {
        console.error(`❌ Toss fetch failed:`, e.message);
      }
    }

    // 2. SCORECARD TRACKING (If match started, not ended, fetch every 5 mins)
    // 5 mins = 300,000 ms
    if (match.matchStarted && !match.matchEnded && now - (match.last_scorecard_fetch || 0) >= 300000) {
      console.log(`📊 Fetching Scorecard for ${match.id}`);
      try {
        const scoreData = await rotator.fetchCricApi((key) => `${BASE_URL}/match_scorecard?apikey=${key}&id=${match.id}`);
        if (scoreData.status === "success" && scoreData.data) {
          await redis.set(`scorecard:${match.id}`, scoreData.data, { ex: 600 });
          
          match.matchStarted = scoreData.data.matchStarted ?? match.matchStarted;
          match.matchEnded = scoreData.data.matchEnded ?? match.matchEnded;
          match.status = scoreData.data.status ?? match.status;
          match.last_scorecard_fetch = now;
          hasChanges = true;
          console.log(`✅ Scorecard updated for ${match.id}`);
        }
      } catch (e) {
        console.error(`❌ Scorecard fetch failed:`, e.message);
      }
    }

    // 3. AI UMPIRE (If toss declared or match started, and challenges not fully resolved)
    if ((match.toss_declared || match.matchStarted) && !match.challenges_resolved) {
      console.log(`🤖 Running AI Umpire for ${match.id}`);
      await runMatchUmpire(match, redis, rotator, supabase);
      // We don't mark hasChanges here because umpire state (challenges_resolved) 
      // will be updated if all challenges finish.
    }
  }

  if (hasChanges) {
    // KeepTTL keeps the original 24h expiration
    await redis.set('live_matches', cachedMatches, { keepTtl: true });
  }
}

async function runMatchUmpire(match, redis, rotator, supabase) {
  // 1. Fetch unresolved challenges for THIS specific match
  const { data: challenges, error: fetchErr } = await supabase
    .from('challenges')
    .select('*')
    .eq('match_id', match.id)
    .eq('is_resolved', false);

  if (fetchErr || !challenges || challenges.length === 0) {
    if (match.matchEnded) {
       // If match ended and NO unresolved challenges remain, mark fully resolved!
       match.challenges_resolved = true;
       // (We will save this state back in the main loop)
    }
    return;
  }

  // Fetch Live Scorecard (from Redis)
  let scoreData = await redis.get(`scorecard:${match.id}`);
  if (!scoreData) {
     console.log(`⚠️ No live scorecard available in Redis for match ${match.id}, skipping AI Umpire.`);
     return;
  }

  let allChallengesResolvedNow = true;

  for (const challenge of challenges) {
    const questionsToGrade = challenge.questions.map((q, i) => ({ ...q, originalIndex: i }))
                                                .filter(q => q.status !== 'RESOLVED');
    if (questionsToGrade.length === 0) continue;

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

    try {
      const result = await rotator.generateGemini(prompt);
      const textResponse = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
      const geminiResults = JSON.parse(textResponse);
      
      let hasNewResolvedQuestions = false;
      const newlyResolvedQuestionIndexes = [];

      geminiResults.forEach((res, indexInList) => {
        const origIndex = questionsToGrade[indexInList].originalIndex;
        if (res.status === "RESOLVED") {
          challenge.questions[origIndex].official_answer = res.answer_index;
          challenge.questions[origIndex].status = 'RESOLVED';
          hasNewResolvedQuestions = true;
          newlyResolvedQuestionIndexes.push({ origIndex, res });
        }
      });

      if (!hasNewResolvedQuestions) {
        allChallengesResolvedNow = false;
        continue;
      }

      // We have new resolved questions! Update DB.
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

      // Generate Feed Posts
      const feedPostsToInsert = [];
      for (const { origIndex, res: aiRes } of newlyResolvedQuestionIndexes) {
         const q = challenge.questions[origIndex];
         const officialAnsText = aiRes.result_text || (q.official_answer !== null ? q.options[q.official_answer] : "None of the options");

         const participants = responses.map(resp => {
           const name = resp.profiles?.full_name || resp.profiles?.email?.split('@')[0] || 'Unknown User';
           const img = resp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
           const isCorrect = q.official_answer !== null && resp.answers[origIndex] === q.official_answer;
           return {
              id: resp.user_id,
              n: name,
              img: img,
              pts: isCorrect ? "+20" : "0",
              ok: isCorrect,
              ans: q.options[resp.answers[origIndex]] || "Skipped/Pending"
           };
         });

         feedPostsToInsert.push({
           challenge_id: challenge.id,
           creator_id: challenge.creator_id,
           match_id: challenge.match_id,
           match_name: challenge.match_name,
           content: JSON.stringify({
              type: 'q_result',
              q: q.question,
              off: officialAnsText,
              total_q: challenge.questions.length,
              parts: participants
           })
         });
      }

      const isCompletelyResolved = challenge.questions.every(q => q.status === 'RESOLVED');

      if (isCompletelyResolved) {
         // --- OPTIMIZATION: PROMISE.ALL FOR BULK UPDATES ---
         const updatePromises = responses.map(resp => {
            let score = 0;
            resp.answers.forEach((ans, i) => {
              const q = challenge.questions[i];
              if (q.status === 'RESOLVED' && q.official_answer !== null && ans === q.official_answer) score += 20;
            });
            resp.score = score;
            return supabase.from('challenge_responses').update({ score }).eq('id', resp.id);
         });
         await Promise.all(updatePromises); // Runs them all concurrently!

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

         feedPostsToInsert.push({
            challenge_id: challenge.id,
            creator_id: challenge.creator_id,
            match_id: challenge.match_id,
            match_name: challenge.match_name,
            content: JSON.stringify({
              type: 'leaderboard',
              match_name: challenge.match_name,
              short_id: challenge.short_id,
              total_q: challenge.questions.length,
              parts: leaderboardParticipants
            })
         });
      } else {
         allChallengesResolvedNow = false;
      }

      // Insert all feed posts in one batch
      if (feedPostsToInsert.length > 0) {
        await supabase.from('feed_posts').insert(feedPostsToInsert);
      }

      // Update challenge
      await supabase.from('challenges').update({ 
        is_resolved: isCompletelyResolved,
        questions: challenge.questions 
      }).eq('id', challenge.id);

    } catch (e) {
      console.error(`❌ Umpire processing failed for challenge ${challenge.id}:`, e);
      allChallengesResolvedNow = false;
    }
  }

  if (allChallengesResolvedNow && match.matchEnded) {
     match.challenges_resolved = true;
  }
}

// --- EXPORT WORKER ---
export default {
  // Handle HTTP Requests (API)
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },

  // Handle Cron Triggers
  async scheduled(event, env, ctx) {
    // We use ctx.waitUntil so Cloudflare doesn't kill the worker 
    // immediately if the promise takes slightly longer than the CPU time
    if (event.cron === "0 0 * * *") {
      ctx.waitUntil(runDailySetup(env));
    } else if (event.cron === "*/2 * * * *") {
      ctx.waitUntil(runSmartMatchTrackerAndUmpire(env));
    }
  }
};
