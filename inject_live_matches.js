import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const liveMatches = [
  {
    "id": "ae676d7c-3082-489c-96c5-5620f393c900",
    "name": "Lucknow Super Giants vs Delhi Capitals, 5th Match, Indian Premier League 2026",
    "matchType": "t20",
    "status": "Match in progress",
    "venue": "Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow",
    "date": new Date().toISOString().split('T')[0],
    "dateTimeGMT": new Date().toISOString(),
    "teams": [
      "Lucknow Super Giants",
      "Delhi Capitals"
    ],
    "teamInfo": [
      {
        "name": "Lucknow Super Giants",
        "shortname": "LSG",
        "img": "https://g.cricapi.com/i/teams/124.png"
      },
      {
        "name": "Delhi Capitals",
        "shortname": "DC",
        "img": "https://g.cricapi.com/i/teams/102.png"
      }
    ],
    "series_id": "87c62aac-bc3c-4738-ab93-19da0690488f",
    "fantasyEnabled": true,
    "hasSquad": true,
    "matchEnded": false
  }
];

async function run() {
  console.log('Injecting mock live_matches into Redis...');
  await redis.set('live_matches', JSON.stringify(liveMatches));
  console.log('✅ Successfully injected live_matches!');
  process.exit(0);
}

run();
