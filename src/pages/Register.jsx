// ─────────────────────────────────────────────────────────────
// Register page — Email/Password + Google OAuth
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'

export default function Register() {
  const navigate = useNavigate()

  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [error,     setError]     = useState('')
  const [message,   setMessage]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  /* ── Email / Password registration ───────────────────────── */
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error

      // If email confirmation is enabled in Supabase, session will be null
      if (data.session) {
        navigate('/dashboard', { replace: true })
      } else {
        setMessage(
          'Account created! Check your email for a confirmation link before signing in.'
        )
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  /* ── Google OAuth ─────────────────────────────────────────── */
  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      })
      if (error) throw error
    } catch (err) {
      setError(err.message || 'Google sign-up failed.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card animate-fade-in">
        {/* Header */}
        <div className="auth-header">
          <Link to="/" className="auth-logo">
            Focus<span>Reset</span>
          </Link>
          <h1 className="auth-title">Create account</h1>
          <p className="auth-subtitle">Start your meeting recovery journey</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="auth-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        {/* Success banner (email confirmation required) */}
        {message && (
          <div className="auth-success" role="status">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 8l2.5 2.5L11 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {message}
          </div>
        )}

        {/* Google OAuth */}
        {!message && (
          <>
            <button
              id="register-google-btn"
              className="btn btn-ghost btn-google w-full"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              type="button"
            >
              {googleLoading ? (
                <span className="auth-spinner-sm" aria-hidden="true" />
              ) : (
                <GoogleIcon />
              )}
              {googleLoading ? 'Redirecting…' : 'Continue with Google'}
            </button>

            <div className="auth-divider">
              <span>or register with email</span>
            </div>

            {/* Form */}
            <form id="register-form" className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="auth-field">
                <label htmlFor="register-email" className="auth-label">Email</label>
                <input
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="auth-field">
                <label htmlFor="register-password" className="auth-label">Password</label>
                <input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="auth-field">
                <label htmlFor="register-confirm" className="auth-label">Confirm password</label>
                <input
                  id="register-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <button
                id="register-submit-btn"
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading || googleLoading}
              >
                {loading ? (
                  <>
                    <span className="auth-spinner-sm" aria-hidden="true" />
                    Creating account…
                  </>
                ) : 'Create account'}
              </button>
            </form>
          </>
        )}

        {/* Footer */}
        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" id="register-login-link">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

/* ── Google "G" SVG icon ──────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  )
}
