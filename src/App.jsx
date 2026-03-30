import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useEffect } from 'react'
import { supabase } from './supabase'
import Navbar from './components/Navbar'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Messages from './pages/Messages'
import Profile from './pages/Profile'
import Login from './pages/Login'
import CreateChallenge from './pages/CreateChallenge'
import PlayChallenge from './pages/PlayChallenge'

function NotFound() {
  return (
    <div className="page">
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div className="empty-state">
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Page Not Found</h2>
          <p style={{ marginBottom: '1.5rem' }}>This page doesn't exist.</p>
          <a href="/home" className="btn btn-primary">🏠 Go to Dashboard</a>
        </div>
      </div>
    </div>
  )
}

// Handle Supabase OAuth callback redirect (URL contains #access_token=...)
function AuthCallback() {
  const navigate = useNavigate()
  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      // Supabase will parse the hash and establish the session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          navigate('/home', { replace: true })
        } else {
          navigate('/', { replace: true })
        }
      })
    } else {
      // No auth token — go to /home or login
      navigate('/home', { replace: true })
    }
  }, [navigate])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<AuthCallback />} />
            <Route path="/login" element={<Login />} />
            <Route path="/home" element={<Home />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/challenge/create/:matchId" element={<CreateChallenge />} />
            <Route path="/challenge/:id" element={<PlayChallenge />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <BottomNav />
      </AuthProvider>
    </BrowserRouter>
  )
}
