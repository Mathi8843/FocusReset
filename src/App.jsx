import { useEffect, useState, useCallback } from 'react'
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Reset from './pages/Reset.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Onboarding from './pages/Onboarding.jsx'
import IntegrationCallback from './pages/IntegrationCallback.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import CalendarToast from './components/CalendarToast.jsx'
import AuthGuard from './components/AuthGuard.jsx'
import PublicOnlyRoute from './components/PublicOnlyRoute.jsx'
import { isOnboardingComplete, getProfile } from './utils/storage.js'
import { useAuth } from './contexts/AuthContext.jsx'
import { supabase } from './services/supabaseClient.js'
import AdminDashboard from './pages/AdminDashboard.jsx'
import Upgrade from './pages/Upgrade.jsx'
import Profile from './pages/Profile.jsx'
import {
  loadGSIScript,
  pollForEndedMeetings,
  markMeetingsAsShown,
  isCalendarConnected,
} from './services/calendarService.js'

const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/* ----------------------------------------------------------------
   Guard — redirects to /onboarding if user hasn't set up yet.
   Only enforces on non-onboarding routes.
---------------------------------------------------------------- */
function OnboardingGuard({ children }) {
  const location = useLocation()
  if (location.pathname === '/onboarding') return children
  if (!isOnboardingComplete()) {
    return <Navigate to="/onboarding" replace />
  }
  return children
}

/* ----------------------------------------------------------------
   Nav — hidden on /reset and /onboarding
   Shows user email + logout when authenticated.
---------------------------------------------------------------- */
function Nav() {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [plan, setPlan] = useState('free')
  const [isAdmin, setIsAdmin] = useState(false)
  const hidden = ['/reset', '/onboarding'].includes(location.pathname)

  useEffect(() => {
    if (user) {
      getProfile().then(profile => {
        if (profile?.plan) {
          setPlan(profile.plan)
        }
      })
      
      // Check if user is a team admin
      supabase
        .from('team_members')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data) {
            setIsAdmin(data.role === 'admin')
          } else {
            setIsAdmin(false)
          }
        })
    } else {
      setIsAdmin(false)
    }
  }, [user, location.pathname])

  if (hidden) return null

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const renderPlanBadge = () => {
    if (plan === 'pro') {
      return (
        <span className="plan-badge plan-badge-pro" title="Pro subscription active">
          Pro
        </span>
      )
    }
    if (plan === 'team') {
      return (
        <span className="plan-badge plan-badge-team" title="Team subscription active">
          Team
        </span>
      )
    }
    return (
      <span className="plan-badge plan-badge-free" title="Free tier - 5 resets per month limit">
        Free
      </span>
    )
  }

  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      <Link to="/" className="nav-logo">
        Focus<span>Reset</span>
      </Link>
      <ul className="nav-links">
        {user ? (
          <>
            <li>{renderPlanBadge()}</li>
            {/* {plan === 'free' && <li><Link to="/upgrade">Upgrade Plan</Link></li>} */}
            {isAdmin && <li><Link to="/admin">Manage Team</Link></li>}
            <li><Link to="/profile">Profile</Link></li>
            <li><Link to="/dashboard">Dashboard</Link></li>
            <li>
              <Link to="/reset">
                <button className="btn btn-primary btn-sm">Start Reset</button>
              </Link>
            </li>
            <li>
              <button
                id="nav-logout-btn"
                className="btn btn-ghost btn-sm"
                onClick={handleLogout}
                title={`Signed in as ${user.email}`}
              >
                Sign out
              </button>
            </li>
          </>
        ) : (
          <>
            <li><Link to="/login">Sign in</Link></li>
            <li>
              <Link to="/register">
                <button className="btn btn-primary btn-sm">Get started</button>
              </Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  )
}

