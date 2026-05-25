/**
 * aiInsights.js
 * ────────────────────────────────────────────────────────────
 * AI Weekly Insight Report — powered by Groq (console.groq.com).
 *
 * The main export is generateWeeklyReport(sessions).
 * Results are cached in localStorage under "focusreset_weekly_report"
 * so we don't re-call the API on every dashboard load.
 *
 * Env var required: VITE_GROK_API_KEY  (paste your Groq API key here)
 * API endpoint: https://api.groq.com/openai/v1/chat/completions
 * Model: llama-3.3-70b-versatile (fast, free tier available)
 */

const API_KEY    = import.meta.env.VITE_GROK_API_KEY ?? ''
const GROK_URL   = API_KEY
  ? (import.meta.env.DEV ? '/api-groq/openai/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions')
  : '/api/groq'
const GROK_MODEL = 'llama-3.3-70b-versatile'
const CACHE_KEY  = 'focusreset_weekly_report'

/* ── Low-level Grok call ─────────────────────────────────────── */

async function callGrok(messages, maxTokens = 1200) {
  const headers = {
    'Content-Type': 'application/json',
  }
  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`
  }

  const response = await fetch(GROK_URL, {
    method:  'POST',
    headers,
    body: JSON.stringify({
      model:      GROK_MODEL,
      messages,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText)
    throw new Error(`Grok API ${response.status}: ${errText}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty response from Grok API')
  return text
}

/* ── Session summariser ──────────────────────────────────────── */

function buildSessionSummary(sessions) {
  if (!sessions || sessions.length === 0) return 'No session data available.'

  const completed = sessions.filter(s => s.completed)
  const totalMin  = completed.reduce((acc, s) => {
    return acc + Math.round(Math.min(s.stepTimings?.focusTimer ?? 25 * 60, 25 * 60) / 60)
  }, 0)

  // Meeting type breakdown
  const meetingCounts = {}
  const meetingDrains = {}
  const meetingScores = {}
  completed.forEach(s => {
    const mt = s.meetingType || 'other'
    meetingCounts[mt] = (meetingCounts[mt] || 0) + 1
    const recoverySecs = (s.stepTimings?.brainDump ?? 0)
      + (s.stepTimings?.priorityReset ?? 0)
      + (s.stepTimings?.entryTask ?? 0)
    meetingDrains[mt] = (meetingDrains[mt] || 0) + recoverySecs
    if (Number.isFinite(s.hangoverScore?.score)) {
      meetingScores[mt] = [...(meetingScores[mt] || []), s.hangoverScore.score]
    }
  })

  const meetingBreakdown = Object.entries(meetingCounts).map(([type, count]) => {
    const avgDrainMin = meetingDrains[type]
      ? Math.round((meetingDrains[type] / count) / 60)
      : 0
    const avgScore = meetingScores[type]?.length
      ? Math.round(meetingScores[type].reduce((a, b) => a + b, 0) / meetingScores[type].length)
      : 'N/A'
    return `${type}: ${count} session${count !== 1 ? 's' : ''}, avg ${avgDrainMin}min recovery, avg hangover score ${avgScore}`
  }).join('; ')

  // Task type breakdown
  const taskCounts = {}
  completed.forEach(s => {
    const t = s.priorityTask || 'unknown'
    taskCounts[t] = (taskCounts[t] || 0) + 1
  })
  const topTask = Object.entries(taskCounts).sort((a, b) => b[1] - a[1])[0]

  // Recovery times
  const recoverySecs = completed.map(s =>
    (s.stepTimings?.brainDump ?? 0) +
    (s.stepTimings?.priorityReset ?? 0) +
    (s.stepTimings?.entryTask ?? 0)
  ).filter(Boolean)
  const avgRecoveryMin = recoverySecs.length
    ? Math.round(recoverySecs.reduce((a, b) => a + b, 0) / recoverySecs.length / 60)
    : null

  // Best focus hours
  const hourCounts = {}
  completed.forEach(s => {
    const h = new Date(s.date).getHours()
    hourCounts[h] = (hourCounts[h] || 0) + 1
  })
  const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
  const bestTimeLabel = bestHour ? (bestHour < 12 ? 'morning' : bestHour < 17 ? 'afternoon' : 'evening') : 'unknown'

  return [
    `Total sessions (last 7 days): ${sessions.length} started, ${completed.length} completed`,
    `Total focus minutes recovered: ${totalMin}`,
    `Average recovery time: ${avgRecoveryMin ?? 'N/A'} minutes`,
    `Meeting type breakdown: ${meetingBreakdown || 'N/A'}`,
    `Most common priority task: ${topTask ? `${topTask[0]} (${topTask[1]}x)` : 'N/A'}`,
    `Best focus time of day: ${bestTimeLabel}`,
    `Sessions by day: ${_sessionsByDay(completed)}`,
  ].join('\n')
}

