import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <span className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    )
  }

  if (!user) {
    // Save the intended route so we can jump back to it after logging in
    sessionStorage.setItem('redirectAfterAuth', location.pathname + location.search)
    return <Navigate to="/" replace />
  }

  return children
}
