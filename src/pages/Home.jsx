import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { fetchCurrentMatches } from '../utils/api'
import MatchCard from '../components/MatchCard'

export default function Home() {
  const { user } = useAuth()
  const [matches, setMatches] = useState([])
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

  useEffect(() => {
    loadMatches()
  }, [])

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '1000px' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Live Matches</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Welcome back, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}!</p>
          </div>
          {!loading && (
            <button
              className="btn btn-secondary"
              onClick={loadMatches}
              style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
            >
              🔄 Refresh
            </button>
          )}
        </div>

        {/* Content */}
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
          <div className="empty-state">
            <div className="empty-icon">🏏</div>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No IPL Matches Today</h2>
            <p>There are no IPL matches scheduled or live for today.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {matches.map(match => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

