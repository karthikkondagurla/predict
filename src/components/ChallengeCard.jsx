import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { submitChallengeResponse, getChallengeResponses } from '../utils/challenges'
import CommentsSection from './CommentsSection'

export default function ChallengeCard({ challenge }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const questions = challenge.questions || []
  const questionCount = questions.length
  const createdAt = new Date(challenge.created_at).toLocaleString()

  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState(new Array(questionCount).fill(-1))
  const [showComments, setShowComments] = useState(false)
  
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [responses, setResponses] = useState([])

  const isCreator = user && user.id === challenge.creator_id

  useEffect(() => {
    if (user && challenge.id) {
      getChallengeResponses(challenge.id).then(resps => {
        setResponses(resps)
        const myResp = resps.find(r => r.user_id === user.id)
        if (myResp) {
          setAnswers(myResp.answers)
          setScore(myResp.score)
          setSubmitted(true)
          setCurrentStep(questionCount) // Jump to results
        }
      }).catch(err => console.error("Error fetching challenge responses:", err))
    }
  }, [user, challenge.id, questionCount])

  const handleSelectAnswer = (oi) => {
    if (submitted || isCreator) return
    const updated = [...answers]
    updated[currentStep] = oi
    setAnswers(updated)
    
    // Auto advance after a tiny delay
    if (currentStep < questionCount) {
      setTimeout(() => {
        setCurrentStep(s => s + 1)
      }, 300)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1)
  }

  const handleNext = () => {
    if (currentStep < questionCount) setCurrentStep(s => s + 1)
  }

  const handleSubmit = async () => {
    if (!user) {
      navigate('/login')
      return
    }

    setSubmitting(true)
    try {
      // Calculate score conceptually (backend AI might override later, but for now we do standard)
      let s = 0
      questions.forEach((q, i) => {
        if (answers[i] === q.answer) s++
      })

      await submitChallengeResponse({
        challengeId: challenge.id,
        answers: answers,
        score: s,
      })

      setScore(s)
      setSubmitted(true)
      // Refresh to get new count
      const resps = await getChallengeResponses(challenge.id)
      setResponses(resps)
      
    } catch (err) {
      console.error(err)
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // --- RENDERING VIEWS --- //

  // 1. Creator View (or user wants to see summary instead of playing)
  if (isCreator) {
    return (
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
             <span className="tag tag-primary">Challenge</span>
             <span className="tag tag-green">Yours</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{createdAt}</span>
        </div>
        <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: 1.3 }}>
          {challenge.match_name}
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          {questionCount} questions · {responses.length} responses
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate(`/challenge/${challenge.id}`)} style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}>
            View Details
          </button>
        </div>

        {/* Comments Toggle */}
        <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-glass)' }}>
          <button 
             onClick={() => setShowComments(!showComments)}
             style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: 0 }}
          >
            💬 {showComments ? 'Hide Comments' : 'Comments'}
          </button>
        </div>

        {showComments && <CommentsSection challengeId={challenge.id} onClose={() => setShowComments(false)} />}

      </div>
    )
  }

  // 2. Player View (Carousel)
  const showResults = submitted && currentStep === questionCount
  const showSubmit = !submitted && currentStep === questionCount
  const q = questions[currentStep]

  return (
    <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: '280px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span className="tag" style={{ background: 'rgba(255, 107, 53, 0.15)', color: '#ff6b35', borderColor: 'rgba(255, 107, 53, 0.3)' }}>
          Challenge
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {currentStep < questionCount ? `Q ${currentStep + 1} of ${questionCount}` : (submitted ? 'Results' : 'Submit')}
        </span>
      </div>

      <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '1rem', lineHeight: 1.3, opacity: 0.9 }}>
        {challenge.match_name}
      </h3>

      {/* Progress Bar */}
      <div style={{ width: '100%', height: 4, background: 'var(--border-glass)', borderRadius: 2, marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div style={{ 
          height: '100%', background: 'var(--gold)', 
          width: `${((currentStep) / questionCount) * 100}%`,
          transition: 'width 0.3s ease'
        }} />
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        
        {/* State A: Question */}
        {currentStep < questionCount && (
          <div style={{ animation: 'fade-in 0.3s ease' }}>
            <h4 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
              {q.question}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {q.options.map((opt, oi) => {
                const isSelected = answers[currentStep] === oi
                return (
                  <button
                    key={oi}
                    onClick={() => handleSelectAnswer(oi)}
                    disabled={submitted}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.75rem', background: isSelected ? 'rgba(255, 107, 53, 0.1)' : 'var(--bg-glass)',
                      border: `1px solid ${isSelected ? 'var(--gold)' : 'var(--border-glass)'}`,
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      color: 'var(--text-primary)', textAlign: 'left',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${isSelected ? 'var(--gold)' : 'var(--text-muted)'}`,
                      background: isSelected ? 'var(--gold)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#000' }} />}
                    </div>
                    <span style={{ fontSize: '0.9rem' }}>{opt}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* State B: Submit Screen */}
        {showSubmit && (
          <div style={{ textAlign: 'center', animation: 'fade-in 0.3s ease', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
            <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Ready to submit?</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              You've answered all {questionCount} predictions. Good luck!
            </p>
            <button 
              onClick={handleSubmit} 
              disabled={submitting}
              className="btn btn-primary" 
              style={{ width: '100%', justifyContent: 'center', padding: '0.8rem' }}
            >
              {submitting ? 'Submitting...' : 'Submit Prediction'}
            </button>
          </div>
        )}

        {/* State C: Results Screen */}
        {showResults && (
          challenge.is_resolved ? (
            <div style={{ textAlign: 'center', animation: 'fade-in 0.3s ease', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
               <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
                 {score === (questionCount * 10) ? '🏆' : score > 0 ? '🎯' : '😅'}
               </div>
               <h4 style={{ fontSize: '1.2rem', color: 'var(--gold)', marginBottom: '0.5rem' }}>
                 Score: {score / 10}/{questionCount}
               </h4>
               <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                 The AI Umpire has graded this match!
               </p>
               <button onClick={() => navigate(`/challenge/${challenge.id}`)} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                 View Leaderboard
               </button>
             </div>
          ) : (
            <div style={{ textAlign: 'center', animation: 'fade-in 0.3s ease', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
               <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⏳</div>
               <h4 style={{ fontSize: '1.1rem', color: '#ff9800', marginBottom: '0.5rem' }}>Prediction Locked In!</h4>
               <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.4 }}>
                 Waiting for the match to end and the AI Umpire to publish results.
               </p>
               <button onClick={() => navigate(`/challenge/${challenge.id}`)} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                 View Details
               </button>
             </div>
          )
        )}

      </div>

      {/* Navigation Controls */}
      {currentStep < questionCount && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-glass)' }}>
          <button 
            onClick={handlePrev} 
            disabled={currentStep === 0}
            style={{ 
               background: 'none', border: 'none', color: 'var(--text-primary)', 
               opacity: currentStep === 0 ? 0.3 : 0.8, cursor: currentStep === 0 ? 'default' : 'pointer',
               fontSize: '0.85rem', fontWeight: 600, padding: '0.5rem'
            }}
          >
            ← Prev
          </button>
          <button 
            onClick={handleNext}
            disabled={currentStep === questionCount || (currentStep < questionCount && answers[currentStep] === -1)}
            style={{ 
               background: 'none', border: 'none', color: 'var(--gold)', 
               opacity: Math.max(0.3, answers[currentStep] !== -1 ? 1 : 0.3), 
               cursor: answers[currentStep] === -1 ? 'default' : 'pointer',
               fontSize: '0.85rem', fontWeight: 600, padding: '0.5rem'
            }}
          >
            {currentStep === questionCount - 1 ? 'Review →' : 'Next →'}
          </button>
        </div>
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

      {showComments && <CommentsSection challengeId={challenge.id} onClose={() => setShowComments(false)} />}

    </div>
  )
}
