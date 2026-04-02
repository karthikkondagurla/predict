import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'

function timeAgo(dateString) {
  const date = new Date(dateString)
  const seconds = Math.floor((new Date() - date) / 1000)
  
  let interval = seconds / 31536000
  if (interval > 1) return Math.floor(interval) + "y"
  interval = seconds / 2592000
  if (interval > 1) return Math.floor(interval) + "mo"
  interval = seconds / 86400
  if (interval > 1) return Math.floor(interval) + "d"
  interval = seconds / 3600
  if (interval > 1) return Math.floor(interval) + "h"
  interval = seconds / 60
  if (interval > 1) return Math.floor(interval) + "m"
  return Math.floor(seconds) + "s"
}

export default function CommentsSection({ challengeId, onClose }) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadComments()
    
    // Optional: Real-time subscription
    const channel = supabase
      .channel(`comments-${challengeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `challenge_id=eq.${challengeId}` }, payload => {
        // Fetch full comment detail to get profile info
        fetchSingleComment(payload.new.id)
      })
      .subscribe()

    // Prevent body scroll when modal open
    document.body.style.overflow = 'hidden'

    return () => {
      supabase.removeChannel(channel)
      document.body.style.overflow = 'auto'
    }
  }, [challengeId])

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id, content, created_at, user_id,
          profiles:user_id ( full_name, avatar_url, email )
        `)
        .eq('challenge_id', challengeId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setComments(data || [])
    } catch (err) {
      console.error('Error loading comments:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSingleComment = async (id) => {
     try {
       const { data } = await supabase.from('comments').select('id, content, created_at, user_id, profiles:user_id ( full_name, avatar_url, email )').eq('id', id).single()
       if (data) {
         setComments(prev => {
           if (prev.find(c => c.id === data.id)) return prev;
           return [...prev, data];
         })
       }
     } catch(err) { console.error(err) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newComment.trim() || !user) return
    
    setSubmitting(true)
    try {
      const { error } = await supabase.from('comments').insert({
        challenge_id: challengeId,
        user_id: user.id,
        content: newComment.trim()
      })
      
      if (error) throw error
      setNewComment('')
      await loadComments() // Just reload for simplicity if channel delay
    } catch (err) {
      console.error('Error posting comment:', err)
      alert('Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return
    try {
      await supabase.from('comments').delete().eq('id', commentId)
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch (err) {
      console.error('Failed to delete comment:', err)
    }
  }

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end', animation: 'fade-in 0.2s ease-out'
    }} onClick={onClose}>
      
      <div style={{
        background: 'var(--bg-secondary)', width: '100%', height: '85%', maxHeight: '800px',
        borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
        display: 'flex', flexDirection: 'column', animation: 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.5)', borderTop: '1px solid var(--border-glass)'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ 
          padding: '1.25rem 1rem 1rem', display: 'flex', justifyContent: 'center', 
          alignItems: 'center', position: 'relative', borderBottom: '1px solid var(--border-glass)'
        }}>
           <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', width: '40px', height: '4px', background: 'var(--border-glass)', borderRadius: '2px' }} />
           <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Comments</h3>
           <button onClick={onClose} style={{ position: 'absolute', right: '1rem', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '2rem' }}>Loading comments...</div>
          ) : comments.length === 0 ? (
             <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', fontStyle: 'italic', marginTop: '2rem' }}>
               No comments yet. Be the first!
             </p>
          ) : (
            comments.map(c => {
              const author = c.profiles
              const isMe = user && user.id === c.user_id
              const initials = author ? (author.full_name || author.email || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : '?'
              const avatarUrl = author?.avatar_url
              
              return (
                <div key={c.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                   {/* Avatar */}
                   <Link to={`/user/${c.user_id}`} style={{ textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                     <Avatar user={author} size={32} />
                   </Link>

                   {/* Content Bubble */}
                   <div style={{ flex: 1 }}>
                     <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.2rem' }}>
                       <Link to={`/user/${c.user_id}`} style={{ textDecoration: 'none', color: 'var(--text-primary)' }} onClick={e => e.stopPropagation()}>
                         <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                           {author?.full_name || author?.email?.split('@')[0] || 'Unknown User'}
                         </span>
                       </Link>
                       <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{timeAgo(c.created_at)}</span>
                     </div>
                     <div style={{ 
                       background: isMe ? 'rgba(255, 107, 53, 0.1)' : 'var(--bg-card)', 
                       padding: '0.6rem 0.85rem', borderRadius: '0.85rem',
                       borderTopLeftRadius: 0, fontSize: '0.9rem', color: 'var(--text-primary)',
                       lineHeight: 1.4
                     }}>
                       {c.content}
                     </div>
                     {isMe && (
                       <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.3rem', cursor: 'pointer', padding: 0 }}>
                         Delete
                       </button>
                     )}
                   </div>
                </div>
              )
            })
          )}
        </div>

        {/* Input */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-glass)', background: 'var(--bg-primary)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          {user ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                className="form-input"
                type="text"
                placeholder="Add a comment..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                style={{ flex: 1, padding: '0.6rem 1rem', fontSize: '0.9rem', borderRadius: '24px', background: 'var(--bg-secondary)' }}
                disabled={submitting}
              />
              <button 
                type="submit" 
                disabled={!newComment.trim() || submitting}
                style={{ 
                   background: 'none', border: 'none', color: newComment.trim() ? 'var(--gold)' : 'var(--text-muted)',
                   fontWeight: 600, fontSize: '0.9rem', padding: '0 0.5rem', cursor: newComment.trim() ? 'pointer' : 'default',
                   transition: 'color 0.2s ease'
                }}
              >
                 Post
              </button>
            </form>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>Log in to comment.</p>
          )}
        </div>

      </div>
    </div>,
    document.body
  )
}
