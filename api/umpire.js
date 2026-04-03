import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);
const geminiKeys = process.env.GEMINI_KEYS
  ? process.env.GEMINI_KEYS.split(',').map(k => k.trim()).filter(Boolean)
  : [process.env.GEMINI_API_KEY].filter(Boolean);

const cricApiKeys = process.env.CRICAPI_KEYS
  ? process.env.CRICAPI_KEYS.split(',').map(k => k.trim()).filter(Boolean)
  : [process.env.VITE_CRICAPI_KEY].filter(Boolean);

const genAI = new GoogleGenerativeAI(geminiKeys[0] || '');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  reconnectOnError: (err) => ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'].some(e => err.message.includes(e))
});

async function getMatchScorecard(matchId) {
  const cachedScorecard = await redis.get(`scorecard:${matchId}`);
  if (cachedScorecard) {
    return JSON.parse(cachedScorecard);
  }

  if (cricApiKeys.length > 0) {
    console.log(`📡 Fetching from CricAPI for match ${matchId}... key: ${cricApiKeys[0]}`);
    const res = await fetch(`https://api.cricapi.com/v1/match_scorecard?apikey=${cricApiKeys[0]}&id=${matchId}`);
    const data = await res.json();
    if (data.status === 'success' && data.data) {
        await redis.set(`scorecard:${matchId}`, JSON.stringify(data.data), 'EX', 600);
        return data.data;
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (geminiKeys.length === 0 || cricApiKeys.length === 0) {
    return res.status(500).json({ status: 'error', reason: 'Missing API Keys' });
  }

  try {
    const { data: challenges, error: fetchErr } = await supabase
      .from('challenges')
      .select('*')
      .eq('is_resolved', false);

    if (fetchErr || !challenges || challenges.length === 0) {
      return res.status(200).json({ status: 'success', message: 'No pending challenges found.' });
    }

    // Group challenges by match_id to avoid redundant CricAPI calls
    const matchIds = [...new Set(challenges.map(c => c.match_id))];
    const matchScorecards = {};

    console.log(`📡 Fetching live scorecards for ${matchIds.length} matches from Redis/API...`);
    for (const matchId of matchIds) {
      const scorecard = await getMatchScorecard(matchId);
      if (scorecard) {
        matchScorecards[matchId] = scorecard;
      }
    }

    let resolvedCount = 0;

    for (const challenge of challenges) {
      const liveScorecard = matchScorecards[challenge.match_id];
      if (!liveScorecard) {
        console.log(`⚠️ No live scorecard available for match ${challenge.match_id}, skipping. ${JSON.stringify(matchScorecards)}`);
        continue;
      }

      console.log(`🏏 Match ${challenge.match_name} detected! Evaluating pending questions for Challenge ${challenge.id}...`);

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });

      // Crucial Fix: Only grade questions that lack a RESOLVED status flag
      const questionsToGrade = challenge.questions.map((q, i) => ({ ...q, originalIndex: i }))
                                                  .filter(q => q.status !== "RESOLVED");

      if (questionsToGrade.length === 0) continue; 

      const prompt = `
You are an expert incremental cricket AI Umpire. Analyze the provided match scorecard and cautiously evaluate ONLY the specific pending questions.

MATCH SCORECARD:
${JSON.stringify(liveScorecard)}

PENDING QUESTIONS TO GRADE:
${questionsToGrade.map(q => `Q_IDX_${q.originalIndex}: ${q.question} (Options: ${q.options.map((o, j) => `${j}:${o}`).join(', ')})`).join('\n')}

STRICT RULES (NO HALLUCINATION):
1. The match might be LIVE (matchEnded: false) or already over (matchEnded: true). Look closely at the scorecard.
2. BE EXTREMELY STRICT ABOUT EVENTS NOT CONCLUDING YET. Never assume or project future outcomes.
3. If checking a batsman's final score (e.g. ">50"), check the "dismissal-text" or "out" status. If they are "not out" and the innings isn't over, the event has not concluded. return "UNRESOLVED". You can only grade a batsman's score if they are definitively "out" (dismissed), or if the innings is completely over.
4. If a question is about who wins the match/Man of the Match, and matchEnded is false, return "UNRESOLVED".
5. If there is absolute evidence in the scorecard that the specific event for the question has concluded permanently, return "RESOLVED" and provide the correct "answer_index" (0-based) and "result_text". 
6. When "RESOLVED", if the true answer is NOT in the options, set "answer_index" to null.
7. Be smart about abbreviations or shortened names in the options (e.g., "csk" matches "chennai super kings", "RR" matches "Rajasthan Royals", "MS Dhoni" matches "Mahendra Singh Dhoni").

Format your exact JSON response as an array of objects corresponding to the questions asked, respecting their original order:
[
  { "status": "RESOLVED", "answer_index": 0, "result_text": "Virat Kohli was dismissed lbw for 35 runs" },
  { "status": "UNRESOLVED", "answer_index": null, "result_text": "Match is still live, winner undecided" }
]
      `;

      const result = await model.generateContent(prompt);
      let geminiResults = [];
      try {
         geminiResults = JSON.parse(result.response.text());
      } catch (e) {
         console.error("Failed to parse Gemini JSON for challenge", challenge.id, e);
         continue;
      }

      let hasNewResolvedQuestions = false;
      const newlyResolvedQuestionIndexes = [];

      geminiResults.forEach((res, indexInList) => {
         const origIndex = questionsToGrade[indexInList].originalIndex;
         if (res.status === "RESOLVED") {
            // DO NOT OVERWRITE q.answer (which is the creator's prediction).
            challenge.questions[origIndex].official_answer = res.answer_index;
            challenge.questions[origIndex].status = "RESOLVED";
            hasNewResolvedQuestions = true;
            newlyResolvedQuestionIndexes.push({ origIndex, res });
            resolvedCount++;
         }
      });

      if (!hasNewResolvedQuestions) continue;

      const { data: rawResponses } = await supabase
        .from('challenge_responses')
        .select('*')
        .eq('challenge_id', challenge.id);

      let responses = rawResponses || [];
      
      // Synthesize the creator's response so they are included in grading!
      const { data: creatorProfile } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .eq('id', challenge.creator_id)
          .single();

      const creatorAnswers = challenge.questions.map(q => q.answer); // creator's predictions
      const creatorResponse = {
         id: 'creator-' + challenge.id,
         user_id: challenge.creator_id,
         answers: creatorAnswers,
         score: 0, // will be calculated below
         profiles: creatorProfile || null,
         is_creator: true
      };
      
      responses.unshift(creatorResponse);

      // Fetch profiles for normal participants
      if (responses.length > 1) {
        const userIds = [...new Set(responses.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .in('id', userIds);
        
        const profileMap = {};
        (profiles || []).forEach(p => { profileMap[p.id] = p; });
        responses = responses.map(r => r.is_creator ? r : { ...r, profiles: profileMap[r.user_id] || null });
      }

      // Calculate Running Scores for everyone based on ALL resolved questions so far
      for (const resp of responses) {
         let score = 0;
         challenge.questions.forEach((q, i) => {
           if (q.status === 'RESOLVED' && q.official_answer !== null && resp.answers[i] === q.official_answer) {
             score += 20;
           }
         });
         resp.score = score;
         if (!resp.is_creator) {
            await supabase.from('challenge_responses').update({ score }).eq('id', resp.id);
         }
      }

      // 5. Generate a Feed Post specifically for each newly resolved question
      for (const { origIndex, res: aiRes } of newlyResolvedQuestionIndexes) {
         const q = challenge.questions[origIndex];
         const officialAnsText = aiRes.result_text || (q.official_answer !== null ? q.options[q.official_answer] : "None of the options");
         
         const participants = responses.map(resp => {
           const name = resp.profiles?.full_name || resp.profiles?.email?.split('@')[0] || 'Unknown User';
           const img = resp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
           const isCorrect = q.official_answer !== null && resp.answers[origIndex] === q.official_answer;
           return {
              id: resp.user_id,
              n: name,
              img: img,
              pts: isCorrect ? "+20" : "+0", 
              ok: isCorrect,
              ans: resp.answers[origIndex] >= 0 ? q.options[resp.answers[origIndex]] : "Skipped" 
           };
         });

         const postData = {
            type: 'q_result',
            q: q.question,
            off: officialAnsText,
            total_q: challenge.questions.length,
            parts: participants
         };

         await supabase.from('feed_posts').insert({
           challenge_id: challenge.id,
           creator_id: challenge.creator_id,
           match_id: challenge.match_id,
           match_name: challenge.match_name,
           content: postData
         });
      }

      const isCompletelyResolved = challenge.questions.every(q => q.status === 'RESOLVED');

      if (isCompletelyResolved) {
         const leaderboardParticipants = responses.map(resp => {
            const name = resp.profiles?.full_name || resp.profiles?.email?.split('@')[0] || 'Unknown User';
            const img = resp.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
            return { id: resp.user_id, n: name, img, score: resp.score };
         }).sort((a, b) => b.score - a.score);

         leaderboardParticipants.forEach((p, idx) => {
            if (p.score === 0) p.medal = '💔';
            else if (idx === 0) p.medal = '🥇';
            else if (idx === 1) p.medal = '🥈';
            else if (idx === 2) p.medal = '🥉';
            else p.medal = '🏅';
         });

         const leaderboardData = {
            type: 'leaderboard',
            match_name: challenge.match_name,
            short_id: challenge.short_id,
            total_q: challenge.questions.length,
            parts: leaderboardParticipants
         };

         await supabase.from('feed_posts').insert({
            challenge_id: challenge.id,
            creator_id: challenge.creator_id,
            match_id: challenge.match_id,
            match_name: challenge.match_name,
            content: leaderboardData
         });
      }

      await supabase.from('challenges').update({ 
        is_resolved: isCompletelyResolved,
        questions: challenge.questions 
      }).eq('id', challenge.id);
    }
    
    return res.status(200).json({ status: 'success', message: `Processed increments utilizing Live CricAPI data. Newly resolved questions: ${resolvedCount}` });
  } catch (error) {
    console.error('❌ AI Umpire Error:', error);
    return res.status(500).json({ status: 'error', reason: error.message });
  }
}
