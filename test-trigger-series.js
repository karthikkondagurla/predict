import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'https://api.cricapi.com/v1';
const IPL_SERIES_ID = "87c62aac-bc3c-4738-ab93-19da0690488f";
const cricApiKeys = process.env.CRICAPI_KEYS ? process.env.CRICAPI_KEYS.split(',').map(k => k.trim()).filter(Boolean) : [];
let currentCricApiIndex = 0;

async function fetchWithCricApiRotation(endpointBuilder) {
  let attempts = 0;
  while (attempts < cricApiKeys.length) {
    const currentKey = cricApiKeys[currentCricApiIndex];
    const url = endpointBuilder(currentKey);
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.status !== "success" && data.reason && /limit|upgrade|quota|apikey|hits|blocked/i.test(data.reason)) {
        currentCricApiIndex = (currentCricApiIndex + 1) % cricApiKeys.length;
        attempts++;
        continue;
      }
      return data;
    } catch (err) {
      currentCricApiIndex = (currentCricApiIndex + 1) % cricApiKeys.length;
      attempts++;
    }
  }
  throw new Error("All CricAPI keys exhausted");
}

function todayISTString() {
  const now = new Date();
  const istOffsetMs = (5.5 * 60 * 60 * 1000) + (15 * 60 * 1000);
  const ist = new Date(now.getTime() + istOffsetMs);
  return ist.toISOString().split('T')[0];
}

async function test() {
  console.log('Today string:', todayISTString());
  const data = await fetchWithCricApiRotation((key) => `${BASE_URL}/series_info?apikey=${key}&id=${IPL_SERIES_ID}`);
  const rawMatches = data.data?.matchList || [];
  const todayStr = todayISTString();
  const todayMatches = rawMatches.filter(m => m.dateTimeGMT?.startsWith(todayStr));
  console.log(`Found ${todayMatches.length} matches for ${todayStr}`);
}
test();
