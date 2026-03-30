import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import CommentsSection from './CommentsSection'

export default function FeedPost({ post }) {
  const [showComments, setShowComments] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const { user } = useAuth()
  const rawDate = post.created_at || post.data?.created_at
  const createdAt = rawDate ? new Date(rawDate).toLocaleString() : null

  // Detect if this is a new JSON-structured Umpire Post for a specific question
  let isQResult = false;
  let isLeaderboard = false;
  let qData = null;
  
  try {
    const parsed = JSON.parse(post.content);
    if (parsed.type === 'q_result') {
      isQResult = true;
      qData = parsed;
    } else if (parsed.type === 'leaderboard') {
      isLeaderboard = true;
      qData = parsed;
    }
  } catch(e) {
    // Normal markdown post fallback
  }

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
        <span className="badge" style={{ background: 'rgba(76, 175, 80, 0.15)', color: 'var(--green)', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
          Result
        </span>
      </div>

      {isLeaderboard ? (
        // --- FINAL LEADERBOARD UI ---
        <div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🏆 Challenge Leaderboard
            {qData.short_id && (
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, color: 'var(--gold)',
                background: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.3)',
                padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace',
              }}>#{qData.short_id}</span>
            )}
          </h3>
          <div style={{ marginBottom: '1.25rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
              {qData.match_name}
            </p>
            <p style={{ color: 'var(--gold-light)', fontSize: '0.75rem', fontWeight: 600, opacity: 0.9 }}>
              • {qData.total_q || 0} Questions • {qData.parts ? qData.parts.length : 0} members
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
             {(() => {
                let visibleParts = [];
                let topOverage = 0;
                let bottomOverage = 0;

                const partsWithRank = qData.parts.map((p, i) => ({ ...p, rank: i + 1 }));

                if (partsWithRank.length <= 3) {
                  visibleParts = partsWithRank;
                } else {
                  const userIdx = partsWithRank.findIndex(p => p.id === user?.id);
                  if (userIdx === -1 || userIdx <= 1) {
                    visibleParts = partsWithRank.slice(0, 3);
                    bottomOverage = partsWithRank.length - 3;
                  } else if (userIdx >= partsWithRank.length - 2) {
                    visibleParts = partsWithRank.slice(partsWithRank.length - 3);
                    topOverage = partsWithRank.length - 3;
                  } else {
                    visibleParts = partsWithRank.slice(userIdx - 1, userIdx + 2);
                    topOverage = userIdx - 1;
                    bottomOverage = partsWithRank.length - (userIdx + 2);
                  }
                }

                return (
                  <>
                    {topOverage > 0 && (
                      <div onClick={() => setShowModal(true)} style={{ textAlign: 'center', padding: '0.4rem', marginBottom: '0.15rem', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          ↑ {topOverage} higher ranked players (Tap to view all)
                        </span>
                      </div>
                    )}
                    
                    {visibleParts.map((p) => {
                       const right = Math.floor((p.score || 0) / 20);
                       const total = qData.total_q || Math.max(right, 1);
                       const pct = Math.round((right / total) * 100);
                       const isMe = p.id === user?.id;
                       
                       return (
                       <div key={p.rank} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: '6px', background: isMe ? 'rgba(255, 87, 34, 0.1)' : 'rgba(0, 0, 0, 0.2)', border: isMe ? '1px solid var(--gold)' : '1px solid var(--border-glass)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.9rem', width: '20px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>#{p.rank}</span>
                            {p.medal && p.medal !== '🏅' && p.medal !== '💔' && <span style={{ fontSize: '1.25rem' }}>{p.medal}</span>}
                            <img src={p.img} alt={p.n} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                               <span style={{ color: isMe ? 'var(--gold)' : 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600 }}>{p.n}</span>
                               <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                 {right}/{total} Correct ({pct}%)
                               </span>
                            </div>
                          </div>
                          <span style={{ color: 'var(--gold)', fontWeight: 'bold', fontSize: '1rem' }}>
                            {p.score} pts
                          </span>
                       </div>
                    )})}

                    {bottomOverage > 0 && (
                      <div onClick={() => setShowModal(true)} style={{ textAlign: 'center', padding: '0.4rem', marginTop: '0.15rem', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          ↓ {bottomOverage} lower ranked players (Tap to view all)
                        </span>
                      </div>
                    )}
                  </>
                )
             })()}
             {qData.parts.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No participants answered.</p>}
          </div>

          {/* Full Leaderboard Modal Overlay */}
          {showModal && (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
              <div className="modal-box" onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', maxHeight: '85vh', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.2rem', margin: 0 }}>🏆 Full Leaderboard</h3>
                  <button onClick={() => setShowModal(false)} style={{ background: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', lineHeight: 1 }}>&times;</button>
                </div>
                
                <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '0.5rem' }}>
                   {qData.parts.map((p, i) => {
                      const rank = i + 1;
                      const right = Math.floor((p.score || 0) / 20);
                      const total = qData.total_q || Math.max(right, 1);
                      const pct = Math.round((right / total) * 100);
                      const isMe = p.id === user?.id;

                      return (
                         <div key={rank} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '8px', background: isMe ? 'rgba(255, 107, 53, 0.15)' : 'rgba(0,0,0,0.3)', border: isMe ? '1px solid var(--gold)' : '1px solid var(--border-glass)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ fontSize: '1rem', width: '24px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>#{rank}</span>
                              {p.medal && p.medal !== '🏅' && p.medal !== '💔' && <span style={{ fontSize: '1.25rem' }}>{p.medal}</span>}
                              <img src={p.img} alt={p.n} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                 <span style={{ color: isMe ? 'var(--gold)' : 'var(--text-primary)', fontSize: '1rem', fontWeight: 600 }}>{p.n}</span>
                                 <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                   {right}/{total} Correct ({pct}%)
                                 </span>
                              </div>
                            </div>
                            <span style={{ color: 'var(--gold)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                              {p.score}
                            </span>
                         </div>
                      )
                   })}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : isQResult ? (
        // --- NEW CUSTOM QUESTION UI ---
        <div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.05rem', lineHeight: 1.4 }}>
            {qData.q}
          </h3>
          <p style={{ color: 'var(--gold-light)', fontWeight: 600, marginBottom: '1.25rem', fontSize: '0.90rem', background: 'rgba(255, 87, 34, 0.08)', padding: '0.5rem 0.75rem', borderRadius: '4px', borderLeft: '3px solid var(--gold)' }}>
            Result: <span style={{ color: 'var(--text-primary)'}}>{qData.off}</span>
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
             {[...qData.parts].sort((a, b) => b.ok - a.ok).map((p, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0.75rem', borderRadius: '6px', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-glass)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                     <img src={p.img} alt={p.n} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                     <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 500 }}>{p.n}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.ans}</span>
                     </div>
                   </div>
                   <span style={{ color: p.ok ? 'var(--green)' : 'var(--red)', fontWeight: 'bold', fontSize: '0.95rem' }}>
                     {p.pts}
                   </span>
                </div>
             ))}
             {qData.parts.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No participants answered.</p>}
          </div>
        </div>
      ) : (
        // --- OLD MARKDOWN UI (Fallback) ---
        post.content.split('\n').map((line, i) => {
          if (!line.trim()) return <div key={i} style={{ height: '0.5rem' }} />
          const parts = line.split('**')
          return (
            <p key={i} style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {parts.map((part, j) => (
                j % 2 === 1 ? <strong key={j} style={{ color: 'var(--gold)' }}>{part}</strong> : part
              ))}
            </p>
          )
        })
      )}

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
