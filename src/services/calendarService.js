/**
 * calendarService.js  (v2 — Google Identity Services / implicit token flow)
 * ─────────────────────────────────────────────────────────────────────────
 * Pure client-side Google Calendar integration using the GSI client library.
 * No server required — uses the implicit OAuth token flow via GSI popup.
 *
 * Flow:
 *   1. connectCalendar()         — opens GSI popup → user grants permission
 *   2. fetchCalendarData(token)  — fetches email + today's events with token
 *   3. syncCalendarData()        — re-fetches using stored token
 *   4. pollForEndedMeetings()    — returns meetings that ended in last 30 min
 *   5. getStoredCalendarData()   — reads cached integration state
 *   6. disconnectCalendar()      — removes all localStorage state
 *
 * Storage keys:
 *   focusreset_gtoken            — { access_token, expiresAt }
 *   focusreset_integration_google — { email, connectedAt, syncedAt }
 *   focusreset_calendar_meetings  — today's events array
 *   focusreset_shown_meetings     — set of event IDs already toasted
 *
 * Env var needed:
 *   VITE_GOOGLE_CLIENT_ID
 */

import { detectMeetingTypeFromTitle } from './contextAssembler.js'
import { getSessions } from '../utils/storage.js'
import { calculateHangoverScore } from '../utils/hangoverScore.js'

const CLIENT_ID    = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const SCOPES       = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email'

const TOKEN_KEY        = 'focusreset_gtoken'
const INTEGRATION_KEY  = 'focusreset_integration_google'
const MEETINGS_KEY     = 'focusreset_calendar_meetings'
const SHOWN_KEY        = 'focusreset_shown_meetings'

/* ── GSI Token Client ────────────────────────────────────────── */

/**
 * Loads the Google Identity Services script if not already present.
 * Resolves when window.google.accounts is ready.
 */
export function loadGSIScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('No window'))

    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }

    const existing = document.getElementById('gsi-script')
    if (existing) {
      // Script is loading — poll until ready
      const poll = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(poll)
          resolve()
        }
      }, 100)
      setTimeout(() => { clearInterval(poll); reject(new Error('GSI script load timeout')) }, 10000)
      return
    }

    const script = document.createElement('script')
    script.id  = 'gsi-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      // google.accounts may not be available immediately after onload
      const poll = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(poll)
          resolve()
        }
      }, 50)
      setTimeout(() => { clearInterval(poll); reject(new Error('GSI ready timeout')) }, 5000)
    }
    script.onerror = () => reject(new Error('Failed to load GSI script'))
    document.head.appendChild(script)
  })
}

/**
 * Opens the Google OAuth consent popup and resolves with an access token.
 */
export async function connectCalendar() {
  if (!CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not configured.\nAdd it to your .env file.')
  }

  await loadGSIScript()

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope:     SCOPES,
      callback:  async (tokenResponse) => {
        if (tokenResponse.error) {
          reject(new Error(`Google OAuth error: ${tokenResponse.error}`))
          return
        }

        const token = tokenResponse.access_token
        const expiresAt = Date.now() + (tokenResponse.expires_in ?? 3600) * 1000

        // Persist the token
        try {
          localStorage.setItem(TOKEN_KEY, JSON.stringify({ access_token: token, expiresAt }))
        } catch { /* storage issue */ }

        try {
          const result = await fetchCalendarData(token)
          resolve(result)
        } catch (err) {
          reject(err)
        }
      },
    })

    client.requestAccessToken({ prompt: 'select_account' })
  })
}

/* ── Data Fetching ───────────────────────────────────────────── */

/**
 * Fetches the user's Google profile email and today's calendar events.
 * Stores the result in localStorage.
 *
 * @param {string} token — Google OAuth access token
 */
