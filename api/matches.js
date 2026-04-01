const API_KEY = process.env.VITE_CRICAPI_KEY;
const BASE_URL = 'https://api.cricapi.com/v1';
const IPL_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f";
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  reconnectOnError: (err) => ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'].some(e => err.message.includes(e))
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Only serve from Redis (populated by cron job every 30 mins)
    const cachedMatches = await redis.get('live_matches');
    if (cachedMatches) {
      console.log('📦 Serving matches from Redis (Serverless)');
      return res.status(200).json({
        status: 'success',
        data: JSON.parse(cachedMatches),
        source: 'cache'
      });
    }

    console.log('⚠️ No matches in Redis (waiting for cron job)');
    return res.status(200).json({ status: 'success', data: [], source: 'empty' });
    
  } catch (error) {
    console.error("API Route Error:", error);
    res.status(500).json({ status: 'error', reason: error.message });
  }
}
