import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { submitChallengeResponse, getChallengeResponses } from '../utils/challenges'
import { supabase } from '../supabase'
import CommentsSection from './CommentsSection'
import ConfirmLockModal from './ConfirmLockModal'

export default function ChallengeCard({ challenge }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const questions = challenge.questions || []
  const questionCount = questions.length
  const createdAt = new Date(challenge.created_at).toLocaleString()
  const shortId = challenge.short_id || '—'

  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState(new Array(questionCount).fill(-1))
  const [showComments, setShowComments] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [touchStartX, setTouchStartX] = useState(null)

  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [responses, setResponses] = useState([])
  const [creatorProfile, setCreatorProfile] = useState(null)

  const isCreator = user && user.id === challenge.creator_id
  const isLocked = submitted || isCreator

  // Load existing responses & check if user already participated
  useEffect(() => {
    if (user && challenge.id) {
      // If creator, pre-fill with creator's answers
      if (isCreator) {
        setAnswers(questions.map(q => q.answer))
      }

      getChallengeResponses(challenge.id).then(resps => {
        setResponses(resps)
        const myResp = resps.find(r => r.user_id === user.id)
        if (myResp) {
          setAnswers(myResp.answers)
          setSubmitted(true)
          setCurrentStep(0)
        }
      }).catch(err => console.error('Error fetching responses:', err))

      // Always fetch creator profile so they appear as first participant
      supabase.from('profiles').select('id, full_name, avatar_url, email')
        .eq('id', challenge.creator_id).single()
        .then(({ data }) => setCreatorProfile(data || null))
        .catch(() => {})
    }
  }, [user, challenge.id, questionCount, isCreator])

  // Supabase Realtime: live participant updates
  useEffect(() => {
    if (!challenge.id) return

    const channel = supabase
      .channel(`responses-${challenge.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'challenge_responses',
        filter: `challenge_id=eq.${challenge.id}`,
      }, async () => {
        // Re-fetch responses with profiles when a new participant joins
        try {
          const resps = await getChallengeResponses(challenge.id)
          setResponses(resps)
        } catch (err) {
          console.error('Realtime response refresh error:', err)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [challenge.id])

  // --- Handlers ---

  const handleSelectAnswer = (oi) => {
    if (isLocked) return
    const updated = [...answers]
    updated[currentStep] = oi
    setAnswers(updated)

    // Auto-advance after a short delay
    if (currentStep < questionCount - 1) {
      setTimeout(() => {
        setCurrentStep(s => s + 1)
      }, 300)
    }
  }

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX)
  }

  const handleTouchEnd = (e) => {
    if (touchStartX === null) return
    const dx = touchStartX - e.changedTouches[0].clientX
    if (Math.abs(dx) > 40) {
      if (dx > 0 && currentStep < questionCount - 1) setCurrentStep(s => s + 1)
      if (dx < 0 && currentStep > 0) setCurrentStep(s => s - 1)
    }
    setTouchStartX(null)
  }

  const allAnswered = answers.every(a => a >= 0)

  const handleLockRequest = () => {
    if (!user) {
      navigate('/login')
      return
    }
    setShowConfirm(true)
  }

  const handleConfirmLock = async () => {
    setShowConfirm(false)
    setSubmitting(true)
    try {
      await submitChallengeResponse({
        challengeId: challenge.id,
        answers: answers,
        score: 0,
      })
      setSubmitted(true)
      setCurrentStep(0)
      const resps = await getChallengeResponses(challenge.id)
      setResponses(resps)
    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // --- Render ---

  const q = questions[currentStep]
  if (!q) return null

  // Build participant list: creator always first, then unique responders
  const participantMap = {}
  if (creatorProfile) {
    const name = creatorProfile.full_name || creatorProfile.email?.split('@')[0] || 'Creator'
    participantMap[creatorProfile.id] = {
      id: creatorProfile.id, name,
      avatar: creatorProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=32&background=ff6b35&color=fff`
    }
  }
  responses.forEach(r => {
    if (participantMap[r.user_id]) return // skip creator duplicate
    const profile = r.profiles
    const name = profile?.full_name || profile?.email?.split('@')[0] || 'User'
    const avatar = profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=32&background=ff6b35&color=fff`
    participantMap[r.user_id] = { id: r.user_id, name, avatar }
  })
  const participants = Object.values(participantMap)

  return (
    <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>

      {/* Instagram-style post header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        {/* Creator info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {creatorProfile ? (
            creatorProfile.avatar_url ? (
              <img
                src={creatorProfile.avatar_url}
                alt={creatorProfile.full_name || 'Creator'}
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-glass)' }}
              />
            ) : (
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--gold), var(--gold-dark))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.8rem', color: '#fff',
                border: '2px solid var(--border-glass)',
              }}>
                {(creatorProfile.full_name || creatorProfile.email || '?').charAt(0).toUpperCase()}
              </div>
            )
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-secondary)' }} />
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {creatorProfile?.full_name || creatorProfile?.email?.split('@')[0] || '...'}
              </span>

            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '1px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{createdAt}</span>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, color: 'var(--gold)',
                background: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.3)',
                padding: '1px 4px', borderRadius: '3px', fontFamily: 'monospace',
              }}>#{shortId}</span>
            </div>
          </div>
        </div>
        {/* Q counter */}
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Q {currentStep + 1} of {questionCount}
        </span>
      </div>

      {/* Match Name */}
      <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '1rem', lineHeight: 1.3, opacity: 0.9 }}>
        {challenge.match_name}
      </h3>

      {challenge.is_resolved && isLocked && (
        <div style={{
          background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)',
          padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.9rem', color: '#81c784', fontWeight: 600 }}>
            {isCreator ? 'Challenge Resolved' : 'Your Result'}
          </span>
          <span style={{ fontSize: '1.1rem', color: '#81c784', fontWeight: 700 }}>
            {isCreator 
              ? `${questionCount} Qs`
              : `${answers.reduce((acc, ans, i) => acc + (ans === questions[i].answer ? 1 : 0), 0)} / ${questionCount}`}
          </span>
        </div>
      )}

      {/* Progress Bar */}
      <div style={{ width: '100%', height: 4, background: 'var(--border-glass)', borderRadius: 2, marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div style={{
          height: '100%', background: 'var(--gold)',
          width: `${((currentStep + 1) / questionCount) * 100}%`,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Question — swipeable */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ animation: 'fade-in 0.3s ease', userSelect: 'none' }}
      >
        <h4 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
          {q.question}
        </h4>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {q.options.map((opt, oi) => {
            const isSelected = answers[currentStep] === oi
            const isCorrect = challenge.is_resolved && q.answer === oi
            const isWrong = challenge.is_resolved && isSelected && q.answer !== oi

            let bg = isSelected ? 'rgba(255, 107, 53, 0.1)' : 'var(--bg-glass)'
            let border = isSelected ? 'var(--gold)' : 'var(--border-glass)'
            let circleBorder = isSelected ? 'var(--gold)' : 'var(--text-muted)'
            let circleBg = isSelected ? 'var(--gold)' : 'transparent'
            
            if (isCorrect) {
              bg = 'rgba(76, 175, 80, 0.15)'
              border = '#4caf50'
              circleBorder = '#4caf50'
              circleBg = '#4caf50'
            } else if (isWrong) {
              bg = 'rgba(244, 67, 54, 0.15)'
              border = '#f44336'
              circleBorder = '#f44336'
              circleBg = '#f44336'
            }

            return (
              <button
                key={oi}
                onClick={() => handleSelectAnswer(oi)}
                disabled={isLocked}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem',
                  background: bg,
                  border: `1px solid ${border}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: isLocked ? 'default' : 'pointer',
                  color: 'var(--text-primary)', textAlign: 'left',
                  transition: 'all 0.2s ease',
                  opacity: isLocked && !isSelected && !isCorrect ? 0.5 : 1,
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: `1.5px solid ${circleBorder}`,
                  background: circleBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {(isSelected || isCorrect || isWrong) && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#000' }} />}
                </div>
                <span style={{ fontSize: '0.9rem' }}>{opt}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Lock Prediction Button — only for non-locked users who answered all */}
      {!isLocked && allAnswered && currentStep === questionCount - 1 && (
        <button
          onClick={handleLockRequest}
          disabled={submitting}
          className="btn btn-primary"
          style={{
            width: '100%', justifyContent: 'center', marginTop: '1.25rem',
            padding: '0.8rem', fontSize: '0.95rem',
          }}
        >
          {submitting ? (
            <><span className="spinner" /> Locking...</>
          ) : (
            '🔒 Lock Prediction'
          )}
        </button>
      )}

      {/* Dot Indicators */}
      {questionCount > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '1.25rem' }}>
          {Array.from({ length: questionCount }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === currentStep ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === currentStep ? 'var(--gold)' : 'var(--border-glass)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      )}

      {/* Participants Section — always visible */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        marginTop: '0.75rem', paddingTop: '0.75rem',
        borderTop: '1px solid var(--border-glass)',
      }}>
        {/* Avatar stack */}
        <div style={{ display: 'flex' }}>
          {participants.slice(0, 5).map((p, i) => (
              <img
                key={p.id}
                src={p.avatar}
                alt={p.name}
                title={p.name}
                style={{
                  width: 26, height: 26, borderRadius: '50%', objectFit: 'cover',
                  border: '2px solid var(--bg-primary)',
                  marginLeft: i > 0 ? '-8px' : 0,
                }}
              />
            ))}
            {participants.length > 5 && (
              <div style={{
                width: 26, height: 26, borderRadius: '50%', marginLeft: '-8px',
                background: 'var(--bg-secondary)', border: '2px solid var(--bg-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)',
              }}>
                +{participants.length - 5}
              </div>
            )}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {participants.length} prediction{participants.length !== 1 ? 's' : ''} locked
          </span>
        </div>

      {/* Comments Toggle */}
      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-glass)' }}>
        <button
          onClick={() => setShowComments(!showComments)}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: '0.85rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: 0,
          }}
        >
          💬 {showComments ? 'Hide Comments' : 'Comments'}
        </button>
      </div>

      {showComments && <CommentsSection challengeId={challenge.id} onClose={() => setShowComments(false)} />}

      {/* Confirmation Modal */}
      {showConfirm && (
        <ConfirmLockModal
          onConfirm={handleConfirmLock}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
