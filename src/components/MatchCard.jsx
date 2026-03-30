import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function MatchCard({ match }) {
  const navigate = useNavigate()
  // Extract data with fallbacks
  const name = match.name || "Unknown Match"
  const date = match.dateTimeGMT ? new Date(match.dateTimeGMT + "Z").toLocaleString() : "TBD"
  const venue = match.venue || "TBD"
  const status = match.status || "Unknown Status"
  const matchType = match.matchType || "T20"

  // Teams array usually has 2 items or "teamInfo" array
  const teams = match.teamInfo || []
  const team1 = teams.length > 0 ? teams[0] : { name: "Team 1", shortname: "T1" }
  const team2 = teams.length > 1 ? teams[1] : { name: "Team 2", shortname: "T2" }
  
  // Score array holds the current scores
  const score = match.score || []
  const team1Score = score.find(s => s.inning.includes(team1.name))
  const team2Score = score.find(s => s.inning.includes(team2.name))

  // Determine badge color based on match status
  // matchStarted is boolean, matchEnded is boolean
  let badgeClass = "badge-upcoming"
  let statusText = "Upcoming"
  
  if (match.matchEnded) {
    badgeClass = "badge-completed"
    statusText = "Completed"
  } else if (match.matchStarted) {
    badgeClass = "badge-live"
    statusText = "LIVE"
  }

  return (
    <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer' }}
      onClick={() => navigate(`/challenge/create/${match.id}`, { state: { match } })}
    >
      
      {/* Header: Date, Format, Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="tag">{matchType}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{date}</span>
        </div>
        <span className={`badge ${badgeClass}`}>{statusText}</span>
      </div>

      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        📍 {venue}
      </div>

      {/* Teams & Scores */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
        {/* Team 1 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {team1.img && <img src={team1.img} alt={team1.shortname} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />}
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{team1.name}</span>
          </div>
          {team1Score && (
            <div style={{ fontWeight: 600, fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
              {team1Score.r}/{team1Score.w} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({team1Score.o})</span>
            </div>
          )}
        </div>

        {/* Team 2 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {team2.img && <img src={team2.img} alt={team2.shortname} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />}
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{team2.name}</span>
          </div>
          {team2Score && (
            <div style={{ fontWeight: 600, fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
              {team2Score.r}/{team2Score.w} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({team2Score.o})</span>
            </div>
          )}
        </div>
      </div>

      {/* Match Status */}
      <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: match.matchEnded ? 'var(--gold-light)' : 'var(--text-secondary)', fontWeight: 500 }}>
          {status}
        </span>
      </div>

    </div>
  )
}
