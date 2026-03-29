import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Redis from 'ioredis';

// Load environment variables from the root .env file
dotenv.config({ path: '.env' });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const CACHE_TTL_SECONDS = 3600; // Cache for 1 hour

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

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
