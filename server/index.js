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

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('connect', () => {
  console.log('✅ Connected to Redis successfully');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

// CricAPI Configuration
const API_KEY = process.env.VITE_CRICAPI_KEY; // Using existing env var name
const BASE_URL = 'https://api.cricapi.com/v1';
const IPL_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f"; // Indian Premier League 2026

app.get('/api/matches', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ status: 'error', reason: 'Missing CricAPI Key on server' });
  }

  const cacheKey = `cricapi_ipl_matches_today`;

  try {
    // 1. Check Redis Cache
    const cachedData = await redis.get(cacheKey);
    if (cachedData) {
      console.log('📦 Cache Hit: Serving IPL matches from Redis');
      return res.json(JSON.parse(cachedData));
    }

    console.log('🌐 Cache Miss: Fetching from CricAPI...');

    // 2. Fetch from External API
    const response = await fetch(`${BASE_URL}/series_info?apikey=${API_KEY}&id=${IPL_SERIES_ID}`);
    const data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.reason || "Failed to fetch matches from CricAPI");
    }

    const rawMatches = data.data?.matchList || [];
    const todayStr = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD" in UTC

    const filteredMatches = rawMatches.filter(match => {
      // Check if the match is happening today
      return match.dateTimeGMT && match.dateTimeGMT.startsWith(todayStr);
    });

    const responsePayload = {
      status: 'success',
      data: filteredMatches,
      source: 'api'
    };

    // 3. Store in Redis
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify({ ...responsePayload, source: 'cache' }));

    // 4. Return Data
    res.json(responsePayload);
  } catch (error) {
    console.error("API Route Error:", error);
    res.status(500).json({ status: 'error', reason: error.message });
  }
});


