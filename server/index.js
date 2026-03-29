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
cron.schedule('*/10 * * * *', async () => {
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

    // 2. Fetch latest match statuses from CricAPI
    const response = await fetch(`${BASE_URL}/series_info?apikey=${API_KEY}&id=${IPL_SERIES_ID}`);
    const apiData = await response.json();
    const matchList = apiData.data?.matchList || [];

    for (const challenge of challenges) {
      const matchData = matchList.find(m => m.id === challenge.match_id);
      if (!matchData) continue;

      // Ensure the match actually ended before grading!
      if (matchData.matchEnded) {
        console.log(`🏏 Match ${challenge.match_name} has ended! Unleashing AI on Challenge ${challenge.id}...`);

        // Fetch deep scorecard
        const scoreRes = await fetch(`${BASE_URL}/match_scorecard?apikey=${API_KEY}&id=${challenge.match_id}`);
        const scoreData = await scoreRes.json();

        // 3. Prompt Gemini
        const model = genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
          generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
          You are an expert cricket umpire and statistician.
          Here is the raw JSON scorecard for the match: ${JSON.stringify(scoreData.data)}
          
          I have the following multiple-choice questions about this match:
          ${challenge.questions.map((q, i) => `Q${i}: ${q.question} (Options: ${q.options.join(', ')})`).join('\n')}

          Based ONLY on the scorecard provided, which option index (0, 1, 2, or 3) is the completely correct answer for each question?
          If it's a tie, subjective, or not in the scorecard, pick the closest actual logical option index.
          
          Return ONLY a JSON array of integers representing the zero-based correct option index for each question in order.
          Example output: [0, 2, 1]
        `;

        const result = await model.generateContent(prompt);
        const correctAnswers = JSON.parse(result.response.text());

        // 4. Grade responses
        const { data: responses } = await supabase
          .from('challenge_responses')
          .select('*')
          .eq('challenge_id', challenge.id);

        if (responses && responses.length > 0) {
          for (const resp of responses) {
            let score = 0;
            resp.answers.forEach((ans, i) => {
              if (ans === correctAnswers[i]) score += 10;
            });
            await supabase.from('challenge_responses').update({ score }).eq('id', resp.id);
          }
        }

        // 5. Update challenge.questions with AI correct answers
        const updatedQuestions = challenge.questions.map((q, i) => ({
          ...q,
          answer: correctAnswers[i] // Overwrite creator's answer with AI's official answer
        }));

        // 6. Generate feed post
        const contentStr = challenge.questions.map((q, i) => `Q: ${q.question} → **${q.options[correctAnswers[i]]}**`).join('\n');
        await supabase.from('feed_posts').insert({
          challenge_id: challenge.id,
          creator_id: challenge.creator_id,
          match_id: challenge.match_id,
          match_name: challenge.match_name,
          content: `🤖 The AI Umpire has graded "${challenge.match_name}"!\n\n${contentStr}\n\nCheck the leaderboard to see who won!`
        });

        // 7. Mark resolved and save updated questions
        await supabase.from('challenges').update({ 
          is_resolved: true,
          questions: updatedQuestions 
        }).eq('id', challenge.id);
          
        console.log(`✅ AI Umpire successfully resolved Challenge ${challenge.id}!`);
      }
    }
  } catch (error) {
    console.error('❌ AI Umpire Error:', error);
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
