import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';
import fs from 'fs';

const env = dotenv.parse(fs.readFileSync('.env'));

let upstashUrl = '';
let upstashToken = '';
if (env.REDIS_URL && env.REDIS_URL.includes('upstash.io')) {
  const url = new URL(env.REDIS_URL);
  upstashToken = url.password;
  upstashUrl = `https://${url.hostname}`;
}

const redis = new Redis({
  url: upstashUrl,
  token: upstashToken,
});

async function run() {
  const cricKeys = env.CRICAPI_KEYS.split(',');
  const BASE_URL = 'https://api.cricapi.com/v1';
  const IPL_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f";

  let data;
  for (const key of cricKeys) {
     console.log(`Trying CricAPI key: ${key.substring(0, 5)}...`);
     const res = await fetch(`${BASE_URL}/series_info?apikey=${key}&id=${IPL_SERIES_ID}`);
     data = await res.json();
     if (data.status === "success") break;
     console.log("Failed with this key:", data.reason);
  }
  
  if (data.status !== "success") {
    console.error("All keys failed!");
    return;
  }

  // Calculate IST date for today
  const now = new Date();
  const istOffsetMs = (5.5 * 60 * 60 * 1000) + (15 * 60 * 1000);
  const ist = new Date(now.getTime() + istOffsetMs);
  const todayStr = ist.toISOString().split('T')[0];
  
  console.log(`Filtering matches for today IST (${todayStr})...`);

  const rawMatches = data.data?.matchList || [];
  const todayMatches = rawMatches.filter(m => m.dateTimeGMT?.startsWith(todayStr));

  if (todayMatches.length > 0) {
    const matchesWithState = todayMatches.map(m => ({
      ...m,
      toss_declared: false,
      challenges_resolved: false,
      last_scorecard_fetch: 0
    }));

    await redis.set('live_matches', matchesWithState, { ex: 86400 });
    console.log(`✅ Successfully manually cached ${matchesWithState.length} match(es) to Upstash Redis!`);
  } else {
    console.log('⚠️ No matches found for today.');
  }
}

run();
