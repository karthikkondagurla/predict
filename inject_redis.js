import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// The match ID we are targeting
const matchId = "ae676d7c-3082-489c-96c5-5620f393c900";

const mockScorecard = {
  id: matchId,
  name: "Lucknow Super Giants vs Delhi Capitals",
  matchType: "t20",
  status: "Lucknow Super Giants won by 20 runs",
  matchEnded: true,
  venue: "Ekana Cricket Stadium, Lucknow",
  teams: ["Lucknow Super Giants", "Delhi Capitals"],
  playerOfTheMatch: [
    {
      id: "player-99",
      name: "KL Rahul",
      shortname: "KL Rahul"
    }
  ],
  score: [
    { r: 200, w: 4, o: 20, inning: "Lucknow Super Giants Inning 1" },
    { r: 180, w: 8, o: 20, inning: "Delhi Capitals Inning 1" }
  ],
  scorecard: [
    {
      inning: "Lucknow Super Giants Inning 1",
      batting: [
        { batsman: { name: "KL Rahul" }, r: 85, b: 50, "dismissal-text": "not out" }
      ],
      bowling: []
    },
    {
      inning: "Delhi Capitals Inning 1",
      batting: [
        { batsman: { name: "Rishabh Pant" }, r: 50, b: 35, "dismissal-text": "b Bishnoi" }
      ],
      bowling: []
    }
  ]
};

async function run() {
  console.log(`Injecting mock scorecard into Redis for match: ${matchId}`);
  // Set in Redis with an expiry of 1 hour
  await redis.set(`scorecard:${matchId}`, JSON.stringify(mockScorecard), 'EX', 3600);
  console.log("✅ Successfully injected!");
  
  const val = await redis.get(`scorecard:${matchId}`);
  if (val) {
     console.log("✅ Verified data is in Redis.");
  }
  process.exit(0);
}

run();
