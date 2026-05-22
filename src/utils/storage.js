/**
 * storage.js — localStorage helpers for FocusReset session data.
 *
 * Each session record shape:
 * {
 *   id:           string (timestamp-based)
 *   date:         ISO string
 *   meetingType:  string
 *   priorityTask: string
 *   stepTimings:  { brainDump, priorityReset, entryTask, focusTimer } — seconds
 *   totalDuration: number — seconds from start to completion
 *   completed:    boolean
 *   earlyExit:    boolean — true if user clicked "I'm in flow" before 25min
 * }
 */

const STORAGE_KEY = 'focusreset_sessions'

/* ---- Read all sessions from localStorage ---- */
export function getSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/* ---- Save a new session ---- */
export function saveSession(session) {
  const sessions = getSessions()
  const newSession = {
    id: `session_${Date.now()}`,
    ...session,
  }
  sessions.push(newSession)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch (e) {
    console.warn('Could not save session:', e)
  }
  return newSession
}

/* ---- Clear all sessions (for testing) ---- */
export function clearSessions() {
  localStorage.removeItem(STORAGE_KEY)
}

/* ================================================================
   USER PROFILE — saved once during Onboarding
================================================================ */
const PROFILE_KEY = 'focusreset_profile'

/** Save (or overwrite) the user profile */
export function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch (e) {
    console.warn('Could not save profile:', e)
  }
}

/** Read the user profile — returns null if not set */
export function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Returns true if the user has completed onboarding */
export function isOnboardingComplete() {
  const profile = getProfile()
  return !!(profile?.onboardingCompleted)
}

/* ---- Helpers for Dashboard analytics ---- */

/* Get sessions from the last N days */
export function getSessionsLastNDays(n = 7) {
  const sessions = getSessions()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - n)
  cutoff.setHours(0, 0, 0, 0)
  return sessions.filter(s => new Date(s.date) >= cutoff)
}

/* Sessions completed this week (Mon–Sun) */
export function getSessionsThisWeek() {
  const sessions = getSessions()
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = Sun
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  return sessions.filter(s => new Date(s.date) >= monday && s.completed)
}

/* Average minutes to enter flow (totalDuration excluding 25-min block) */
export function getAvgTimeToFlow() {
  const sessions = getSessions().filter(s => s.completed)
  if (sessions.length === 0) return null
  // Steps 1–3 = totalDuration minus focus timer portion
  const focusDuration = 25 * 60 // max, early exits will be less
  const setupTimes = sessions.map(s => {
    const focusSecs = s.stepTimings?.focusTimer ?? focusDuration
    return Math.max(0, s.totalDuration - focusSecs)
  })
  const avg = setupTimes.reduce((a, b) => a + b, 0) / setupTimes.length
  return Math.round(avg / 60) // return minutes
}

/* Most frequent meeting type across all sessions */
export function getMostDrainingMeetingType() {
  const sessions = getSessions()
  if (sessions.length === 0) return null
  const counts = {}
  sessions.forEach(s => {
    if (s.meetingType) counts[s.meetingType] = (counts[s.meetingType] || 0) + 1
  })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

/* Current streak — consecutive calendar days with at least 1 completed session */
export function getCurrentStreak() {
  const sessions = getSessions().filter(s => s.completed)
  if (sessions.length === 0) return 0

  /* Build a Set of date strings YYYY-MM-DD */
  const dateset = new Set(
    sessions.map(s => new Date(s.date).toISOString().slice(0, 10))
  )

  let streak = 0
  const today = new Date()

  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (dateset.has(key)) {
      streak++
    } else {
      break
    }
  }

  return streak
}

/* Sessions per day for the last 7 days — returns array of { date, label, count } */
export function getSessionsPerDay(days = 7) {
  const sessions = getSessions().filter(s => s.completed)
  const result = []
  const today = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)

    /* Short day label e.g. "Mon", "Tue" */
    const label = d.toLocaleDateString('en-US', { weekday: 'short' })

    const count = sessions.filter(s => {
      return new Date(s.date).toISOString().slice(0, 10) === key
    }).length

    result.push({ date: key, label, count })
  }

  return result
}
