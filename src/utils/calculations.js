/**
 * calculations.js
 * Pure calculation functions for Dashboard analytics.
 * All functions accept a sessions array (from getSessions()) so they
 * are fully testable without touching localStorage directly.
 *
 * Session shape (for reference):
 * {
 *   id, date (ISO), meetingType, priorityTask,
 *   stepTimings: { brainDump, priorityReset, entryTask, focusTimer } (seconds),
 *   totalDuration (seconds), completed (bool), earlyExit (bool)
 * }
 */

/* ---------------------------------------------------------------
   DATE HELPERS
--------------------------------------------------------------- */

/** Returns a YYYY-MM-DD string for any Date object (local time) */
export function toDateKey(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Returns the Monday of the week containing `date` at 00:00:00 */
function getMondayOfWeek(date) {
  const d = new Date(date)
  const dow = d.getDay() // 0 = Sun
  d.setDate(d.getDate() - ((dow + 6) % 7))
  d.setHours(0, 0, 0, 0)
  return d
}

/* ---------------------------------------------------------------
   CORE FILTERS
--------------------------------------------------------------- */

/**
 * getThisWeekSessions
 * Returns all completed sessions within the current Mon–Sun week.
 */
export function getThisWeekSessions(sessions) {
  const monday = getMondayOfWeek(new Date())
  return sessions.filter(s => s.completed && new Date(s.date) >= monday)
}

/**
 * getLastWeekSessions
 * Returns all completed sessions within the previous Mon–Sun week.
 * Used for week-over-week trend arrows.
 */
export function getLastWeekSessions(sessions) {
  const thisMonday = getMondayOfWeek(new Date())
  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(lastMonday.getDate() - 7)
  return sessions.filter(s => {
    const d = new Date(s.date)
    return s.completed && d >= lastMonday && d < thisMonday
  })
}

/* ---------------------------------------------------------------
   STAT CALCULATIONS
--------------------------------------------------------------- */

/**
 * getStreak
 * Counts consecutive calendar days going back from today (inclusive)
 * that have at least 1 completed session.
 * Returns 0 if today has no session.
 */
export function getStreak(sessions) {
  const completed = sessions.filter(s => s.completed)
  if (completed.length === 0) return 0

  const dateSet = new Set(completed.map(s => toDateKey(new Date(s.date))))

  let streak = 0
  const today = new Date()

  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    if (dateSet.has(toDateKey(d))) {
      streak++
    } else {
      break
    }
  }

  return streak
}

/**
 * getAverageRecoveryTime
 * Average seconds spent in Steps 1–3 (brain dump + priority + entry task)
 * across all completed sessions. Returns null if no data.
 * Returns result in whole seconds.
 */
export function getAverageRecoveryTime(sessions) {
  const completed = sessions.filter(s => s.completed && s.stepTimings)
  if (completed.length === 0) return null

  const setupSecs = completed.map(s => {
    const { brainDump = 0, priorityReset = 0, entryTask = 0 } = s.stepTimings
    return brainDump + priorityReset + entryTask
  })

  const avg = setupSecs.reduce((a, b) => a + b, 0) / setupSecs.length
  return Math.round(avg) // seconds
}

/**
 * getAverageHangoverScore
 * Average meeting hangover score across completed sessions with score data.
 */
export function getAverageHangoverScore(sessions) {
  const scored = sessions.filter(s => s.completed && Number.isFinite(s.hangoverScore?.score))
  if (scored.length === 0) return null

  const avg = scored.reduce((total, session) => total + session.hangoverScore.score, 0) / scored.length
  return Math.round(avg)
}

/**
 * getHighHangoverSessions
 * Counts completed sessions with a high hangover score.
 */
export function getHighHangoverSessions(sessions) {
  return sessions.filter(s => s.completed && (s.hangoverScore?.score ?? 0) >= 75).length
}

/**
 * getTotalFocusMinutes
 * Sum of focus timer seconds for a given sessions array, converted to minutes.
 * Counts actual time spent in the focus timer (earlyExit sessions use their
 * focusTimer stepTiming; full sessions get capped at 25 min).
 */
export function getTotalFocusMinutes(sessions) {
  const completed = sessions.filter(s => s.completed)
  if (completed.length === 0) return 0

  const totalSecs = completed.reduce((acc, s) => {
    // focusTimer stepTiming = seconds they actually spent in step 4
    const focusSecs = s.stepTimings?.focusTimer ?? 25 * 60
    return acc + Math.min(focusSecs, 25 * 60)
  }, 0)

  return Math.round(totalSecs / 60)
}

