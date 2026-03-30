import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabase'
import {
  getFriends,
  getPendingRequests,
  getSentRequests,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendship,
  searchUsers,
  getFriendshipStatus,
} from '../utils/friends'
import ChallengeCard from '../components/ChallengeCard'
import FeedPost from '../components/FeedPost'

function Avatar({ user, size = 40 }) {
  const [imgError, setImgError] = useState(false)
  const name = user?.full_name || user?.email || '?'
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const avatarUrl = user?.avatar_url || user?.picture

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--gold), var(--purple))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.35, color: '#fff',
    }}>
      {initials}
    </div>
  )
}

export default function Profile() {
  const { user, signOut } = useAuth()
  const [mainTab, setMainTab] = useState('activity') // 'activity' | 'friends'
  const [friendsTab, setFriendsTab] = useState('list') // 'list' | 'requests' | 'search'
  
  // Data States
  const [activity, setActivity] = useState([])
  const [friends, setFriends] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [sentRequests, setSentRequests] = useState([])
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchStatuses, setSearchStatuses] = useState({})

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [error, setError] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Load Friends data
      const [f, p, s] = await Promise.all([getFriends(), getPendingRequests(), getSentRequests()])
      setFriends(f || [])
      setPendingRequests(p || [])
      setSentRequests(s || [])

      // Load Activity Data (Created)
      const { data: challengesData } = await supabase
        .from('challenges')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      const formattedChallenges = (challengesData || []).map(c => ({ type: 'challenge', data: c, date: new Date(c.created_at) }))

      // Load Activity Data (Participated)
      const { data: participatedData } = await supabase
        .from('challenge_responses')
        .select('created_at, challenges(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      const formattedParticipated = (participatedData || [])
        .filter(p => p.challenges && p.challenges.creator_id !== user.id) // deduplicate
        .map(p => ({ type: 'challenge', data: p.challenges, date: new Date(p.created_at) }))

      // Collect all challenge IDs the user is involved in (created + participated)
      const createdChallengeIds = (challengesData || []).map(c => c.id)
      const participatedChallengeIds = formattedParticipated.map(p => p.data.id)
      const allChallengeIds = [...new Set([...createdChallengeIds, ...participatedChallengeIds])]

      // Fetch all AI Umpire posts for any challenge the user is involved in
      let allPostsData = []
      if (allChallengeIds.length > 0) {
        const { data: pPostsData } = await supabase
          .from('feed_posts')
          .select('*')
          .in('challenge_id', allChallengeIds)
          .order('created_at', { ascending: false })
          .limit(100)
        allPostsData = pPostsData || []
      }

      // Deduplicate posts

      const uniquePostsMap = {}
      allPostsData.forEach(p => uniquePostsMap[p.id] = p)
      const uniquePosts = Object.values(uniquePostsMap)

      const formattedPosts = uniquePosts.map(p => ({ type: 'post', data: p, date: new Date(p.created_at) }))

      const combined = [...formattedChallenges, ...formattedParticipated, ...formattedPosts].sort((a, b) => b.date - a.date)
      setActivity(combined)
    } catch (err) {
      setError(err.message)
      console.error('Failed to load profile data:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { 
    if (user?.id) loadData() 
  }, [loadData, user?.id])

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
      await loadData()
    } catch (err) { setError(err.message) } finally { setActionLoading(null) }
  }

  const handleAccept = async (friendshipId) => {
    setActionLoading(friendshipId)
    try { await acceptFriendRequest(friendshipId); await loadData() }
    catch (err) { setError(err.message) } finally { setActionLoading(null) }
  }

  const handleRemove = async (friendshipId) => {
    setActionLoading(friendshipId)
    try { await removeFriendship(friendshipId); await loadData() }
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
    position: 'relative'
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
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{user?.email}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', margin: '1.5rem 0' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700, lineHeight: 1 }}>{(activity || []).length}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>Posts</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700, lineHeight: 1 }}>{(friends || []).length}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>Friends</p>
            </div>
          </div>
          <button onClick={signOut} className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: '40px', background: 'rgba(239,68,68,0.1)', color: '#fc8181', borderColor: 'rgba(239,68,68,0.3)' }}>
            Sign Out
          </button>
        </div>
      </div>

      <div className="container" style={{ maxWidth: '800px', padding: 0 }}>
        {/* Main Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-secondary)', position: 'sticky', top: 64, zIndex: 10 }}>
          <button style={mainTabStyle('activity')} onClick={() => setMainTab('activity')}>Activity</button>
          <button style={mainTabStyle('friends')} onClick={() => setMainTab('friends')}>
            Friends {totalNotifications > 0 && <span style={{color: '#f44336'}}>({totalNotifications})</span>}
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem 1rem 3rem' }}>
          {loading ? (
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
                <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '0.25rem', overflowX: 'auto' }}>
                  <button style={subTabStyle('list')} onClick={() => setFriendsTab('list')}>My Friends</button>
                  <button style={subTabStyle('requests')} onClick={() => setFriendsTab('requests')}>
                    Requests {totalNotifications > 0 && <span style={{ position: 'absolute', top: -4, right: -4, background: '#f44336', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{totalNotifications}</span>}
                  </button>
                  <button style={subTabStyle('search')} onClick={() => setFriendsTab('search')}>Find People</button>
                </div>

                {/* Sub Tab Content */}
                {friendsTab === 'list' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {friends.length === 0 ? (
                      <div className="empty-state" style={{ padding: '2rem 1rem', border: 'none', background: 'transparent' }}>
                        <div className="empty-icon" style={{ fontSize: '2rem' }}>—</div>
                        <h3 style={{ color: 'var(--text-primary)' }}>No friends yet</h3>
                        <p style={{ fontSize: '0.9rem' }}>Search for people to add as friends!</p>
                        <button className="btn btn-primary" onClick={() => setFriendsTab('search')} style={{ marginTop: '1rem' }}>Find People</button>
                      </div>
                    ) : (
                      friends.map(({ friendshipId, friend, since }) => (
                        <div key={friendshipId} className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <Avatar user={friend} size={44} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{friend?.full_name || friend?.email}</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Friends since {new Date(since).toLocaleDateString()}</p>
                          </div>
                          <button onClick={() => handleRemove(friendshipId)} disabled={actionLoading === friendshipId} style={{ background: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}>Remove</button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {friendsTab === 'requests' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                      <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Incoming</h3>
                      {pendingRequests.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No incoming requests</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {pendingRequests.map(req => (
                            <div key={req.id} className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <Avatar user={req.requester} size={44} />
                              <div style={{ flex: 1 }}>
                                <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{req.requester?.full_name || req.requester?.email}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Wants to be your friend</p>
                              </div>
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
                      <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sent</h3>
                      {sentRequests.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No pending sent requests</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {sentRequests.map(req => (
                            <div key={req.id} className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <Avatar user={req.receiver} size={44} />
                              <div style={{ flex: 1 }}>
                                <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{req.receiver?.full_name || req.receiver?.email}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Request pending...</p>
                              </div>
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
                    <input className="form-input" placeholder="Search by name or email..." value={searchQuery} onChange={e => handleSearch(e.target.value)} style={{ marginBottom: '1rem' }} autoFocus />
                    {searching ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}><span className="spinner" style={{ width: 24, height: 24 }} /></div>
                    ) : searchResults.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {searchResults.map(result => {
                          const friendship = searchStatuses[result.id]
                          const isFriend = friendship?.status === 'accepted'
                          const isPending = friendship?.status === 'pending'
                          return (
                            <div key={result.id} className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <Avatar user={result} size={44} />
                              <div style={{ flex: 1 }}>
                                <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{result.full_name || result.email}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{result.email}</p>
                              </div>
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
