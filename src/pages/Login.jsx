import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth()
  const [authLoading, setAuthLoading] = useState(false)
  const [error, setError] = useState(null)

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" style={{ width: 40, height: 40 }}></span>
      </div>
    )
  }

  // If already authenticated, redirect to the matches (Home) page
  if (user) {
    return <Navigate to="/home" replace />
  }

  const handleGoogleSignIn = async () => {
    setAuthLoading(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please try again.')
      setAuthLoading(false)
    }
  }

  return (
    <div className="page" style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-box" style={{ textAlign: 'center', padding: '3rem', width: '100%', maxWidth: '440px', boxShadow: 'var(--shadow-lg)' }}>
        
        {/* Logo / emoji */}
        <div style={{ fontSize: '4rem', marginBottom: '1rem', animation: 'float 3s ease-in-out infinite' }}>🏏</div>
        <h1 style={{ 
          marginBottom: '0.5rem', 
          color: 'var(--text-primary)',
          fontSize: '2rem',
          background: 'linear-gradient(135deg, var(--gold) 0%, #fff 60%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          CREASE
        </h1>
        <p style={{ fontSize: '1rem', marginBottom: '2rem', color: 'var(--text-secondary)' }}>
          Sign in to create or join a challenge with friends.
        </p>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--radius-sm)', padding: '0.75rem', marginBottom: '1.5rem',
            color: '#fc8181', fontSize: '0.85rem',
          }}>
            {error}
          </div>
        )}

        <button
          id="google-signin-btn"
          className="btn btn-secondary"
          onClick={handleGoogleSignIn}
          disabled={authLoading}
          style={{
            width: '100%', justifyContent: 'center', gap: '0.75rem',
            padding: '1rem', fontSize: '1.1rem',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-glass)',
            transition: 'all var(--transition-fast)'
          }}
          onMouseEnter={e => {
            if (!authLoading) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
          }}
          onMouseLeave={e => {
            if (!authLoading) e.currentTarget.style.background = 'var(--bg-glass)'
          }}
        >
          {authLoading ? (
            <span className="spinner" />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          {authLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <p style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          By signing in, you agree to our Terms of Service. No passwords stored — Google handles everything securely.
        </p>
      </div>
    </div>
  )
}