/* ---------------------------------------------------------------
   MEETING TYPE DRAIN RANKING
--------------------------------------------------------------- */

/**
 * getMeetingTypeDrainRanking
 * Groups sessions by meetingType, computes:
 *   - count: total sessions of that type
 *   - avgDrain: average recovery time (steps 1–3) in seconds
 *   - totalFocusMin: total focus minutes recovered from this type
 *
 * Returns array sorted by count desc (for "By Frequency" view).
 * The drain sort is done by the caller by sorting on avgDrain desc.
 */
export function getMeetingTypeDrainRanking(sessions) {
  const completed = sessions.filter(s => s.completed)
  if (completed.length === 0) return []

  // Group
  const groups = {}
  completed.forEach(s => {
    const type = s.meetingType || 'other'
    if (!groups[type]) {
      groups[type] = { type, count: 0, drainSecs: [], focusSecs: [] }
    }
    groups[type].count++

    if (s.stepTimings) {
      const { brainDump = 0, priorityReset = 0, entryTask = 0 } = s.stepTimings
      groups[type].drainSecs.push(brainDump + priorityReset + entryTask)
    }

    const focus = s.stepTimings?.focusTimer ?? 25 * 60
    groups[type].focusSecs.push(Math.min(focus, 25 * 60))
  })

  // Aggregate
  return Object.values(groups)
    .map(g => ({
      type: g.type,
      count: g.count,
      avgDrain: g.drainSecs.length
        ? Math.round(g.drainSecs.reduce((a, b) => a + b, 0) / g.drainSecs.length)
        : 0,
      totalFocusMin: Math.round(g.focusSecs.reduce((a, b) => a + b, 0) / 60),
      avgHangoverScore: _getAverageScoreForType(completed, g.type),
    }))
    .sort((a, b) => b.count - a.count) // default: by frequency
}

function _getAverageScoreForType(sessions, type) {
  const scored = sessions.filter(s => (s.meetingType || 'other') === type && Number.isFinite(s.hangoverScore?.score))
  if (!scored.length) return null
  return Math.round(scored.reduce((total, session) => total + session.hangoverScore.score, 0) / scored.length)
}

/* ---------------------------------------------------------------
   WEEKLY CHART DATA
--------------------------------------------------------------- */

/**
 * getSessionsPerDay
 * Builds a 7-day array (Mon→Sun of current week) with:
 *   { date, label, count, focusMin, isToday }
 * Used to drive the Recharts BarChart.
 */
export function getSessionsPerDay(sessions) {
  const completed = sessions.filter(s => s.completed)
  const todayKey = toDateKey(new Date())
  const monday = getMondayOfWeek(new Date())

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const key = toDateKey(d)
    const label = d.toLocaleDateString('en-US', { weekday: 'short' })

    const daySessions = completed.filter(s => toDateKey(new Date(s.date)) === key)
    const focusMin = daySessions.reduce((acc, s) => {
      return acc + Math.round(Math.min(s.stepTimings?.focusTimer ?? 25 * 60, 25 * 60) / 60)
    }, 0)

    return {
      date: key,
      label,
      count: daySessions.length,
      focusMin,
      isToday: key === todayKey,
    }
  })
}

/* ---------------------------------------------------------------
   TREND HELPERS (week-over-week)
--------------------------------------------------------------- */

/**
 * getTrend
 * Compares thisWeek vs lastWeek values and returns:
 *   { direction: 'up' | 'down' | 'flat', delta: number }
 */
export function getTrend(thisWeek, lastWeek) {
  if (lastWeek === 0 && thisWeek === 0) return { direction: 'flat', delta: 0 }
  if (lastWeek === 0) return { direction: 'up', delta: thisWeek }
  const delta = thisWeek - lastWeek
  return {
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    delta: Math.abs(delta),
  }
}

/* ---------------------------------------------------------------
   TIME FORMATTING
--------------------------------------------------------------- */

/** Formats seconds into "Xm Ys" or "X min" */
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  if (s === 0) return `${m}m`
  return `${m}m ${s}s`
}

/** Returns "Today", "Yesterday", or "Mon, May 19" */
export function formatRelativeDate(isoString) {
  const date = new Date(isoString)
  const todayKey = toDateKey(new Date())
  const dateKey = toDateKey(date)

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = toDateKey(yesterday)

  if (dateKey === todayKey) return 'Today'
  if (dateKey === yesterdayKey) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Returns "2:34 PM" */
export function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Returns time-of-day greeting string */
export function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
