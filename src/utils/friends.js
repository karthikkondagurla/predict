import { supabase } from '../supabase'

/**
 * Get current user's friend IDs (accepted friendships)
 */
export async function getFriendIds() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('friendships')
    .select('requester_id, receiver_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)

  if (error) throw error

  return (data || []).map(f =>
    f.requester_id === user.id ? f.receiver_id : f.requester_id
  )
}

/**
 * Get accepted friends with their profiles
 */
export async function getFriends() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('friendships')
    .select('id, status, requester_id, receiver_id, created_at, requester:profiles!requester_id(*), receiver:profiles!receiver_id(*)')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)

  if (error) throw error

  return (data || []).map(f => ({
    friendshipId: f.id,
    friend: f.requester_id === user.id ? f.receiver : f.requester,
    since: f.created_at,
  }))
}

/**
 * Get accepted friends for any specific user
 */
export async function getUserFriends(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('id, status, requester_id, receiver_id, created_at, requester:profiles!requester_id(*), receiver:profiles!receiver_id(*)')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)

  if (error) throw error

  return (data || []).map(f => ({
    friendshipId: f.id,
    friend: f.requester_id === userId ? f.receiver : f.requester,
    since: f.created_at,
  }))
}

/**
 * Get pending friend requests (incoming to current user)
 */
export async function getPendingRequests() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('friendships')
    .select('id, created_at, requester:profiles!requester_id(*)')
    .eq('receiver_id', user.id)
    .eq('status', 'pending')

  if (error) throw error
  return data || []
}

/**
 * Get sent friend requests (outgoing from current user)
 */
export async function getSentRequests() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('friendships')
    .select('id, created_at, receiver:profiles!receiver_id(*)')
    .eq('requester_id', user.id)
    .eq('status', 'pending')

  if (error) throw error
  return data || []
}

/**
 * Send a friend request to another user
 */
export async function sendFriendRequest(receiverId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be logged in')

  const { data, error } = await supabase
    .from('friendships')
    .insert({ requester_id: user.id, receiver_id: receiverId })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(friendshipId) {
  const { data, error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Decline or remove a friendship
 */
export async function removeFriendship(friendshipId) {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId)

  if (error) throw error
}

/**
 * Search users by name or email (excludes self)
 */
export async function searchUsers(query) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !query.trim()) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', user.id)
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10)

  if (error) throw error
  return data || []
}

/**
 * Check friendship status with a specific user
 */
export async function getFriendshipStatus(otherUserId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('friendships')
    .select('id, status, requester_id')
    .or(`and(requester_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
    .maybeSingle()

  return data // null = no relationship
}
