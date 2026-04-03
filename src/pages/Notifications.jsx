import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'

export default function Notifications() {
  const { user } = useAuth()
  const { notifications, notificationsLoading, loadNotifications } = useData()

  useEffect(() => {
    if (user?.id) loadNotifications()
  }, [user?.id])

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000)
    let interval = seconds / 31536000
    if (interval > 1) return Math.floor(interval) + "y ago"
    interval = seconds / 2592000
    if (interval > 1) return Math.floor(interval) + "mo ago"
    interval = seconds / 86400
    if (interval > 1) return Math.floor(interval) + "d ago"
    interval = seconds / 3600
    if (interval > 1) return Math.floor(interval) + "h ago"
    interval = seconds / 60
    if (interval > 1) return Math.floor(interval) + "m ago"
    return "Just now"
  }

  return (
    <div className="page" style={{ minHeight: 'calc(100vh - 64px - 72px)' }}>
      <div className="container" style={{ maxWidth: '600px', padding: '1.5rem 1rem' }}>
        <h1 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Notifications</h1>

        {notificationsLoading && notifications.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <span className="spinner" style={{ width: 32, height: 32 }}></span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {notifications.map(notification => (
              <Link
                to={notification.link}
                key={notification.id}
                className="glass-card"
                style={{
                  padding: '1rem',
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start',
                  borderLeft: !notification.read ? '3px solid var(--gold)' : '3px solid transparent',
                  background: !notification.read ? 'rgba(255, 87, 34, 0.06)' : 'var(--bg-glass)',
                  textDecoration: 'none',
                  transition: 'background var(--transition-fast)'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 87, 34, 0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = !notification.read ? 'rgba(255, 87, 34, 0.06)' : 'var(--bg-glass)'}
              >
                <div style={{
                  fontSize: '1.5rem',
                  background: 'var(--bg-secondary)',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  flexShrink: 0
                }}>
                  {notification.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0 }}>{notification.title}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '0.5rem' }}>
                      {getTimeAgo(notification.time)}
                    </span>
                  </div>
                  <p style={{
                    margin: 0,
                    fontSize: '0.9rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {notification.message}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!notificationsLoading && notifications.length === 0 && (
          <div className="glass-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Notifications Yet</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              When friends create challenges or the AI Umpire updates a match, you'll see it here!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
