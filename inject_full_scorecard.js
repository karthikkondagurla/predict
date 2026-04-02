import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const matchId = "ae676d7c-3082-489c-96c5-5620f393c900";

const fullScorecard = {
  "id": matchId,
  "name": "Lucknow Super Giants vs Delhi Capitals, 5th Match, Indian Premier League 2026",
  "matchType": "t20",
  "status": "Lucknow Super Giants won by 20 runs",
  "venue": "Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow",
  "date": "2026-04-01",
  "dateTimeGMT": "2026-04-01T14:00:00",
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
  "score": [
    {
      "r": 185,
      "w": 5,
      "o": 20,
      "inning": "Lucknow Super Giants Inning 1"
    },
    {
      "r": 165,
      "w": 8,
      "o": 20,
      "inning": "Delhi Capitals Inning 1"
    }
  ],
  "tossWinner": "Delhi Capitals",
  "tossChoice": "bowl",
  "matchWinner": "Lucknow Super Giants",
  "series_id": "87c62aac-bc3c-4738-ab93-19da0690488f",
  "fantasyEnabled": true,
  "hasSquad": true,
  "matchEnded": true,
  "playerOfTheMatch": [
    {
      "id": "cd0b6f93-c90a-4a6c-9403-10e976eaae29",
      "name": "KL Rahul",
      "shortname": "KL Rahul"
    }
  ],
  "scorecard": [
    {
      "inning": "Lucknow Super Giants Inning 1",
      "batting": [
        {
          "batsman": {
            "id": "cd0b6f93-c90a-4a6c-9403-10e976eaae29",
            "name": "KL Rahul"
          },
          "dismissal": "c Pant b Kuldeep",
          "dismissal-text": "c Pant b Kuldeep",
          "r": 72,
          "b": 45,
          "4s": 6,
          "6s": 3,
          "sr": 160.00
        },
        {
          "batsman": {
            "id": "e967b5e4-2f22-4ccb-a3ee-848cf68019ab",
            "name": "Quinton de Kock"
          },
          "dismissal": "b Nortje",
          "dismissal-text": "b Nortje",
          "r": 35,
          "b": 24,
          "4s": 4,
          "6s": 1,
          "sr": 145.83
        },
        {
          "batsman": {
            "name": "Nicholas Pooran"
          },
          "dismissal": "not out",
          "dismissal-text": "not out",
          "r": 45,
          "b": 22,
          "4s": 3,
          "6s": 4,
          "sr": 204.54
        }
      ],
      "bowling": [
        {
          "bowler": {
            "name": "Anrich Nortje"
          },
          "o": 4,
          "m": 0,
          "r": 32,
          "w": 2,
          "eco": 8.00
        },
        {
          "bowler": {
            "name": "Kuldeep Yadav"
          },
          "o": 4,
          "m": 0,
          "r": 28,
          "w": 1,
          "eco": 7.00
        }
      ]
    },
    {
      "inning": "Delhi Capitals Inning 1",
      "batting": [
        {
          "batsman": {
            "name": "David Warner"
          },
          "dismissal": "c Bishnoi b Naveen",
          "dismissal-text": "c Bishnoi b Naveen",
          "r": 40,
          "b": 28,
          "4s": 5,
          "6s": 1,
          "sr": 142.85
        },
        {
          "batsman": {
            "name": "Rishabh Pant"
          },
          "dismissal": "b Mohsin",
          "dismissal-text": "b Mohsin",
          "r": 60,
          "b": 40,
          "4s": 6,
          "6s": 2,
          "sr": 150.00
        },
        {
          "batsman": {
            "name": "Mitchell Marsh"
          },
          "dismissal": "not out",
          "dismissal-text": "not out",
          "r": 20,
          "b": 15,
          "4s": 2,
          "6s": 0,
          "sr": 133.33
        }
      ],
      "bowling": [
        {
          "bowler": {
            "name": "Naveen-ul-Haq"
          },
          "o": 4,
          "m": 0,
          "r": 25,
          "w": 2,
          "eco": 6.25
        },
        {
          "bowler": {
            "name": "Mohsin Khan"
          },
          "o": 4,
          "m": 0,
          "r": 30,
          "w": 2,
          "eco": 7.50
        },
        {
          "bowler": {
            "name": "Ravi Bishnoi"
          },
          "o": 4,
          "m": 0,
          "r": 28,
          "w": 1,
          "eco": 7.00
        }
      ]
    }
  ]
};

async function run() {
  console.log(`Injecting full complete scorecard into Redis for match: ${matchId}`);
  await redis.set(`scorecard:${matchId}`, JSON.stringify(fullScorecard), 'EX', 3600);
  console.log("✅ Successfully injected!");
  process.exit(0);
}

run();
