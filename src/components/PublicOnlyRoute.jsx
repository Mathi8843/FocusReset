// ─────────────────────────────────────────────────────────────
// PublicOnlyRoute — wraps /login and /register.
// Redirects already-authenticated users to /dashboard.
// ─────────────────────────────────────────────────────────────
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth()

  // Still resolving session — render nothing to avoid flash
  if (loading) return null

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
