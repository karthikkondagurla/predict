import dotenv from 'dotenv';
import Redis from 'ioredis';
dotenv.config();
const redis = new Redis(process.env.REDIS_URL);
redis.get('live_matches').then(res => {
  console.log(res);
  process.exit(0);
});
