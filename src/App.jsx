import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Navbar from './components/Navbar'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Messages from './pages/Messages'
import Profile from './pages/Profile'
import Login from './pages/Login'

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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/home" element={<Home />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <BottomNav />
      </AuthProvider>
    </BrowserRouter>
  )
}
