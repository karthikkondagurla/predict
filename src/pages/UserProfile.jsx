import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabase'
import { getFriendshipStatus, sendFriendRequest, acceptFriendRequest, removeFriendship, getUserFriends } from '../utils/friends'
import { Link } from 'react-router-dom'
import ChallengeCard from '../components/ChallengeCard'
import FeedPost from '../components/FeedPost'
import Avatar from '../components/Avatar'

export default function UserProfile() {
  const { id: userId } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()

  const [mainTab, setMainTab] = useState('activity')
  const [profileUser, setProfileUser] = useState(null)
  const [activity, setActivity] = useState([])
  const [friends, setFriends] = useState([])
  const [friendStatuses, setFriendStatuses] = useState({})
  const [stats, setStats] = useState({ pts: 0, percentage: 0, challenges: 0 })
  const [friendStatus, setFriendStatus] = useState(null) // null, 'pending_sent', 'pending_received', 'accepted', 'none'
  const [friendshipId, setFriendshipId] = useState(null)

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [listActionLoading, setListActionLoading] = useState(null)
  const [error, setError] = useState(null)

  // Redirect to own profile if clicking on self
  useEffect(() => {
    if (currentUser?.id === userId) {
      navigate('/profile', { replace: true })
    }
  }, [currentUser, userId, navigate])

  const loadData = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      // 1. Load Profile
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
        
      if (profileErr) throw new Error('User not found')
      setProfileUser(profileData)

      // 2. Friend Status & Friends List
      if (currentUser) {
        const statusData = await getFriendshipStatus(userId)
        setFriendStatus(statusData?.status || 'none')
        setFriendshipId(statusData?.friendshipId || null)
      }

      const friendsData = await getUserFriends(userId)

      // Sort so the logged-in user appears at the top
      if (friendsData && currentUser) {
        friendsData.sort((a, b) => {
          if (a.friend.id === currentUser.id) return -1;
          if (b.friend.id === currentUser.id) return 1;
          return new Date(b.since) - new Date(a.since); // default to newest friends first
        });
      }

      setFriends(friendsData || [])

      if (currentUser && friendsData?.length > 0) {
        const statuses = {}
        await Promise.all(friendsData.map(async (f) => {
          if (f.friend.id !== currentUser.id) {
            const st = await getFriendshipStatus(f.friend.id)
            statuses[f.friend.id] = st
          }
        }))
        setFriendStatuses(statuses)
      }

      // 3. Load Activity & Stats
      const { data: challengesData } = await supabase
        .from('challenges')
        .select('*')
        .eq('creator_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      const formattedChallenges = (challengesData || []).map(c => ({ type: 'challenge', data: c, date: new Date(c.created_at) }))

      const { data: participatedData } = await supabase
        .from('challenge_responses')
        .select('created_at, score, answers, challenges(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000)

      let totalPoints = 0;
      let totalGradedPredictions = 0;
      let correctPredictions = 0;
      const totalChallenges = (participatedData || []).length;

      (participatedData || []).forEach(response => {
        totalPoints += (response.score || 0);
        const challenge = response.challenges;
        if (challenge && challenge.questions && response.answers) {
          challenge.questions.forEach((q, idx) => {
            if (q.answer !== -1 && q.answer !== null && q.answer !== undefined) {
              totalGradedPredictions += 1;
              if (response.answers[idx] === q.answer) {
                correctPredictions += 1;
              }
            }
          });
        }
      });

      const predictionPercentage = totalGradedPredictions > 0
        ? Math.round((correctPredictions / totalGradedPredictions) * 100)
        : 0;

      setStats({ pts: totalPoints, percentage: predictionPercentage, challenges: totalChallenges });

      const formattedParticipated = (participatedData || [])
        .filter(p => p.challenges && p.challenges.creator_id !== userId) 
        .map(p => ({ type: 'challenge', data: p.challenges, date: new Date(p.created_at) }))

      const allChallengeIds = [...new Set([...(challengesData || []).map(c => c.id), ...formattedParticipated.map(p => p.data.id)])]

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

      const uniquePostsMap = {}
      allPostsData.forEach(p => uniquePostsMap[p.id] = p)
      const uniquePosts = Object.values(uniquePostsMap)

      const formattedPosts = uniquePosts.map(p => ({ type: 'post', data: p, date: new Date(p.created_at) }))

      const combined = [...formattedChallenges, ...formattedParticipated, ...formattedPosts].sort((a, b) => b.date - a.date)
      setActivity(combined)

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId, currentUser])

  useEffect(() => { 
    loadData() 
  }, [loadData])

  // Friend Actions
  const handleAddFriend = async () => {
    setActionLoading(true)
    try {
      await sendFriendRequest(userId)
      await loadData()
    } catch (err) { setError(err.message) } finally { setActionLoading(false) }
  }

  const handleAcceptFriend = async () => {
    if (!friendshipId) return
    setActionLoading(true)
    try {
      await acceptFriendRequest(friendshipId)
      await loadData()
    } catch (err) { setError(err.message) } finally { setActionLoading(false) }
  }

  const handleRemoveFriend = async () => {
    if (!friendshipId) return
    setActionLoading(true)
    try {
      await removeFriendship(friendshipId)
      await loadData()
    } catch (err) { setError(err.message) } finally { setActionLoading(false) }
  }

  const handleSendRequestList = async (targetId) => {
    setListActionLoading(targetId)
    try {
      await sendFriendRequest(targetId)
      const status = await getFriendshipStatus(targetId)
      setFriendStatuses(p => ({ ...p, [targetId]: status }))
    } catch (err) { setError(err.message) } finally { setListActionLoading(null) }
  }

  if (loading) return <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}><span className="spinner" style={{ width: 32, height: 32 }} /></div>
  if (error) return <div className="page"><div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}><h3>Error</h3><p>{error}</p><button onClick={() => navigate(-1)} className="btn btn-secondary" style={{marginTop: '1rem'}}>Go Back</button></div></div>
  if (!profileUser) return <div className="page"><div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}><h3>User not found</h3></div></div>

  const displayName = profileUser.full_name || profileUser.email?.split('@')[0] || 'User'

  return (
    <div className="page" style={{ minHeight: 'calc(100vh - 64px - 72px)' }}>
      {/* Header */}
      <div style={{ padding: '2.5rem 1rem 1.5rem', background: 'var(--bg-glass)', borderBottom: '1px solid var(--border-glass)' }}>
        <div className="container" style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Avatar user={profileUser} size={96} />
          </div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1.5rem', fontWeight: 700 }}>{displayName}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>{profileUser.email}</p>

          {/* Stats Bar */}
          <div style={{
            display: 'flex',
            gap: '1.5rem',
            background: 'var(--bg-secondary)',
            padding: '1rem 1.5rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-glass)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
            marginBottom: '1.5rem'
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

          {/* Friend Actions */}
          {currentUser && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {friendStatus === 'accepted' ? (
                <button onClick={handleRemoveFriend} disabled={actionLoading} className="btn btn-secondary" style={{ borderRadius: '40px' }}>✓ Friends</button>
              ) : friendStatus === 'pending_sent' ? (
                <button onClick={handleRemoveFriend} disabled={actionLoading} className="btn btn-secondary" style={{ borderRadius: '40px' }}>Request Sent</button>
              ) : friendStatus === 'pending_received' ? (
                <>
                  <button onClick={handleAcceptFriend} disabled={actionLoading} className="btn btn-primary" style={{ borderRadius: '40px' }}>Accept Request</button>
                  <button onClick={handleRemoveFriend} disabled={actionLoading} className="btn btn-secondary" style={{ borderRadius: '40px' }}>Decline</button>
                </>
              ) : (
                <button onClick={handleAddFriend} disabled={actionLoading} className="btn btn-primary" style={{ borderRadius: '40px' }}>+ Add Friend</button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="container" style={{ maxWidth: '800px', padding: 0 }}>
        {/* Main Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-secondary)', position: 'sticky', top: 64, zIndex: 10 }}>
          <button style={{
            flex: 1, padding: '0.85rem', textAlign: 'center', fontWeight: 700, fontSize: '0.85rem',
            textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', background: 'transparent',
            color: mainTab === 'activity' ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none',
            borderBottom: mainTab === 'activity' ? '2px solid var(--gold)' : '2px solid transparent', transition: 'all 0.2s'
          }} onClick={() => setMainTab('activity')}>
            Activity
          </button>
          <button style={{
            flex: 1, padding: '0.85rem', textAlign: 'center', fontWeight: 700, fontSize: '0.85rem',
            textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', background: 'transparent',
            color: mainTab === 'friends' ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none',
            borderBottom: mainTab === 'friends' ? '2px solid var(--gold)' : '2px solid transparent', transition: 'all 0.2s'
          }} onClick={() => setMainTab('friends')}>
            Friends <span style={{ color: mainTab === 'friends' ? 'var(--text-primary)' : 'var(--text-muted)', marginLeft: '0.25rem', fontWeight: 400, opacity: mainTab === 'friends' ? 1 : 0.6 }}>{(friends || []).length}</span>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem 1rem 3rem' }}>
          {mainTab === 'friends' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              {friends.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem', border: 'none', background: 'transparent' }}>
                  <div className="empty-icon" style={{ fontSize: '2rem' }}>—</div>
                  <h3 style={{ color: 'var(--text-primary)' }}>No friends yet</h3>
                  <p style={{ fontSize: '0.9rem' }}>This user hasn't added any friends.</p>
                </div>
              ) : (
                friends.map(({ friendshipId, friend, since }) => {
                  const isMe = currentUser && currentUser.id === friend.id;
                  const relationship = friendStatuses[friend.id];
                  const isFriend = relationship?.status === 'accepted';
                  const isPending = relationship?.status === 'pending';

                  return (
                    <div key={friendshipId} className="glass-card" style={{ width: '100%', maxWidth: '600px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <Link to={`/user/${friend.id}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, textDecoration: 'none' }}>
                        <Avatar user={friend} size={44} />
                        <div>
                          <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{friend?.full_name || friend?.email}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Friends since {new Date(since).toLocaleDateString()}</p>
                        </div>
                      </Link>
                      {!isMe && currentUser && (
                        isFriend ? (
                          <span style={{ fontSize: '0.8rem', color: '#4caf50', fontWeight: 600 }}>✓ Friends</span>
                        ) : isPending ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Pending</span>
                        ) : (
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSendRequestList(friend.id); }}
                            disabled={listActionLoading === friend.id}
                            className="btn btn-primary"
                            style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
                          >
                            {listActionLoading === friend.id ? '...' : '+ Add'}
                          </button>
                        )
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ) : activity.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1rem', background: 'transparent', border: 'none' }}>
              <div className="empty-icon" style={{ fontSize: '2rem' }}>—</div>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Activity Yet</h3>
              <p style={{ fontSize: '0.9rem' }}>This user hasn't participated in any challenges.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {activity.map(item => {
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
