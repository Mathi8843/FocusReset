import { useEffect, useState, useCallback } from 'react'
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Reset from './pages/Reset.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Onboarding from './pages/Onboarding.jsx'
import IntegrationCallback from './pages/IntegrationCallback.jsx'
import CalendarToast from './components/CalendarToast.jsx'
import { isOnboardingComplete } from './utils/storage.js'
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
---------------------------------------------------------------- */
function Nav() {
  const location = useLocation()
  const hidden = ['/reset', '/onboarding'].includes(location.pathname)
  if (hidden) return null

  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      <Link to="/" className="nav-logo">
        Focus<span>Reset</span>
      </Link>
      <ul className="nav-links">
        <li><Link to="/dashboard">Dashboard</Link></li>
        <li>
          <Link to="/reset">
            <button className="btn btn-primary btn-sm">Start Reset</button>
          </Link>
        </li>
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
          {/* Onboarding — no guard needed, is the guard destination */}
          <Route path="/onboarding" element={<Onboarding />} />

          {/* All other routes gated behind onboarding */}
          <Route path="/" element={
            <OnboardingGuard><Landing /></OnboardingGuard>
          } />
          <Route path="/reset" element={
            <OnboardingGuard>
              <Reset
                prefillMeeting={pendingMeeting}
                onPrefillConsumed={consumePendingMeeting}
              />
            </OnboardingGuard>
          } />
          <Route path="/dashboard" element={
            <OnboardingGuard><Dashboard /></OnboardingGuard>
          } />
          <Route path="/integrations/:provider/callback" element={
            <OnboardingGuard><IntegrationCallback /></OnboardingGuard>
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
