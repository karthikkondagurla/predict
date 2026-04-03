import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { fetchCurrentMatches } from '../utils/api'
import { getRecentChallenges } from '../utils/challenges'
import { getFriendIds } from '../utils/friends'
import { supabase } from '../supabase'
import MatchCard from '../components/MatchCard'
import ChallengeCard from '../components/ChallengeCard'
import FeedPost from '../components/FeedPost'

export default function Home() {
  const { user } = useAuth()
  const [matches, setMatches] = useState([])
  const [feedItems, setFeedItems] = useState([]) // mixed challenges and posts
  const [friendIds, setFriendIds] = useState(null)
  const [loading, setLoading] = useState(true)
  const [feedLoading, setFeedLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadMatches = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCurrentMatches()
      setMatches(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
      setMatches([])
    } finally {
      setLoading(false)
    }
  }

  const loadFeedData = async () => {
    if (!user?.id) return
    setFeedLoading(true)
    try {
      // 1. Get friend IDs (+ own ID) — pass user.id to skip a redundant auth round-trip
      const ids = await getFriendIds(user.id)
      const allowedIds = [...ids, user.id]
      setFriendIds(ids)

      // Parallelize fetching challenges and participated data
      const [createdChallenges, { data: participatedData }] = await Promise.all([
        getRecentChallenges(allowedIds, 20),
        supabase
          .from('challenge_responses')
          .select('created_at, challenges(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20)
      ])

      // Collect all raw challenges and deduplicate by ID
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

      // 4. Fetch feed posts
      // Posts created by friends/self OR posts belonging to challenges we just fetched
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
      
      // Deduplicate posts
      const uniquePostsMap = {}
      ;(posts || []).forEach(p => uniquePostsMap[p.id] = { type: 'post', data: p, date: new Date(p.created_at) })
      const formattedPosts = Object.values(uniquePostsMap)

      // 5. Combine and sort
      let combined = [...formattedChallenges, ...formattedPosts].sort((a, b) => b.date - a.date)
      
      setFeedItems(combined)

    } catch (err) {
      console.error('Failed to load feed:', err)
    } finally {
      setFeedLoading(false)
    }
  }

  useEffect(() => {
    // Fire both data loads in parallel instead of sequentially
    const initData = async () => {
      await Promise.all([
        loadMatches(),
        user ? loadFeedData() : Promise.resolve()
      ])
    }
    initData()
  }, [user])

  const hasFriends = friendIds !== null && friendIds.length > 0



  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '1000px' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Live Matches</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Welcome back, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}!
            </p>
          </div>

        </div>

        {/* Matches Section */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
            <span className="spinner" style={{ width: 40, height: 40, marginBottom: '1rem' }}></span>
            <p style={{ color: 'var(--text-secondary)' }}>Loading today's IPL matches...</p>
          </div>
        ) : error ? (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h3 style={{ color: '#fc8181', marginBottom: '0.5rem' }}>Failed to Load Data</h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto', marginBottom: '1.5rem' }}>{error}</p>
            <button className="btn btn-primary" onClick={loadMatches}>Try Again</button>
          </div>
        ) : matches.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <div className="empty-icon">🏏</div>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No IPL Matches Today</h2>
            <p>There are no IPL matches scheduled or live for today.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', marginBottom: '2rem' }}>
            {matches.map(match => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}

        {/* Home Feed */}
        <div style={{ marginTop: '1rem' }}>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1.4rem' }}>
            Feed
          </h2>

          {feedLoading ? (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="glass-card" style={{
                  height: '200px',
                  background: 'var(--bg-glass)',
                  animation: 'pulse 1.5s infinite ease-in-out',
                  border: '1px solid var(--border-glass)'
                }}></div>
              ))}
              <style>{`
                @keyframes pulse {
                  0% { opacity: 0.4; }
                  50% { opacity: 0.8; background: rgba(255,255,255,0.05); }
                  100% { opacity: 0.4; }
                }
              `}</style>
            </div>
          ) : feedItems.length === 0 ? (
            <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🏏</div>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No activity yet</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Click a match above to create the first challenge!
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {feedItems.map(item => {
                if (item.type === 'post') return <FeedPost key={`post-${item.data.id}`} post={item.data} />
                if (item.type === 'challenge') return <ChallengeCard key={`chall-${item.data.id}`} challenge={item.data} />
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
