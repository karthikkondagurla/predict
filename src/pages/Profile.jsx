import { useAuth } from '../contexts/AuthContext'

export default function Profile() {
  const { user } = useAuth()

  const avatarUrl = user?.user_metadata?.avatar_url
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  return (
    <div className="page" style={{ minHeight: 'calc(100vh - 64px - 72px)', padding: '2rem' }}>
      <div className="container" style={{ maxWidth: '800px' }}>
        <h1 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Profile</h1>
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="avatar"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 1rem' }}
            />
          ) : null}
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--gold), var(--purple))',
            display: avatarUrl ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '2rem', color: '#fff',
            margin: '0 auto 1rem',
          }}>
            {displayName[0].toUpperCase()}
          </div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{displayName}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{user?.email}</p>
          <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', textAlign: 'left' }}>
            <p style={{ marginBottom: '0.5rem' }}><strong>User ID:</strong> {user?.id}</p>
            <p><strong>Provider:</strong> Google</p>
          </div>
        </div>
      </div>
    </div>
  )
}
