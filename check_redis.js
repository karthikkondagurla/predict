import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
async function run() {
  const keys = await redis.keys('*');
  console.log("Redis keys:", keys);
  process.exit(0);
}
run();
