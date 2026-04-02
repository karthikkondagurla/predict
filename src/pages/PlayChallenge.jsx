import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getChallenge, submitChallengeResponse, getChallengeResponses } from '../utils/challenges'
import { supabase } from '../supabase'
import ShareModal from '../components/ShareModal'
import FeedPost from '../components/FeedPost'

export default function PlayChallenge() {
  const { id } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const justCreated = location.state?.justCreated

  const [challenge, setChallenge] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Play state
  const [answers, setAnswers] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Share modal
  const [showShare, setShowShare] = useState(false)

  // Responses
  const [responses, setResponses] = useState([])
  const [feedPosts, setFeedPosts] = useState([])

  useEffect(() => {
    async function load() {
      try {
        const c = await getChallenge(id)
        setChallenge(c)
        setAnswers(new Array(c.questions.length).fill(-1))

        // If user is the creator or just created, show share modal
        if (justCreated) {
          setShowShare(true)
        }

        // Check if user already responded
        if (user) {
          const resps = await getChallengeResponses(id)
          setResponses(resps)
          const myResponse = resps.find(r => r.user_id === user.id)
          if (myResponse) {
            setAnswers(myResponse.answers)
            setScore(myResponse.score)
            setSubmitted(true)
          }
        }
        
        if (c.is_resolved) {
          const { data: posts } = await supabase
            .from('feed_posts')
            .select('*')
            .eq('challenge_id', id)
            .order('created_at', { ascending: true }) // chronological order
          const formattedPosts = (posts || []).map(p => ({ type: 'post', data: p }))
          setFeedPosts(formattedPosts)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, user])

  const isCreator = user && challenge && user.id === challenge.creator_id

  const handleSelectAnswer = (qi, oi) => {
    if (submitted || isCreator) return
    const updated = [...answers]
    updated[qi] = oi
    setAnswers(updated)
  }

  const handleSubmit = async () => {
    if (!user) {
      setError('Please log in to submit your answers!')
      return
    }

    const allAnswered = answers.every(a => a >= 0)
    if (!allAnswered) {
      setError('Please answer all questions before submitting.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Score is calculated later by the Backend AI Cron Job!
      await submitChallengeResponse({
        challengeId: id,
        answers: answers,
        score: 0,
      })

      setScore(0)
      setSubmitted(true)

      // Refresh responses
      const resps = await getChallengeResponses(id)
      setResponses(resps)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    )
  }

  if (error && !challenge) {
    return (
      <div className="page">
        <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
          <div className="empty-state">
            <div className="empty-icon">❌</div>
            <h2 style={{ color: '#fc8181' }}>Challenge Not Found</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    )
  }

  const shareUrl = `${window.location.origin}/challenge/${id}`

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '700px' }}>

        {/* Match Info Header */}
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span className="tag">IPL</span>
            {isCreator && <span className="tag" style={{ background: 'rgba(76,175,80,0.15)', borderColor: 'rgba(76,175,80,0.4)', color: '#81c784' }}>Your Challenge</span>}
          </div>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>{challenge.match_name}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {challenge.questions.length} question{challenge.questions.length > 1 ? 's' : ''} · {responses.length} response{responses.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Share button for creator */}
        {isCreator && (
          <button className="btn btn-primary" onClick={() => setShowShare(true)} style={{ width: '100%', justifyContent: 'center', marginBottom: '1.5rem' }}>
            📤 Share Challenge
          </button>
        )}

        {/* Status / Score Result */}
        {challenge.is_resolved ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
            <h3 style={{ color: 'var(--gold)', textAlign: 'center', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.9rem' }}>
               Official Match Results
            </h3>
            {feedPosts.length > 0 ? (
              feedPosts.map(item => <FeedPost key={`post-${item.data.id}`} post={item.data} />)
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <span className="spinner" style={{ width: 32, height: 32 }} />
                <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading AI Umpire grading...</p>
              </div>
            )}
            
            <button className="btn btn-secondary" onClick={() => setShowShare(true)} style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}>
               Challenge Your Friends Too
            </button>
          </div>
        ) : (
          <>
            {submitted && !isCreator && (
               <div className="glass-card" style={{
                 padding: '2rem', textAlign: 'center', marginBottom: '1.5rem',
                 border: '1px solid rgba(255, 87, 34, 0.3)', background: 'rgba(255, 87, 34, 0.05)',
               }}>
                 <div style={{ fontSize: '3rem', marginBottom: '0.8rem' }}>⏳</div>
                 <h3 style={{ color: 'var(--gold)', marginBottom: '0.5rem' }}>Prediction Locked In!</h3>
                 <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                   Your answers have been submitted. When the match ends, the AI Umpire will grade everyone and publish a result post in the social feed!
                 </p>
               </div>
            )}

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-sm)', padding: '0.75rem', marginBottom: '1.5rem',
                color: '#fc8181', fontSize: '0.85rem',
              }}>
                {error}
              </div>
            )}

            {/* Questions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {challenge.questions.map((q, qi) => (
                <div key={qi} className="glass-card" style={{ padding: '1.5rem' }}>
                  <p style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>QUESTION {qi + 1}</p>
                  <h3 style={{ fontSize: '1.05rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>{q.question}</h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {q.options.map((opt, oi) => {
                      const isSelected = answers[qi] === oi
                      const isCorrect = q.answer === oi
                      const hasOfficialAnswer = q.answer !== -1
                      const showResult = (submitted || isCreator) && hasOfficialAnswer

                      let borderColor = 'var(--border-glass)'
                      let bgColor = 'transparent'
                      if (showResult && isCorrect) {
                        borderColor = 'rgba(76,175,80,0.6)'
                        bgColor = 'rgba(76,175,80,0.08)'
                      } else if (showResult && isSelected && !isCorrect) {
                        borderColor = 'rgba(244,67,54,0.6)'
                        bgColor = 'rgba(244,67,54,0.08)'
                      } else if (isSelected) {
                        borderColor = 'var(--gold)'
                        bgColor = 'rgba(255,87,34,0.08)'
                      }

                      return (
                        <button
                          key={oi}
                          onClick={() => handleSelectAnswer(qi, oi)}
                          disabled={submitted || isCreator}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            background: bgColor,
                            border: `1.5px solid ${borderColor}`,
                            borderRadius: 'var(--radius-sm)',
                            cursor: (submitted || isCreator) ? 'default' : 'pointer',
                            transition: 'all var(--transition-fast)',
                            textAlign: 'left', width: '100%',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <span style={{
                            width: 24, height: 24, minWidth: 24,
                            borderRadius: '50%',
                            border: `2px solid ${isSelected ? 'var(--gold)' : 'var(--border-glass)'}`,
                            background: isSelected ? 'var(--gold)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.65rem', fontWeight: 700,
                            color: isSelected ? '#000' : 'var(--text-muted)',
                          }}>
                            {showResult && isCorrect ? '✓' : String.fromCharCode(65 + oi)}
                          </span>
                          <span style={{ fontSize: '0.95rem' }}>{opt}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Submit Button (for non-creators who haven't submitted) */}
        {!isCreator && !submitted && (
          <button
            onClick={handleSubmit}
            disabled={submitting || answers.some(a => a < 0)}
            className="btn btn-primary"
            style={{
              width: '100%', justifyContent: 'center', marginTop: '1.5rem',
              fontSize: '1.1rem', padding: '1rem',
              opacity: answers.some(a => a < 0) ? 0.5 : 1,
            }}
          >
            {submitting ? <><span className="spinner" /> Submitting...</> : '🎯 Submit Answers'}
          </button>
        )}

      </div>

      {/* Share Modal */}
      {showShare && (
        <ShareModal
          url={shareUrl}
          matchName={challenge.match_name}
          questionCount={challenge.questions.length}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  )
}
