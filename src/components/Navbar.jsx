import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [imageError, setImageError] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
    setMenuOpen(false)
  }

  const avatarUrl = user?.user_metadata?.avatar_url
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  // Only show the navbar if the user is authenticated to maintain a clean login page
  if (!user) return null

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(10, 14, 26, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-glass)',
    }}>
      <div className="container" style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: '64px',
      }}>
        {/* Logo */}
        <Link to="/home" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.3rem',
            background: 'linear-gradient(135deg, var(--gold), var(--gold-light))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: '0.02em',
          }}>
            CREASE
          </span>
        </Link>

        {/* Right — Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ position: 'relative' }}>
            <button
              id="profile-avatar-btn"
              onClick={() => setMenuOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
                borderRadius: '40px', padding: '4px 12px 4px 4px',
                cursor: 'pointer', transition: 'all var(--transition-fast)',
              }}
            >
              {avatarUrl && !imageError ? (
                <img 
                  src={avatarUrl} 
                  alt="avatar"
                  onError={() => setImageError(true)}
                  style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--gold), var(--purple))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.9rem', color: '#fff',
                }}>
                  {displayName[0].toUpperCase()}
                </div>
              )}
              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                {displayName.split(' ')[0]}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>▾</span>
            </button>

            {menuOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)', padding: '0.5rem',
                minWidth: 150, boxShadow: 'var(--shadow-card)', zIndex: 200,
                animation: 'fade-in 0.15s ease',
              }}>
                <button onClick={handleSignOut} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)',
                  color: '#fc8181', fontSize: '0.875rem', background: 'none',
                  cursor: 'pointer', transition: 'background var(--transition-fast)',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setMenuOpen(false)} />
      )}
    </nav>
  )
}
