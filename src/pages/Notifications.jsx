import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabase'
import { getFriendIds } from '../utils/friends'

export default function Notifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    loadNotifications()
  }, [user])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      // 1. Get friend IDs
      const friendIds = await getFriendIds()

      let newNotifications = []

      // 2. Fetch challenges created by friends
      if (friendIds.length > 0) {
        const { data: friendChallenges } = await supabase
          .from('challenges')
          .select('id, created_at, match_name, creator_id')
          .in('creator_id', friendIds)
          .order('created_at', { ascending: false })
          .limit(10)

        if (friendChallenges && friendChallenges.length > 0) {
          // Fetch friend profiles
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', friendIds)

          const profileMap = {}
          profiles?.forEach(p => profileMap[p.id] = p)

          friendChallenges.forEach(c => {
            const friendName = profileMap[c.creator_id]?.full_name || profileMap[c.creator_id]?.email?.split('@')[0] || 'A friend'
            newNotifications.push({
              id: `chall-${c.id}`,
              type: 'challenge',
              icon: '🏏',
              title: 'Friend Activity',
              message: `${friendName} created a new challenge for ${c.match_name}.`,
              time: new Date(c.created_at),
              link: `/challenge/${c.id}`,
              read: true
            })
          })
        }
      }

      // 3. Fetch challenges user has participated in to get feed updates
      const { data: participatedData } = await supabase
        .from('challenge_responses')
        .select('challenge_id')
        .eq('user_id', user.id)

      if (participatedData && participatedData.length > 0) {
        const participatedChallengeIds = participatedData.map(p => p.challenge_id)

        // 4. Fetch feed posts for these challenges
        const { data: feedPosts } = await supabase
          .from('feed_posts')
          .select('*')
          .in('challenge_id', participatedChallengeIds)
          .order('created_at', { ascending: false })
          .limit(20)

        if (feedPosts) {
          feedPosts.forEach(post => {
            let contentData = {}
            try {
              contentData = typeof post.content === 'string' ? JSON.parse(post.content) : post.content
            } catch (e) {}

            if (contentData.type === 'q_result') {
              newNotifications.push({
                id: `post-${post.id}`,
                type: 'umpire',
                icon: '🤖',
                title: 'AI Umpire Analysis',
                message: `Question resolved: "${contentData.q}" ➡️ ${contentData.off}`,
                time: new Date(post.created_at),
                link: `/challenge/${post.challenge_id}`,
                read: false
              })
            } else if (contentData.type === 'leaderboard') {
              newNotifications.push({
                id: `post-${post.id}`,
                type: 'leaderboard',
                icon: '🏆',
                title: 'Challenge Results',
                message: `Final results are in for ${post.match_name}! See the final standings.`,
                time: new Date(post.created_at),
                link: `/challenge/${post.challenge_id}`,
                read: false
              })
            }
          })
        }
      }

      // Sort by time descending
      newNotifications.sort((a, b) => b.time - a.time)
      setNotifications(newNotifications)

    } catch (err) {
      console.error('Failed to load notifications:', err)
    } finally {
      setLoading(false)
    }
  }

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

        {loading ? (
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

        {!loading && notifications.length === 0 && (
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
