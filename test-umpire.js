import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config({ path: '.env' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// 1. Mock CricAPI Scorecard Data
const mockScorecard = {
  id: "mock-match-123",
  name: "Mumbai Indians vs Chennai Super Kings",
  matchType: "t20",
  status: "Chennai Super Kings won by 7 wickets",
  matchEnded: true,
  venue: "Wankhede Stadium, Mumbai",
  teams: ["Mumbai Indians", "Chennai Super Kings"],
  playerOfTheMatch: [
    {
      id: "player-1",
      name: "Mahendra Singh Dhoni",
      shortname: "MS Dhoni"
    }
  ],
  score: [
    { r: 180, w: 5, o: 20, inning: "Mumbai Indians Inning 1" },
    { r: 181, w: 3, o: 19.2, inning: "Chennai Super Kings Inning 1" }
  ],
  scorecard: [
    {
      inning: "Mumbai Indians Inning 1",
      batting: [
        { batsman: { name: "Rohit Sharma" }, r: 65, b: 40, "4s": 6, "6s": 3, "dismissal-text": "c Jadeja b Chahar" },
        { batsman: { name: "Ishan Kishan" }, r: 20, b: 15, "4s": 2, "6s": 1, "dismissal-text": "not out" }
      ],
      bowling: [
        { bowler: { name: "Deepak Chahar" }, o: 4, m: 0, r: 30, w: 2, eco: 7.5 }
      ]
    },
    {
      inning: "Chennai Super Kings Inning 1",
      batting: [
        { batsman: { name: "MS Dhoni" }, r: 85, b: 35, "4s": 5, "6s": 8, "dismissal-text": "not out" },
        { batsman: { name: "Ruturaj Gaikwad" }, r: 40, b: 30, "4s": 4, "6s": 1, "dismissal-text": "b Bumrah" }
      ],
      bowling: [
        { bowler: { name: "Jasprit Bumrah" }, o: 4, m: 0, r: 25, w: 2, eco: 6.25 }
      ]
    }
  ]
};

// 2. Mock Challenge Questions
const mockChallenge = {
  id: "challenge-999",
  match_name: "Mumbai Indians vs Chennai Super Kings",
  questions: [
    {
      question: "Who will win the match?",
      options: ["Mumbai Indians", "Chennai Super Kings"],
      answer: -1
    },
    {
      question: "Who will be the Man of the Match?",
      options: ["Rohit Sharma", "MS Dhoni", "Jasprit Bumrah", "Ruturaj Gaikwad"],
      answer: -1
    },
    {
      question: "How many runs will Rohit score?",
      options: ["<50", "50-80", ">80"],
      answer: -1
    },
    {
      question: "Did Ishan Kishan get out?",
      options: ["Yes", "No"],
      answer: -1
    }
  ]
};

async function testUmpire() {
  console.log('🤖 Starting Mock AI Umpire Test...\n');

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", // Using the upgraded model for better accuracy
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
You are an expert cricket AI Umpire. Analyze the following match scorecard and evaluate each question.

MATCH SCORECARD:
${JSON.stringify(mockScorecard)}

CHALLENGE QUESTIONS:
${mockChallenge.questions.map((q, i) => `Q${i}: ${q.question} (Options: ${q.options.map((o, j) => `${j}:${o}`).join(', ')})`).join('\n')}

1. Evaluate the question against the scorecard. For "Man of the Match", explicitly look for fields like "playerOfTheMatch" or "manOfTheMatch" in the JSON. Do NOT assume the top run scorer is the Man of the Match.
2. BE SMART ABOUT NAME MATCHING. If the options contain a typo, a first name, or a phonetic equivalent (e.g., "suryavamshi" matches "Vaibhav Sooryavanshi", "MS Dhoni" matches "Mahendra Singh Dhoni"), consider that option CORRECT.
3. Check the "dismissal-text" or "out" fields for questions about whether a player got out. "not out" means they did not get out.
4. If the correct answer (accounting for loose name matching) IS among the options, set "answer_index" to that option's 0-based index.
5. ONLY if the correct answer is TRULY NOT among the options in any form, set "answer_index" to null. 
6. Provide a "result_text" (max 15 words) stating the factual result from the scorecard (e.g. "MS Dhoni won Man of the Match").
7. NEVER guess or hallucinate. Use only the provided data.

Return ONLY a valid JSON array, one object per question, in this exact format:
[
  { "answer_index": 0, "result_text": "Rohit scored 65 runs" },
  { "answer_index": null, "result_text": "Burger won Man of the Match" }
]
    `;

    console.log('📡 Sending data to Gemini API...\n');
    const result = await model.generateContent(prompt);
    
    console.log('✅ Received Response from Gemini:\n');
    const geminiResults = JSON.parse(result.response.text());

    geminiResults.forEach((res, idx) => {
      const q = mockChallenge.questions[idx];
      console.log(`Question ${idx + 1}: ${q.question}`);
      console.log(`Options: ${q.options.join(' | ')}`);
      if (res.answer_index !== null) {
        console.log(`✅ Correct Answer Chosen: [${res.answer_index}] ${q.options[res.answer_index]}`);
      } else {
        console.log(`❌ No correct option found in the list.`);
      }
      console.log(`📝 AI Reasoning/Result: ${res.result_text}\n`);
    });

  } catch (error) {
    console.error('❌ Error during test:', error);
  }
}

testUmpire();
