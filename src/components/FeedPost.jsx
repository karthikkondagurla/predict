import { useState } from 'react'
import CommentsSection from './CommentsSection'

export default function FeedPost({ post }) {
  const [showComments, setShowComments] = useState(false)
  const createdAt = new Date(post.created_at).toLocaleString()

  return (
    <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🤖</span>
          <div>
            <h4 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', margin: 0 }}>AI Umpire</h4>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{createdAt}</span>
          </div>
        </div>
        <span className="badge badge-completed">Result</span>
      </div>

      {post.content.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: '0.5rem' }} />
        
        // Handle bolding for answers
        const parts = line.split('**')
        return (
          <p key={i} style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {parts.map((part, j) => (
              j % 2 === 1 ? <strong key={j} style={{ color: 'var(--gold)' }}>{part}</strong> : part
            ))}
          </p>
        )
      })}

      {/* Comments Toggle */}
      <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-glass)' }}>
        <button 
           onClick={() => setShowComments(!showComments)}
           style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: 0 }}
        >
          💬 {showComments ? 'Hide Comments' : 'Comments'}
        </button>
      </div>

      {showComments && <CommentsSection challengeId={post.challenge_id} onClose={() => setShowComments(false)} />}
    </div>
  )
}
