import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

async function run() {
  const val = await redis.get('live_matches');
  if (val) {
    const matches = JSON.parse(val);
    console.log(`Found ${matches.length} matches.`);
    matches.forEach(m => {
       console.log(`ID: ${m.id} | Name: ${m.name} | Date: ${m.dateTimeGMT}`);
    });
  } else {
    console.log("No live_matches in Redis.");
  }
  process.exit(0);
}

run();
