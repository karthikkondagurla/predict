import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { supabase } from '../supabase'
import { getFriendshipStatus, sendFriendRequest, acceptFriendRequest, removeFriendship, searchUsers } from '../utils/friends'
import ChallengeCard from '../components/ChallengeCard'
import FeedPost from '../components/FeedPost'
import Avatar from '../components/Avatar'

export default function Profile() {
  const { user, signOut } = useAuth()
  const {
    activity, friends, pendingRequests, sentRequests, stats,
    profileLoading, loadProfile,
    setFriends, setPendingRequests, setSentRequests,
  } = useData()

  const [mainTab, setMainTab] = useState('activity')
  const [friendsTab, setFriendsTab] = useState('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchStatuses, setSearchStatuses] = useState({})
  const [actionLoading, setActionLoading] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user?.id) loadProfile()
  }, [user?.id])

  // Friend Actions
  const handleSearch = async (q) => {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    try {
      const results = await searchUsers(q)
      setSearchResults(results)
      const statuses = {}
      await Promise.all(results.map(async (u) => {
        statuses[u.id] = await getFriendshipStatus(u.id)
      }))
      setSearchStatuses(statuses)
    } catch (err) {
      console.error(err)
    } finally {
      setSearching(false)
    }
  }

  const handleSendRequest = async (receiverId) => {
    setActionLoading(receiverId)
    try {
      await sendFriendRequest(receiverId)
      const status = await getFriendshipStatus(receiverId)
      setSearchStatuses(p => ({ ...p, [receiverId]: status }))
      await loadProfile({ force: true })
    } catch (err) { setError(err.message) } finally { setActionLoading(null) }
  }

  const handleAccept = async (friendshipId) => {
    setActionLoading(friendshipId)
    try { await acceptFriendRequest(friendshipId); await loadProfile({ force: true }) }
    catch (err) { setError(err.message) } finally { setActionLoading(null) }
  }

  const handleRemove = async (friendshipId) => {
    setActionLoading(friendshipId)
    try { await removeFriendship(friendshipId); await loadProfile({ force: true }) }
    catch (err) { setError(err.message) } finally { setActionLoading(null) }
  }


  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const totalNotifications = (pendingRequests || []).length

  const mainTabStyle = (name) => ({
    flex: 1, padding: '0.85rem', textAlign: 'center', fontWeight: 700, fontSize: '0.85rem',
    textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', background: 'transparent',
    color: mainTab === name ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none',
    borderBottom: mainTab === name ? '2px solid var(--gold)' : '2px solid transparent', transition: 'all 0.2s',
  })

  const subTabStyle = (name) => ({
    padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.85rem',
    cursor: 'pointer', background: friendsTab === name ? 'rgba(255,255,255,0.1)' : 'transparent',
    color: friendsTab === name ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none',
    position: 'relative', flex: 1, textAlign: 'center'
  })

  return (
    <div className="page" style={{ minHeight: 'calc(100vh - 64px - 72px)' }}>
      {/* Header */}
      <div style={{ padding: '2.5rem 1rem 1.5rem', background: 'var(--bg-glass)', borderBottom: '1px solid var(--border-glass)' }}>
        <div className="container" style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Avatar user={{ ...(user?.user_metadata || {}), email: user?.email }} size={96} />
          </div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1.5rem', fontWeight: 700 }}>{displayName}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>{user?.email}</p>

          {/* Stats Bar */}
          <div style={{
            display: 'flex',
            gap: '1.5rem',
            background: 'var(--bg-secondary)',
            padding: '1rem 1.5rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-glass)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--gold)', fontSize: '1.25rem', fontWeight: 800 }}>{stats.percentage}%</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prediction</div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-glass)' }}></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 800 }}>{stats.pts}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pts</div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-glass)' }}></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 800 }}>{stats.challenges}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Challenges</div>
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ maxWidth: '800px', padding: 0 }}>
        {/* Main Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-secondary)', position: 'sticky', top: 64, zIndex: 10 }}>
          <button style={mainTabStyle('activity')} onClick={() => setMainTab('activity')}>
            Activity
          </button>
          <button style={mainTabStyle('friends')} onClick={() => setMainTab('friends')}>
            Friends <span style={{ color: mainTab === 'friends' ? 'var(--text-primary)' : 'var(--text-muted)', marginLeft: '0.25rem', fontWeight: 400, opacity: mainTab === 'friends' ? 1 : 0.6 }}>{(friends || []).length}</span> {totalNotifications > 0 && <span style={{color: '#f44336', marginLeft: '0.25rem'}}>({totalNotifications})</span>}
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem 1rem 3rem' }}>
          {profileLoading && activity.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" style={{ width: 32, height: 32 }} /></div>
          ) : error && mainTab === 'friends' ? ( // only show errors in friends tab ideally, or at top
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', marginBottom: '1rem', color: '#fc8181', fontSize: '0.85rem' }}>{error}</div>
          ) : mainTab === 'activity' ? (
            activity.length === 0 ? (
              <div className="empty-state" style={{ padding: '3rem 1rem', background: 'transparent', border: 'none' }}>
                <div className="empty-icon" style={{ fontSize: '2rem' }}>—</div>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Activity Yet</h3>
                <p style={{ fontSize: '0.9rem' }}>Create challenges to build your profile.</p>
                <a href="/home" className="btn btn-primary" style={{ marginTop: '1rem' }}>Create Challenge</a>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {activity.map(item => {
                  if (item.type === 'post') return <FeedPost key={`post-${item.data.id}`} post={item.data} />
                  if (item.type === 'challenge') return <ChallengeCard key={`chall-${item.data.id}`} challenge={item.data} />
                })}
              </div>
            )
          ) : (
             <div>
                {/* Friends Sub-Tabs */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', marginBottom: '1.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '0.25rem', maxWidth: '600px', margin: '0 auto 1.5rem' }}>
                  <button style={subTabStyle('list')} onClick={() => setFriendsTab('list')}>My Friends</button>
                  <button style={subTabStyle('requests')} onClick={() => setFriendsTab('requests')}>
                    Requests {totalNotifications > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#f44336', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{totalNotifications}</span>}
                  </button>
                  <button style={subTabStyle('search')} onClick={() => setFriendsTab('search')}>Find People</button>
                </div>

                {/* Sub Tab Content */}
                {friendsTab === 'list' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    {friends.length === 0 ? (
                      <div className="empty-state" style={{ padding: '2rem 1rem', border: 'none', background: 'transparent' }}>
                        <div className="empty-icon" style={{ fontSize: '2rem' }}>—</div>
                        <h3 style={{ color: 'var(--text-primary)' }}>No friends yet</h3>
                        <p style={{ fontSize: '0.9rem' }}>Search for people to add as friends!</p>
                        <button className="btn btn-primary" onClick={() => setFriendsTab('search')} style={{ marginTop: '1rem' }}>Find People</button>
                      </div>
                    ) : (
                      friends.map(({ friendshipId, friend, since }) => (
                        <div key={friendshipId} className="glass-card" style={{ width: '100%', maxWidth: '600px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <Link to={`/user/${friend.id}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, textDecoration: 'none' }}>
                            <Avatar user={friend} size={44} />
                            <div>
                              <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{friend?.full_name || friend?.email}</p>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Friends since {new Date(since).toLocaleDateString()}</p>
                            </div>
                          </Link>
                          <button onClick={() => handleRemove(friendshipId)} disabled={actionLoading === friendshipId} style={{ background: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}>Remove</button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {friendsTab === 'requests' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                      <h3 style={{ textAlign: 'center', marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Incoming</h3>
                      {pendingRequests.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No incoming requests</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                          {pendingRequests.map(req => (
                            <div key={req.id} className="glass-card" style={{ width: '100%', maxWidth: '600px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <Link to={`/user/${req.requester?.id}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, textDecoration: 'none' }}>
                                <Avatar user={req.requester} size={44} />
                                <div>
                                  <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{req.requester?.full_name || req.requester?.email}</p>
                                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Wants to be your friend</p>
                                </div>
                              </Link>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => handleAccept(req.id)} disabled={actionLoading === req.id} className="btn btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}>Accept</button>
                                <button onClick={() => handleRemove(req.id)} disabled={actionLoading === req.id} className="btn btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}>Decline</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 style={{ textAlign: 'center', marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sent</h3>
                      {sentRequests.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No pending sent requests</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                          {sentRequests.map(req => (
                            <div key={req.id} className="glass-card" style={{ width: '100%', maxWidth: '600px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <Link to={`/user/${req.receiver?.id}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, textDecoration: 'none' }}>
                                <Avatar user={req.receiver} size={44} />
                                <div>
                                  <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{req.receiver?.full_name || req.receiver?.email}</p>
                                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Request pending...</p>
                                </div>
                              </Link>
                              <button onClick={() => handleRemove(req.id)} disabled={actionLoading === req.id} style={{ background: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}>Cancel</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {friendsTab === 'search' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                      <input className="form-input" placeholder="Search by name or email..." value={searchQuery} onChange={e => handleSearch(e.target.value)} style={{ width: '100%', maxWidth: '600px' }} autoFocus />
                    </div>
                    {searching ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}><span className="spinner" style={{ width: 24, height: 24 }} /></div>
                    ) : searchResults.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                        {searchResults.map(result => {
                          const friendship = searchStatuses[result.id]
                          const isFriend = friendship?.status === 'accepted'
                          const isPending = friendship?.status === 'pending'
                          return (
                            <div key={result.id} className="glass-card" style={{ width: '100%', maxWidth: '600px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <Link to={`/user/${result.id}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, textDecoration: 'none' }}>
                                <Avatar user={result} size={44} />
                                <div>
                                  <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{result.full_name || result.email}</p>
                                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{result.email}</p>
                                </div>
                              </Link>
                              {isFriend ? <span style={{ fontSize: '0.8rem', color: '#4caf50', fontWeight: 600 }}>✓ Friends</span> : isPending ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sent ✓</span> : <button onClick={() => handleSendRequest(result.id)} disabled={actionLoading === result.id} className="btn btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}>{actionLoading === result.id ? '...' : '+ Add'}</button>}
                            </div>
                          )
                        })}
                      </div>
                    ) : searchQuery.trim() ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No users found for "{searchQuery}"</p> : <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', fontSize: '0.9rem' }}>Type a name or email to search for people.</p>}
                  </div>
                )}
             </div>
          )}
        </div>
      </div>
    </div>
  )
}
