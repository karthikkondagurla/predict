import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import { fetchCurrentMatches } from '../utils/api'
import { getRecentChallenges } from '../utils/challenges'
import { getFriendIds, getFriends, getPendingRequests, getSentRequests } from '../utils/friends'
import { supabase } from '../supabase'

const DataContext = createContext(null)

const STALE_MS = 60_000 // re-fetch if data is older than 60s

export function DataProvider({ children }) {
  const { user } = useAuth()

  // --- matches ---
  const [matches, setMatches] = useState([])
  const [matchesLoading, setMatchesLoading] = useState(false)
  const matchesFetchedAt = useRef(null)

  // --- feed ---
  const [feedItems, setFeedItems] = useState([])
  const [feedLoading, setFeedLoading] = useState(false)
  const feedFetchedAt = useRef(null)

  // --- notifications ---
  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const notificationsFetchedAt = useRef(null)

  // --- profile ---
  const [activity, setActivity] = useState([])
  const [friends, setFriends] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [sentRequests, setSentRequests] = useState([])
  const [stats, setStats] = useState({ pts: 0, percentage: 0, challenges: 0 })
  const [profileLoading, setProfileLoading] = useState(false)
  const profileFetchedAt = useRef(null)

  const isStale = (ref) => !ref.current || Date.now() - ref.current > STALE_MS

  // ---- MATCHES ----
  const loadMatches = useCallback(async ({ force = false } = {}) => {
    if (!force && !isStale(matchesFetchedAt)) return
    setMatchesLoading(true)
    try {
      const data = await fetchCurrentMatches()
      setMatches(Array.isArray(data) ? data : [])
      matchesFetchedAt.current = Date.now()
    } catch (err) {
      console.error('Failed to load matches:', err)
    } finally {
      setMatchesLoading(false)
    }
  }, [])

  // ---- FEED ----
  const loadFeed = useCallback(async ({ force = false } = {}) => {
    if (!user?.id) return
    if (!force && !isStale(feedFetchedAt)) return
    setFeedLoading(true)
    try {
      const ids = await getFriendIds(user.id)
      const allowedIds = [...ids, user.id]

      const [createdChallenges, { data: participatedData }] = await Promise.all([
        getRecentChallenges(allowedIds, 20),
        supabase
          .from('challenge_responses')
          .select('created_at, challenges(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20)
      ])

      const allChallengesMap = {}
      createdChallenges.forEach(c => allChallengesMap[c.id] = { type: 'challenge', data: c, date: new Date(c.created_at) })
      if (participatedData) {
        participatedData.forEach(p => {
          if (p.challenges && !allChallengesMap[p.challenges.id]) {
            allChallengesMap[p.challenges.id] = { type: 'challenge', data: p.challenges, date: new Date(p.created_at) }
          }
        })
      }
      const formattedChallenges = Object.values(allChallengesMap)
      const challengeIds = formattedChallenges.map(c => c.data.id)

      let postsQuery = supabase.from('feed_posts').select('*').order('created_at', { ascending: false }).limit(30)
      if (challengeIds.length > 0 && ids.length > 0) {
        postsQuery = postsQuery.or(`creator_id.in.(${allowedIds.join(',')}),challenge_id.in.(${challengeIds.join(',')})`)
      } else if (challengeIds.length > 0) {
        postsQuery = postsQuery.or(`creator_id.eq.${user.id},challenge_id.in.(${challengeIds.join(',')})`)
      } else {
        postsQuery = postsQuery.in('creator_id', allowedIds)
      }

      const { data: posts } = await postsQuery
      const uniquePostsMap = {}
      ;(posts || []).forEach(p => uniquePostsMap[p.id] = { type: 'post', data: p, date: new Date(p.created_at) })

      const combined = [...formattedChallenges, ...Object.values(uniquePostsMap)].sort((a, b) => b.date - a.date)
      setFeedItems(combined)
      feedFetchedAt.current = Date.now()
    } catch (err) {
      console.error('Failed to load feed:', err)
    } finally {
      setFeedLoading(false)
    }
  }, [user?.id])

  // ---- NOTIFICATIONS ----
  const loadNotifications = useCallback(async ({ force = false } = {}) => {
    if (!user?.id) return
    if (!force && !isStale(notificationsFetchedAt)) return
    setNotificationsLoading(true)
    try {
      const friendIds = await getFriendIds(user.id)
      let newNotifications = []

      const queries = [
        supabase
          .from('challenge_responses')
          .select('challenge_id')
          .eq('user_id', user.id)
      ]
      if (friendIds.length > 0) {
        queries.push(
          supabase.from('challenges').select('id, created_at, match_name, creator_id')
            .in('creator_id', friendIds).order('created_at', { ascending: false }).limit(10),
          supabase.from('profiles').select('id, full_name, email').in('id', friendIds)
        )
      }

      const [participatedRes, friendChallengesRes, profilesRes] = await Promise.all(queries)

      if (friendIds.length > 0 && friendChallengesRes?.data?.length > 0) {
        const profileMap = {}
        profilesRes?.data?.forEach(p => profileMap[p.id] = p)
        friendChallengesRes.data.forEach(c => {
          const friendName = profileMap[c.creator_id]?.full_name || profileMap[c.creator_id]?.email?.split('@')[0] || 'A friend'
          newNotifications.push({
            id: `chall-${c.id}`, type: 'challenge', icon: '🏏',
            title: 'Friend Activity',
            message: `${friendName} created a new challenge for ${c.match_name}.`,
            time: new Date(c.created_at), link: `/challenge/${c.id}`, read: true
          })
        })
      }

      const participatedIds = (participatedRes?.data || []).map(p => p.challenge_id)
      if (participatedIds.length > 0) {
        const { data: feedPosts } = await supabase
          .from('feed_posts').select('*')
          .in('challenge_id', participatedIds)
          .order('created_at', { ascending: false }).limit(20)

        ;(feedPosts || []).forEach(post => {
          let contentData = {}
          try { contentData = typeof post.content === 'string' ? JSON.parse(post.content) : post.content } catch {}
          if (contentData.type === 'q_result') {
            newNotifications.push({
              id: `post-${post.id}`, type: 'umpire', icon: '🤖',
              title: 'AI Umpire Analysis',
              message: `Question resolved: "${contentData.q}" ➡️ ${contentData.off}`,
              time: new Date(post.created_at), link: `/challenge/${post.challenge_id}`, read: false
            })
          } else if (contentData.type === 'leaderboard') {
            newNotifications.push({
              id: `post-${post.id}`, type: 'leaderboard', icon: '🏆',
              title: 'Challenge Results',
              message: `Final results are in for ${post.match_name}! See the final standings.`,
              time: new Date(post.created_at), link: `/challenge/${post.challenge_id}`, read: false
            })
          }
        })
      }

      newNotifications.sort((a, b) => b.time - a.time)
      setNotifications(newNotifications)
      notificationsFetchedAt.current = Date.now()
    } catch (err) {
      console.error('Failed to load notifications:', err)
    } finally {
      setNotificationsLoading(false)
    }
  }, [user?.id])

  // ---- PROFILE ----
  const loadProfile = useCallback(async ({ force = false } = {}) => {
    if (!user?.id) return
    if (!force && !isStale(profileFetchedAt)) return
    setProfileLoading(true)
    try {
      const [f, p, s, { data: challengesData }, { data: participatedData }] = await Promise.all([
        getFriends(),
        getPendingRequests(),
        getSentRequests(),
        supabase.from('challenges').select('*').eq('creator_id', user.id)
          .order('created_at', { ascending: false }).limit(50),
        supabase.from('challenge_responses').select('created_at, score, answers, challenges(*)')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1000)
      ])

      setFriends(f || [])
      setPendingRequests(p || [])
      setSentRequests(s || [])

      const formattedChallenges = (challengesData || []).map(c => ({ type: 'challenge', data: c, date: new Date(c.created_at) }))

      let totalPoints = 0, totalGraded = 0, correct = 0
      const totalChallenges = (participatedData || []).length
      ;(participatedData || []).forEach(response => {
        totalPoints += response.score || 0
        const challenge = response.challenges
        if (challenge?.questions && response.answers) {
          challenge.questions.forEach((q, idx) => {
            if (q.answer !== -1 && q.answer !== null && q.answer !== undefined) {
              totalGraded++
              if (response.answers[idx] === q.answer) correct++
            }
          })
        }
      })
      setStats({ pts: totalPoints, percentage: totalGraded > 0 ? Math.round((correct / totalGraded) * 100) : 0, challenges: totalChallenges })

      const formattedParticipated = (participatedData || [])
        .filter(p => p.challenges && p.challenges.creator_id !== user.id)
        .map(p => ({ type: 'challenge', data: p.challenges, date: new Date(p.created_at) }))

      const allChallengeIds = [...new Set([
        ...(challengesData || []).map(c => c.id),
        ...formattedParticipated.map(p => p.data.id)
      ])]

      let formattedPosts = []
      if (allChallengeIds.length > 0) {
        const { data: postsData } = await supabase.from('feed_posts').select('*')
          .in('challenge_id', allChallengeIds).order('created_at', { ascending: false }).limit(100)
        const uniquePostsMap = {}
        ;(postsData || []).forEach(p => uniquePostsMap[p.id] = p)
        formattedPosts = Object.values(uniquePostsMap).map(p => ({ type: 'post', data: p, date: new Date(p.created_at) }))
      }

      const combined = [...formattedChallenges, ...formattedParticipated, ...formattedPosts].sort((a, b) => b.date - a.date)
      setActivity(combined)
      profileFetchedAt.current = Date.now()
    } catch (err) {
      console.error('Failed to load profile:', err)
    } finally {
      setProfileLoading(false)
    }
  }, [user?.id])

  const value = {
    matches, matchesLoading, loadMatches,
    feedItems, feedLoading, loadFeed,
    notifications, notificationsLoading, loadNotifications,
    activity, friends, pendingRequests, sentRequests, stats, profileLoading, loadProfile,
    setFriends, setPendingRequests, setSentRequests,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
