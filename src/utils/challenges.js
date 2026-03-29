import { supabase } from '../supabase'

/**
 * Create a new challenge
 */
export async function createChallenge({ matchId, matchName, matchDate, questions }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be logged in to create a challenge')

  const { data, error } = await supabase
    .from('challenges')
    .insert({
      creator_id: user.id,
      match_id: matchId,
      match_name: matchName,
      match_date: matchDate,
      questions: questions, // [{question, options[], answer}]
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Fetch a single challenge by ID
 */
export async function getChallenge(challengeId) {
  const { data, error } = await supabase
    .from('challenges')
    .select('*')
    .eq('id', challengeId)
    .single()

  if (error) throw error
  return data
}

/**
 * Fetch recent challenges for the feed
 * @param {string[]} friendIds - if provided, only return challenges from these users + self
 */
export async function getRecentChallenges(friendIds = null, limit = 20) {
  // Get start of today
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let query = supabase
    .from('challenges')
    .select('*')
    .gte('match_date', today.toISOString())
    .order('match_date', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (friendIds !== null && friendIds.length > 0) {
    query = query.in('creator_id', friendIds)
  } else if (friendIds !== null && friendIds.length === 0) {
    // No friends yet — return empty
    return []
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * Submit a response to a challenge
 */
export async function submitChallengeResponse({ challengeId, answers, score }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be logged in to respond')

  const { data, error } = await supabase
    .from('challenge_responses')
    .upsert({
      challenge_id: challengeId,
      user_id: user.id,
      answers: answers,
      score: score,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Get responses for a challenge
 */
export async function getChallengeResponses(challengeId) {
  const { data, error } = await supabase
    .from('challenge_responses')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('score', { ascending: false })

  if (error) throw error
  return data || []
}