export async function fetchCalendarData(token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept:        'application/json',
  }

  /* 1. Fetch user profile */
  let email = 'Google Account'
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers })
    if (res.ok) {
      const info = await res.json()
      email = info.email || email
    }
  } catch (err) {
    console.warn('[FocusReset] Google userinfo fetch failed:', err)
  }

  /* 2. Fetch today's events */
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  const params = new URLSearchParams({
    timeMin:      startOfDay.toISOString(),
    timeMax:      endOfDay.toISOString(),
    singleEvents: 'true',
    orderBy:      'startTime',
  })

  const eventsRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers }
  )

  if (!eventsRes.ok) throw new Error(`Google Calendar API error: ${eventsRes.status}`)
  const eventsData = await eventsRes.json()

  const meetingsBase = (eventsData.items ?? [])
    .filter(e => e.start?.dateTime) // only timed events (not all-day)
    .filter(e => _isActualMeeting(e)) // must have attendees or video link
    .map(e => ({
      id:          e.id,
      summary:     e.summary || 'Untitled Meeting',
      startTime:   e.start.dateTime,
      endTime:     e.end?.dateTime || e.start.dateTime,
      meetingType: detectMeetingTypeFromTitle(e.summary),
      htmlLink:    e.htmlLink || '',
      attendees:   (e.attendees?.length ?? 0),
    }))

  const sessions = getSessions()
  const meetings = meetingsBase.map(meeting => ({
    ...meeting,
    hangoverScore: calculateHangoverScore({
      meeting,
      allMeetings: meetingsBase,
      sessions,
    }),
  }))

  const integration = {
    email,
    connectedAt: new Date().toISOString(),
    syncedAt:    new Date().toISOString(),
  }

  try {
    localStorage.setItem(INTEGRATION_KEY, JSON.stringify(integration))
    localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings))
  } catch { /* storage issue */ }

  return { integration, meetings }
}

/** Determines if a calendar event is a real meeting (not a blocker/OOO) */
function _isActualMeeting(event) {
  const hasAttendees  = (event.attendees?.length ?? 0) > 1
  const descOrLoc     = `${event.description ?? ''} ${event.location ?? ''}`.toLowerCase()
  const hasVideoLink  = descOrLoc.includes('zoom') || descOrLoc.includes('meet.google') ||
                        descOrLoc.includes('teams.microsoft') || descOrLoc.includes('webex')
  return hasAttendees || hasVideoLink
}

/* ── Sync ────────────────────────────────────────────────────── */

export async function syncCalendarData() {
  const tokenData = getStoredToken()
  if (!tokenData?.access_token) throw new Error('Google Calendar not connected.')

  if (Date.now() > tokenData.expiresAt) {
    throw new Error('Google token expired. Please reconnect.')
  }

  return fetchCalendarData(tokenData.access_token)
}

/* ── Meeting End Detection ───────────────────────────────────── */

/**
 * Returns meetings that ended within the last 30 minutes and haven't
 * been shown as a toast yet.
 *
 * @returns {Array} array of meeting objects
 */
export function pollForEndedMeetings() {
  const meetings = getStoredMeetings()
  if (!meetings.length) return []

  const now       = Date.now()
  const thirtyMin = 30 * 60 * 1000
  const shownIds  = _getShownIds()

  const ended = meetings.filter(m => {
    if (shownIds.has(m.id)) return false
    const endMs = new Date(m.endTime).getTime()
    const diff  = now - endMs
    return diff >= 0 && diff <= thirtyMin
  })

  return ended
}

/**
 * Marks meeting IDs as having shown a toast, so they're not shown again.
 */
export function markMeetingsAsShown(ids) {
  const shownIds = _getShownIds()
  ids.forEach(id => shownIds.add(id))
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...shownIds]))
  } catch { /* storage issue */ }
}

/* ── Read / Disconnect ───────────────────────────────────────── */

export function getStoredToken() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function getStoredCalendarData() {
  try {
    const raw = localStorage.getItem(INTEGRATION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function getStoredMeetings() {
  try {
    const raw = localStorage.getItem(MEETINGS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function disconnectCalendar() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(INTEGRATION_KEY)
  localStorage.removeItem(MEETINGS_KEY)
  localStorage.removeItem(SHOWN_KEY)
}

export function getCalendarSummary(meetings) {
  const list  = meetings || getStoredMeetings()
  const count = list.length
  if (count === 0) return 'No meetings detected today'
  return `${count} meeting${count !== 1 ? 's' : ''} scheduled today`
}

export function isCalendarConnected() {
  const token  = getStoredToken()
  const data   = getStoredCalendarData()
  return !!(token?.access_token && data?.email && Date.now() < token.expiresAt)
}

/* ── Private ─────────────────────────────────────────────────── */

function _getShownIds() {
  try {
    const raw = localStorage.getItem(SHOWN_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}
