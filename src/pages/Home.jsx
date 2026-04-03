import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import MatchCard from '../components/MatchCard'
import ChallengeCard from '../components/ChallengeCard'
import FeedPost from '../components/FeedPost'

export default function Home() {
  const { user } = useAuth()
  const { matches, matchesLoading, loadMatches, feedItems, feedLoading, loadFeed } = useData()

  useEffect(() => {
    loadMatches()
    if (user?.id) loadFeed()
  }, [user?.id])

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
        {matchesLoading && matches.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0' }}>
            <span className="spinner" style={{ width: 40, height: 40, marginBottom: '1rem' }}></span>
            <p style={{ color: 'var(--text-secondary)' }}>Loading today's IPL matches...</p>
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

          {feedLoading && feedItems.length === 0 ? (
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
