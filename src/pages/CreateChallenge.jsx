import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { createChallenge } from '../utils/challenges'

export default function CreateChallenge() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const match = location.state?.match

  const [questions, setQuestions] = useState([
    { question: '', options: ['', ''], answer: -1 }
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  if (!match) {
    return (
      <div className="page">
        <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Match Selected</h2>
            <p>Please select a match from the home page first.</p>
            <button className="btn btn-primary" onClick={() => navigate('/home')} style={{ marginTop: '1.5rem' }}>Go Home</button>
          </div>
        </div>
      </div>
    )
  }

  const addQuestion = () => {
    setQuestions([...questions, { question: '', options: ['', ''], answer: -1 }])
  }

  const removeQuestion = (qi) => {
    if (questions.length <= 1) return
    setQuestions(questions.filter((_, i) => i !== qi))
  }

  const updateQuestion = (qi, value) => {
    const updated = [...questions]
    updated[qi].question = value
    setQuestions(updated)
  }

  const updateOption = (qi, oi, value) => {
    const updated = [...questions]
    updated[qi].options[oi] = value
    setQuestions(updated)
  }

  const addOption = (qi) => {
    if (questions[qi].options.length >= 4) return
    const updated = [...questions]
    updated[qi].options.push('')
    setQuestions(updated)
  }

  const removeOption = (qi, oi) => {
    if (questions[qi].options.length <= 2) return
    const updated = [...questions]
    updated[qi].options.splice(oi, 1)
    if (updated[qi].answer === oi) updated[qi].answer = -1
    else if (updated[qi].answer > oi) updated[qi].answer--
    setQuestions(updated)
  }

  const setAnswer = (qi, oi) => {
    const updated = [...questions]
    updated[qi].answer = oi
    setQuestions(updated)
  }

  const isValid = () => {
    return questions.every(q =>
      q.question.trim() &&
      q.options.every(o => o.trim()) &&
      q.answer >= 0
    )
  }

  const handleSubmit = async () => {
    if (!isValid()) {
      setError('Please fill in all questions, options, and select your answer for each.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const challenge = await createChallenge({
        matchId: match.id,
        matchName: match.name,
        matchDate: match.dateTimeGMT,
        questions: questions,
      })
      navigate(`/challenge/${challenge.id}`, { state: { justCreated: true } })
    } catch (err) {
      console.error('Challenge creation error:', err)
      // Show full error details (code, message, details, hint)
      const detail = [err.code, err.message, err.details, err.hint].filter(Boolean).join(' | ')
      setError(detail || 'Unknown error. Check the browser console.')
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: '700px' }}>

        {/* Match Header */}
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span className="tag">IPL</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {match.dateTimeGMT ? new Date(match.dateTimeGMT + 'Z').toLocaleString() : 'TBD'}
            </span>
          </div>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>{match.name}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>📍 {match.venue || 'TBD'}</p>
        </div>

        <h1 style={{ marginBottom: '0.5rem' }}>Create Challenge</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Add your prediction questions, pick your answers, and challenge your friends!
        </p>

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {questions.map((q, qi) => (
            <div key={qi} className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '0.85rem' }}>QUESTION {qi + 1}</span>
                {questions.length > 1 && (
                  <button onClick={() => removeQuestion(qi)} style={{ background: 'none', color: '#fc8181', fontSize: '0.8rem', cursor: 'pointer' }}>✕ Remove</button>
                )}
              </div>

              <input
                className="form-input"
                placeholder="e.g. Who will win the match?"
                value={q.question}
                onChange={e => updateQuestion(qi, e.target.value)}
                style={{ marginBottom: '1rem' }}
              />

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600 }}>
                OPTIONS — <span style={{ color: 'var(--gold)' }}>tap ✓ to mark your answer</span>
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {q.options.map((opt, oi) => {
                  const isSelected = q.answer === oi
                  return (
                    <div key={oi} style={{
                      display: 'flex', gap: '0.5rem', alignItems: 'center',
                      background: isSelected ? 'rgba(76,175,80,0.08)' : 'transparent',
                      border: isSelected ? '1.5px solid rgba(76,175,80,0.5)' : '1.5px solid transparent',
                      borderRadius: 'var(--radius-sm)', padding: '0.25rem 0.25rem 0.25rem 0',
                      transition: 'all 0.2s',
                    }}>
                      {/* Option letter badge */}
                      <span style={{
                        width: 28, height: 28, minWidth: 28, borderRadius: '50%',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)',
                        marginLeft: '0.35rem',
                      }}>
                        {String.fromCharCode(65 + oi)}
                      </span>
                      {/* Text input */}
                      <input
                        className="form-input"
                        placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                        value={opt}
                        onChange={e => updateOption(qi, oi, e.target.value)}
                        style={{ flex: 1, background: 'transparent', borderColor: 'transparent', boxShadow: 'none' }}
                      />
                      {/* Remove option */}
                      {q.options.length > 2 && (
                        <button onClick={() => removeOption(qi, oi)} style={{ background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '0 0.25rem' }}>×</button>
                      )}
                      {/* My Answer selector — right side, prominent */}
                      <button
                        onClick={() => setAnswer(qi, oi)}
                        title="Mark as my answer"
                        style={{
                          minWidth: isSelected ? 100 : 36, height: 36,
                          borderRadius: 'var(--radius-sm)',
                          border: isSelected ? '2px solid #4caf50' : '2px solid var(--border-glass)',
                          background: isSelected ? '#4caf50' : 'var(--bg-secondary)',
                          color: isSelected ? '#fff' : 'var(--text-muted)',
                          fontWeight: 700, fontSize: '0.75rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                          cursor: 'pointer', transition: 'all 0.2s',
                          whiteSpace: 'nowrap', padding: '0 0.75rem',
                        }}
                      >
                        {isSelected ? '✓ My Answer' : '✓'}
                      </button>
                    </div>
                  )
                })}
              </div>

              {q.options.length < 4 && (
                <button onClick={() => addOption(qi)} className="btn btn-ghost" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
                  + Add Option
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add Question Button */}
        <button onClick={addQuestion} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
          + Add Another Question
        </button>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !isValid()}
          className="btn btn-primary"
          style={{
            width: '100%', justifyContent: 'center', marginTop: '1.5rem',
            fontSize: '1.1rem', padding: '1rem',
            opacity: (!isValid() && !submitting) ? 0.5 : 1,
          }}
        >
          {submitting ? (
            <><span className="spinner" /> Creating Challenge...</>
          ) : (
            '🚀 Create & Share Challenge'
          )}
        </button>

      </div>
    </div>
  )
}
