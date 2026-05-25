// ─────────────────────────────────────────────────────────────
// AuthGuard — wraps protected routes.
// Unauthenticated users → /login?next=<current-path>
// Shows a minimal spinner while Supabase resolves the session.
// ─────────────────────────────────────────────────────────────
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AuthGuard({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '12px',
        flexDirection: 'column',
      }}>
        <div className="auth-spinner" aria-label="Checking authentication…" />
        <p className="text-muted" style={{ fontSize: '0.9rem' }}>
          Checking authentication…
        </p>
      </div>
    )
  }

  if (!user) {
    // Preserve the intended destination so we can redirect back after login
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    )
  }

  return children
}
