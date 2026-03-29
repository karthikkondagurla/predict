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
  const [error, setError] = useState(null)

  const loadMatches = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCurrentMatches()
      setMatches(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadFeedData = async () => {
    try {
      // 1. Get friend IDs (+ own ID)
      const ids = await getFriendIds()
      const allowedIds = [...ids, user.id]
      setFriendIds(ids)

      // 2. Fetch challenges
      const challenges = await getRecentChallenges(allowedIds, 20)
      const formattedChallenges = challenges.map(c => ({ type: 'challenge', data: c, date: new Date(c.created_at) }))

      // 3. Fetch feed posts
      let postsQuery = supabase.from('feed_posts').select('*').order('created_at', { ascending: false }).limit(20)
      if (ids.length > 0) {
        postsQuery = postsQuery.in('creator_id', allowedIds)
      } else {
        postsQuery = postsQuery.eq('creator_id', user.id)
      }
      const { data: posts } = await postsQuery
      const formattedPosts = (posts || []).map(p => ({ type: 'post', data: p, date: new Date(p.created_at) }))

      // 4. Combine and sort
      const combined = [...formattedChallenges, ...formattedPosts].sort((a, b) => b.date - a.date)
      setFeedItems(combined)

    } catch (err) {
      console.error('Failed to load feed:', err)
    }
  }

  useEffect(() => {
    loadMatches()
    loadFeedData()
  }, [])

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
          {!loading && (
            <button
              className="btn btn-secondary"
              onClick={() => { loadMatches(); loadFeedData() }}
              style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
            >
              🔄 Refresh
            </button>
          )}
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
            🔥 {hasFriends ? "Friends' Activity" : "Your Activity"}
          </h2>

          {feedItems.length === 0 ? (
            <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
              {!hasFriends ? (
                <>
                  <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🤝</div>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Add friends to see activity!</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    Your feed is private to your friends only.
                  </p>
                  <a href="/messages" className="btn btn-primary">Find Friends</a>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🏏</div>
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No activity yet</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Click a match above to create the first challenge!
                  </p>
                </>
              )}
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