/* ----------------------------------------------------------------
   Calendar polling hook — runs at top-level so it survives
   page navigation. Detects meetings that ended ≤30 min ago.
---------------------------------------------------------------- */
function useCalendarPoller(onMeetingsEnded) {
  const poll = useCallback(() => {
    if (!isCalendarConnected()) return
    const ended = pollForEndedMeetings()
    if (ended.length > 0) onMeetingsEnded(ended)
  }, [onMeetingsEnded])

  useEffect(() => {
    // Pre-load the GSI script in the background so the Dashboard
    // connect button works without any delay.
    loadGSIScript().catch(() => {
      // Silently ignore — user may not have configured Google Client ID yet
    })

    // Initial poll after a short delay (page just loaded)
    const initialTimer = setTimeout(poll, 3000)

    // Recurring poll every 5 minutes
    const interval = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [poll])
}

/* ----------------------------------------------------------------
   Root App
---------------------------------------------------------------- */
export default function App() {
  // Meetings that have ended and should show a toast
  const [endedMeetings, setEndedMeetings] = useState([])
  // Pending meeting context to pre-fill in Reset flow
  const [pendingMeeting, setPendingMeeting] = useState(null)
  const navigate = useNavigate()

  const handleMeetingsEnded = useCallback((meetings) => {
    setEndedMeetings(prev => {
      // Deduplicate by id
      const existingIds = new Set(prev.map(m => m.id))
      const newOnes = meetings.filter(m => !existingIds.has(m.id))
      return newOnes.length > 0 ? [...prev, ...newOnes] : prev
    })
  }, [])

  useCalendarPoller(handleMeetingsEnded)

  function handleToastDismiss() {
    // Mark shown so they never re-appear
    markMeetingsAsShown(endedMeetings.map(m => m.id))
    setEndedMeetings([])
  }

  function handleToastStartReset(meeting) {
    // Mark all current toasted meetings as shown
    markMeetingsAsShown(endedMeetings.map(m => m.id))
    setEndedMeetings([])
    // Store pending context then navigate to /reset
    setPendingMeeting(meeting)
    navigate('/reset')
  }

  // Once Reset page mounts and reads pendingMeeting, clear it
  function consumePendingMeeting() {
    const copy = pendingMeeting
    setPendingMeeting(null)
    return copy
  }

  return (
    <>
      <Nav />
      <main className="page">
        <Routes>
          {/* ── Public auth routes ─────────────────────────── */}
          <Route path="/login" element={
            <PublicOnlyRoute><Login /></PublicOnlyRoute>
          } />
          <Route path="/register" element={
            <PublicOnlyRoute><Register /></PublicOnlyRoute>
          } />

          {/* Onboarding — auth-gated but not onboarding-gated */}
          <Route path="/onboarding" element={
            <AuthGuard><Onboarding /></AuthGuard>
          } />

          {/* ── Protected app routes ───────────────────────── */}
          <Route path="/" element={
            <AuthGuard>
              <OnboardingGuard><Landing /></OnboardingGuard>
            </AuthGuard>
          } />
          <Route path="/reset" element={
            <AuthGuard>
              <OnboardingGuard>
                <Reset
                  prefillMeeting={pendingMeeting}
                  onPrefillConsumed={consumePendingMeeting}
                />
              </OnboardingGuard>
            </AuthGuard>
          } />
          <Route path="/dashboard" element={
            <AuthGuard>
              <OnboardingGuard><Dashboard /></OnboardingGuard>
            </AuthGuard>
          } />
          <Route path="/admin" element={
            <AuthGuard>
              <OnboardingGuard><AdminDashboard /></OnboardingGuard>
            </AuthGuard>
          } />
          <Route path="/upgrade" element={
            <AuthGuard>
              <OnboardingGuard><Upgrade /></OnboardingGuard>
            </AuthGuard>
          } />
          <Route path="/profile" element={
            <AuthGuard>
              <OnboardingGuard><Profile /></OnboardingGuard>
            </AuthGuard>
          } />
          <Route path="/integrations/:provider/callback" element={
            <AuthGuard>
              <OnboardingGuard><IntegrationCallback /></OnboardingGuard>
            </AuthGuard>
          } />
        </Routes>
      </main>

      {/* Global calendar toast — rendered outside of routes so it
          persists during navigation */}
      {endedMeetings.length > 0 && (
        <CalendarToast
          meetings={endedMeetings}
          onDismiss={handleToastDismiss}
          onStartReset={handleToastStartReset}
        />
      )}
    </>
  )
}