function _sessionsByDay(sessions) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const counts = {}
  sessions.forEach(s => {
    const d = days[new Date(s.date).getDay()]
    counts[d] = (counts[d] || 0) + 1
  })
  return days.filter(d => counts[d]).map(d => `${d}:${counts[d]}`).join(', ') || 'none'
}

/* ── Report shape / defaults ─────────────────────────────────── */

export const EMPTY_REPORT = {
  hangoverPattern: {
    title:   'Hangover Pattern',
    insight: null,
    metric:  null,
  },
  focusPeaks: {
    title:   'Focus Peaks',
    insight: null,
    metric:  null,
  },
  recoverySpeed: {
    title:   'Recovery Speed',
    insight: null,
    metric:  null,
  },
  weeklyMomentum: {
    title:   'Weekly Momentum',
    insight: null,
    metric:  null,
  },
  oneThing: {
    title:   'One Thing to Change',
    insight: null,
    metric:  null,
  },
  generatedAt: null,
  sessionCount: 0,
}

/* ── Cache helpers ───────────────────────────────────────────── */

export function getCachedReport() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const report = JSON.parse(raw)
    // Cache valid for 6 hours
    const ageHrs = (Date.now() - new Date(report.generatedAt).getTime()) / 3600000
    return ageHrs < 6 ? report : null
  } catch {
    return null
  }
}

export function clearReportCache() {
  localStorage.removeItem(CACHE_KEY)
}

/* ── Main export: generateWeeklyReport ───────────────────────── */

/**
 * Sends last 7 days of session data to Grok and returns a parsed
 * 5-section report. Caches the result in localStorage.
 *
 * @param {Array} sessions  — all sessions from getSessions()
 * @param {boolean} forceRefresh — bypass cache
 * @returns {Object} report matching EMPTY_REPORT shape
 */
export async function generateWeeklyReport(sessions, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCachedReport()
    if (cached) return cached
  }

  const now      = Date.now()
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
  const weekSessions = sessions.filter(s => new Date(s.date).getTime() >= sevenDaysAgo)

  if (weekSessions.length < 1) {
    throw new Error('Need at least 1 session to generate a report.')
  }

  const summary = buildSessionSummary(weekSessions)

  const systemPrompt = `You are a productivity coach embedded in FocusReset — a focus recovery app.
Analyze the user's session data and return exactly 5 insight sections as valid JSON.
Return ONLY raw JSON — no markdown, no explanation, no code fences.
Each section must have: title (string), insight (2-3 sentence analysis), metric (one key number or phrase as a string, e.g. "23 min avg").`

  const userContent = `Analyze this FocusReset weekly data and return a JSON object with exactly these 5 keys:
{
  "hangoverPattern": { "title": "Hangover Pattern", "insight": "...", "metric": "..." },
  "focusPeaks":      { "title": "Focus Peaks",       "insight": "...", "metric": "..." },
  "recoverySpeed":   { "title": "Recovery Speed",    "insight": "...", "metric": "..." },
  "weeklyMomentum":  { "title": "Weekly Momentum",   "insight": "...", "metric": "..." },
  "oneThing":        { "title": "One Thing to Change","insight": "...", "metric": "..." }
}

Rules:
- hangoverPattern: which meeting types drained this user the most
- focusPeaks: when in the day they reset fastest / their best window
- recoverySpeed: average recovery time vs what's typical (typical is 8–12 min)
- weeklyMomentum: trend — are they getting better or slipping
- oneThing: the single highest-leverage habit change for next week (specific and actionable)
- metric must be a short string like "2-on-1s drain 23 min" or "mornings: 38% faster"
- Return ONLY the JSON object, nothing else.

Session data:
${summary}`

  const raw = await callGrok(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userContent },
    ],
    1200
  )

  // Strip any accidental markdown fences
  const cleaned = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('Grok returned invalid JSON. Try again.')
  }

  // Validate shape
  const required = ['hangoverPattern', 'focusPeaks', 'recoverySpeed', 'weeklyMomentum', 'oneThing']
  for (const key of required) {
    if (!parsed[key]?.insight) {
      throw new Error(`Missing section "${key}" in AI response.`)
    }
  }

  const report = {
    ...parsed,
    generatedAt:  new Date().toISOString(),
    sessionCount: weekSessions.length,
  }

  // Cache it
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(report))
  } catch {
    /* storage full — skip cache */
  }

  return report
}