// ---------------------------------------------------------
// 🤖 AI UMPIRE CRON JOB (Runs every 10 minutes)
// ---------------------------------------------------------
async function runAIUmpire() {
  console.log('🤖 Running AI Umpire Cron Job...');
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

    // 2. Safely pull Series Info directly to Redis first, then validate
    const seriesCacheKey = `umpire_series_info_${IPL_SERIES_ID}`;
    let matchList = [];
    const cachedSeries = await redis.get(seriesCacheKey);

    if (cachedSeries) {
      matchList = JSON.parse(cachedSeries);
    } else {
      const response = await fetch(`${BASE_URL}/series_info?apikey=${API_KEY}&id=${IPL_SERIES_ID}`);
      const apiData = await response.json();
      matchList = apiData.data?.matchList || [];
      if (matchList.length > 0) {
        // Cache the live match statuses for 5 minutes (300s) to prevent over-polling
        await redis.setex(seriesCacheKey, 300, JSON.stringify(matchList));
      }
    }

    for (const challenge of challenges) {
      const matchData = matchList.find(m => m.id === challenge.match_id);
      if (!matchData) continue;

      // We are allowing the AI Umpire to grade ongoing live matches!
      // if (matchData.matchEnded) {
        console.log(`🏏 Match ${challenge.match_name} detected! Unleashing AI on Challenge ${challenge.id}...`);

        // Fetch deep scorecard — Check Redis First!
        const scorecardCacheKey = `umpire_scorecard_${challenge.match_id}`;
        let scoreData;
        const cachedScorecard = await redis.get(scorecardCacheKey);

        if (cachedScorecard) {
          console.log(`📦 Serving scorecard for ${challenge.match_name} securely from Redis cache.`);
          scoreData = JSON.parse(cachedScorecard);
        } else {
          console.log(`🌐 Pulling scorecard from CricAPI to Redis...`);
          const scoreRes = await fetch(`${BASE_URL}/match_scorecard?apikey=${API_KEY}&id=${challenge.match_id}`);
          scoreData = await scoreRes.json();
          
          if (scoreData.status === "success") {
             // Cache the scorecard (shorter TTL now since it's a live match that will change)
             await redis.setex(scorecardCacheKey, 300, JSON.stringify(scoreData));
          }
        }

        // 3. Prompt Gemini
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash-lite",
          generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
You are an expert cricket AI Umpire. Analyze the following match scorecard and evaluate each question.

MATCH SCORECARD:
${JSON.stringify(scoreData.data)}

CHALLENGE QUESTIONS:
${challenge.questions.map((q, i) => `Q${i}: ${q.question} (Options: ${q.options.map((o, j) => `${j}:${o}`).join(', ')})`).join('\n')}

For each question, do the following:
1. Determine which option index (0-based) is the correct answer based ONLY on the scorecard. If the match is still ongoing or data is unavailable, use your best logical guess.
2. Write a SHORT, punchy result_text (max 10 words) stating the actual fact from the scorecard. Example: "Rohit scored 65 runs off 43 balls" or "MI won by 6 wickets".

Return ONLY a valid JSON array, one object per question, in this exact format:
[
  { "answer_index": 0, "result_text": "Rohit scored 65 runs" },
  { "answer_index": 2, "result_text": "KKR lost by 8 wickets" }
]
        `;

        const result = await model.generateContent(prompt);
        const geminiResults = JSON.parse(result.response.text());
        const correctAnswers = geminiResults.map(r => r.answer_index);

        // 4. Grade responses and fetch user profiles
        const { data: responses } = await supabase
          .from('challenge_responses')
          .select('*, profiles(full_name, email)')
          .eq('challenge_id', challenge.id);

        let participantDetails = '';

        if (responses && responses.length > 0) {
          for (const resp of responses) {
            let score = 0;
            resp.answers.forEach((ans, i) => {
              if (ans === correctAnswers[i]) score += 20;
            });
            resp.score = score; // Update in-memory so leaderboard reads correct values
            await supabase.from('challenge_responses').update({ score }).eq('id', resp.id);
          }
        }

        // 5. Update challenge.questions with AI correct answers
        const updatedQuestions = challenge.questions.map((q, i) => ({
          ...q,
          answer: correctAnswers[i] // Overwrite creator's answer with AI's official answer
        }));

        // 6. Generate detailed feed post FOR EACH QUESTION
        for (let i = 0; i < challenge.questions.length; i++) {
           const q = challenge.questions[i];
           const officialAnsText = geminiResults[i]?.result_text || q.options[correctAnswers[i]];
           
           const participants = responses ? responses.map(resp => {
             const name = resp.profiles?.full_name || resp.profiles?.email?.split('@')[0] || 'Unknown User';
             const img = resp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
             const isCorrect = resp.answers[i] === correctAnswers[i];
             return {
                id: resp.user_id,
                n: name,
                img: img,
                pts: isCorrect ? "+20" : "+0",
                ok: isCorrect,
                ans: q.options[resp.answers[i]]
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

        // 6.5 Generate Final Leaderboard Post
        if (responses && responses.length > 0) {
          const leaderboardParticipants = responses.map(resp => {
             const name = resp.profiles?.full_name || resp.profiles?.email?.split('@')[0] || 'Unknown User';
             const img = resp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
             return {
                id: resp.user_id,
                n: name,
                img: img,
                score: resp.score
             };
          }).sort((a, b) => b.score - a.score);

          // Assign medals (only for those who scored something)
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

        // 7. Mark resolved and save updated questions
        await supabase.from('challenges').update({ 
          is_resolved: true,
          questions: updatedQuestions 
        }).eq('id', challenge.id);
          
        console.log(`✅ AI Umpire successfully resolved Challenge ${challenge.id}!`);
      // } // <-- Commented out to match the opening brace
    }
  } catch (error) {
    console.error('❌ AI Umpire Error:', error);
  }
}

// Run every 5 minutes
cron.schedule('*/5 * * * *', runAIUmpire);

// Run immediately on boot
runAIUmpire();


app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
