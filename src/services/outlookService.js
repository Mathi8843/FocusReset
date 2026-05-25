/**
 * outlookService.js
 * ────────────────────────────────────────────────────────────
 * Outlook Calendar integration for FocusReset.
 *
 * Auth method: OAuth 2.0 Implicit Grant Flow.
 * Endpoint: https://graph.microsoft.com/v1.0
 *
 * Flow:
 *   1. connectOutlook() — redirects user to MS authorization page
 *   2. fetchOutlookData(token) — fetches email and today's calendar events
 *   3. syncOutlookData() — re-fetches using stored token
 *   4. pollForEndedOutlookMeetings() — checks for meetings ending in last 30 min
 *   5. getStoredOutlookData() — reads integration state
 *   6. disconnectOutlook() — clears localStorage
 *
 * Storage keys:
 *   focusreset_mtoken             — { access_token, expiresAt }
 *   focusreset_integration_outlook — { email, connectedAt, syncedAt }
 *   focusreset_outlook_meetings    — today's events array
 *   focusreset_outlook_shown       — set of event IDs already toasted
 */

import { detectMeetingTypeFromTitle } from './contextAssembler.js'
import { getSessions } from '../utils/storage.js'
import { calculateHangoverScore } from '../utils/hangoverScore.js'

const CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID ?? ''
const SCOPES = 'Calendars.Read User.Read'

const TOKEN_KEY = 'focusreset_mtoken'
const INTEGRATION_KEY = 'focusreset_integration_outlook'
const MEETINGS_KEY = 'focusreset_outlook_meetings'
const SHOWN_KEY = 'focusreset_outlook_shown'

const GRAPH_URL = import.meta.env.DEV
  ? '/api-graph'
  : 'https://graph.microsoft.com/v1.0'

/**
 * Redirects the user to Microsoft's OAuth endpoint.
 */
export function connectOutlook() {
  if (!CLIENT_ID) {
    alert('Microsoft Client ID is not configured.\nAdd VITE_MICROSOFT_CLIENT_ID to your .env file.')
    throw new Error('Microsoft Client ID is not configured.')
  }

  const state = crypto.randomUUID()
  sessionStorage.setItem('outlook_oauth_state', state)

  const redirectUri = `${window.location.origin}/integrations/outlook/callback`
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'token',
    redirect_uri: redirectUri,
    scope: SCOPES,
    response_mode: 'fragment',
    state,
  })

  window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
}

/**
 * Processes Outlook OAuth callback values.
 * Extracted from the redirect URL fragment.
 */
export async function handleOutlookCallback(hashStr) {
  const hashParams = new URLSearchParams(hashStr.substring(1))
  const token = hashParams.get('access_token')
  const expiresIn = hashParams.get('expires_in')
  const state = hashParams.get('state')

  const savedState = sessionStorage.getItem('outlook_oauth_state')
  if (state !== savedState) throw new Error('OAuth state mismatch — possible CSRF')
  sessionStorage.removeItem('outlook_oauth_state')

  if (!token) throw new Error('No access token returned from Microsoft.')

  const expiresAt = Date.now() + Number(expiresIn ?? 3600) * 1000
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ access_token: token, expiresAt }))
  } catch { /* storage full */ }

  return token
}

/**
 * Fetches user profile and today's Outlook calendar events.
 */
export async function fetchOutlookData(token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  }

  /* 1. Fetch user profile (email) */
  let email = 'Outlook Account'
  try {
    const res = await fetch(`${GRAPH_URL}/me`, { headers })
    if (res.ok) {
      const info = await res.json()
      email = info.mail || info.userPrincipalName || email
    }
  } catch (err) {
    console.warn('[FocusReset] Microsoft Graph /me fetch failed:', err)
  }

  /* 2. Fetch today's calendar events */
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  const params = new URLSearchParams({
    startDateTime: startOfDay.toISOString(),
    endDateTime: endOfDay.toISOString(),
    $select: 'id,subject,start,end,webLink,attendees',
    $top: '50',
  })

  const eventsRes = await fetch(`${GRAPH_URL}/me/calendarView?${params}`, { headers })
  if (!eventsRes.ok) throw new Error(`Microsoft Graph Calendar error: ${eventsRes.status}`)
  const eventsData = await eventsRes.json()

  const meetingsBase = (eventsData.value ?? [])
    .filter(e => e.start?.dateTime)
    .filter(e => _isActualMeeting(e))
    .map(e => ({
      id: e.id,
      summary: e.subject || 'Untitled Meeting',
      startTime: e.start.dateTime + 'Z', // MS Graph returns local time in ISO representation without suffix or UTC depending on settings, standardizing to UTC or raw ISO
      endTime: e.end.dateTime + 'Z',
      meetingType: detectMeetingTypeFromTitle(e.subject),
      htmlLink: e.webLink || '',
      attendees: (e.attendees?.length ?? 0),
    }))

  const sessions = await getSessions()
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
    syncedAt: new Date().toISOString(),
  }

  try {
    localStorage.setItem(INTEGRATION_KEY, JSON.stringify(integration))
    localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings))
  } catch { /* storage full */ }

  return { integration, meetings }
}

/**
 * Checks and parses meeting object details for valid meeting indicators
 */
function _isActualMeeting(event) {
  const hasAttendees = (event.attendees?.length ?? 0) > 1
  const descOrTitle = `${event.subject ?? ''}`.toLowerCase()
  const hasVideoLink = descOrTitle.includes('zoom') || descOrTitle.includes('meet') || descOrTitle.includes('teams')
  return hasAttendees || hasVideoLink
}

/**
 * Syncs Outlook events using the stored token.
 */
export async function syncOutlookData() {
  const tokenData = getStoredToken()
  if (!tokenData?.access_token) throw new Error('Outlook not connected.')

  if (Date.now() > tokenData.expiresAt) {
    throw new Error('Outlook login expired. Please reconnect.')
  }

  return fetchOutlookData(tokenData.access_token)
}

/**
 * Polls for ended meetings in the last 30 minutes.
 */
export function pollForEndedOutlookMeetings() {
  const meetings = getStoredMeetings()
  if (!meetings.length) return []

  const now = Date.now()
  const thirtyMin = 30 * 60 * 1000
  const shownIds = _getShownIds()

  const ended = meetings.filter(m => {
    if (shownIds.has(m.id)) return false
    const endMs = new Date(m.endTime).getTime()
    const diff = now - endMs
    return diff >= 0 && diff <= thirtyMin
  })

  return ended
}

export function markOutlookMeetingsAsShown(ids) {
  const shownIds = _getShownIds()
  ids.forEach(id => shownIds.add(id))
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...shownIds]))
  } catch { /* storage full */ }
}

export function getStoredToken() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function getStoredOutlookData() {
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

export function disconnectOutlook() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(INTEGRATION_KEY)
  localStorage.removeItem(MEETINGS_KEY)
  localStorage.removeItem(SHOWN_KEY)
}

export function isOutlookConnected() {
  const token = getStoredToken()
  const data = getStoredOutlookData()
  return !!(token?.access_token && data?.email && Date.now() < token.expiresAt)
}

function _getShownIds() {
  try {
    const raw = localStorage.getItem(SHOWN_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}
