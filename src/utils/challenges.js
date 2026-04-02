import { supabase } from '../supabase'

/**
 * Generate a 3-character alphanumeric short ID (A-Z, 0-9)
 */
function generateShortId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Create a new challenge
 */
export async function createChallenge({ matchId, matchName, matchDate, questions }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be logged in to create a challenge')

  const shortId = generateShortId()

  // 1. Extract creator's predictions
  const creatorAnswers = questions.map(q => q.answer)

  // 2. Reset the official challenge questions to be unresolved (-1)
  const dbQuestions = questions.map(q => ({ ...q, answer: -1 }))

  const { data, error } = await supabase
    .from('challenges')
    .insert({
      creator_id: user.id,
      match_id: matchId,
      match_name: matchName,
      match_date: matchDate,
      questions: dbQuestions, // [{question, options[], answer: -1}]
      short_id: shortId,
    })
    .select()
    .single()

  if (error) throw error

  // 3. Automatically submit the creator's response so they participate
  const { error: responseError } = await supabase
    .from('challenge_responses')
    .insert({
      challenge_id: data.id,
      user_id: user.id,
      answers: creatorAnswers,
      score: 0,
    })

  if (responseError) throw responseError

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
  let query = supabase
    .from('challenges')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (friendIds !== null && friendIds.length > 0) {
    query = query.in('creator_id', friendIds)
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

  // --- AUTO-FRIEND FEATURE ---
  // When a user participates in a challenge, automatically become friends with the creator
  try {
    const { data: challengeData } = await supabase
      .from('challenges')
      .select('creator_id')
      .eq('id', challengeId)
      .single()

    if (challengeData && challengeData.creator_id !== user.id) {
      const creatorId = challengeData.creator_id

      // Check if a friendship already exists
      const { data: existingFriendship } = await supabase
        .from('friendships')
        .select('id, status')
        .or(`and(requester_id.eq.${user.id},receiver_id.eq.${creatorId}),and(requester_id.eq.${creatorId},receiver_id.eq.${user.id})`)
        .maybeSingle()

      if (!existingFriendship) {
        // Create an accepted friendship instantly
        await supabase
          .from('friendships')
          .insert({
            requester_id: user.id,
            receiver_id: creatorId,
            status: 'accepted'
          })
      } else if (existingFriendship.status === 'pending') {
        // If it was pending, upgrade it to accepted
        await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', existingFriendship.id)
      }
    }
  } catch (friendErr) {
    console.error('Failed to auto-friend challenge creator:', friendErr)
    // Don't throw the error, we still want the challenge submission to succeed
  }

  return data
}

/**
 * Get responses for a challenge, with profile info (name, avatar)
 */
export async function getChallengeResponses(challengeId) {
  const { data, error } = await supabase
    .from('challenge_responses')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('created_at', { ascending: true })

  if (error) throw error
  const responses = data || []

  if (responses.length === 0) return responses

  // Fetch profiles separately (challenge_responses.user_id -> auth.users, not profiles directly)
  const userIds = [...new Set(responses.map(r => r.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, email')
    .in('id', userIds)

  const profileMap = {}
  ;(profiles || []).forEach(p => { profileMap[p.id] = p })

  return responses.map(r => ({
    ...r,
    profiles: profileMap[r.user_id] || null
  }))
}
