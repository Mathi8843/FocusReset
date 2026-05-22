/**
 * jiraService.js
 * Jira API Token integration for FocusReset.
 *
 * Auth method: Basic Auth with email + API token (no OAuth needed).
 * Jira Cloud REST API v3.
 *
 * Flow:
 *   1. connectJira(domain, email, token) — validates credentials, stores them
 *   2. fetchJiraTickets(credentials)     — runs JQL search
 *   3. syncJiraData()                    — re-fetches with stored credentials
 *   4. getStoredJiraData()               — reads from localStorage
 */

const STORAGE_KEY = 'focusreset_integration_jira'

/* ── Auth ────────────────────────────────────────────────────── */

/**
 * Builds the Authorization header value for Jira Basic Auth.
 * Jira requires base64(email:token).
 */
function buildAuthHeader(email, token) {
  return `Basic ${btoa(`${email}:${token}`)}`
}

/**
 * Validates credentials and fetches initial ticket data.
 * Throws with a user-friendly message on failure.
 *
 * domain — e.g. "mycompany.atlassian.net" (no https://)
 * email  — Jira account email
 * token  — Jira API token from id.atlassian.com
 */
export async function connectJira(domain, email, token) {
  /* Normalise domain — strip protocol/trailing slash */
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase()

  const auth    = buildAuthHeader(email, token)
  const baseUrl = `https://${cleanDomain}`

  /* Step 1: verify token works by fetching /myself */
  const myselfRes = await fetch(`${baseUrl}/rest/api/3/myself`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  })

  if (myselfRes.status === 401) throw new Error('Invalid email or API token. Check your credentials.')
  if (myselfRes.status === 403) throw new Error('Access denied. Make sure your Jira plan supports API access.')
  if (!myselfRes.ok)            throw new Error(`Jira connection failed (${myselfRes.status}). Check your domain.`)

  const myself = await myselfRes.json()

  /* Step 2: fetch open tickets assigned to current user */
  const tickets = await _fetchTickets(baseUrl, auth)

  const data = {
    domain:      cleanDomain,
    email,
    token,                           // stored so we can re-sync
    displayName: myself.displayName,
    accountId:   myself.accountId,
    connectedAt: new Date().toISOString(),
    syncedAt:    new Date().toISOString(),
    tickets,
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  return data
}

/* ── Data fetching ──────────────────────────────────────────── */

/**
 * Internal — runs the JQL search for open tickets assigned to current user
 * modified within the last 7 days.
 */
async function _fetchTickets(baseUrl, auth) {
  const jql = `assignee = currentUser() AND statusCategory != Done AND updated >= -7d ORDER BY priority ASC`

  const params = new URLSearchParams({
    jql,
    fields: 'summary,status,priority,project',
    maxResults: '20',
  })

  const res = await fetch(`${baseUrl}/rest/api/3/search?${params}`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  })

  if (!res.ok) throw new Error(`Jira search failed: ${res.status}`)

  const data = await res.json()
  return (data.issues ?? []).map(issue => ({
    key:      issue.key,
    summary:  issue.fields.summary,
    status:   issue.fields.status?.name    ?? 'Unknown',
    priority: issue.fields.priority?.name  ?? 'Medium',
    project:  issue.fields.project?.name   ?? 'Unknown',
  }))
}

/**
 * Re-fetches Jira tickets using stored credentials.
 * Returns updated data or throws (caller should catch).
 */
export async function syncJiraData() {
  const stored = getStoredJiraData()
  if (!stored?.domain || !stored?.email || !stored?.token) {
    throw new Error('Jira not connected')
  }

  const auth    = buildAuthHeader(stored.email, stored.token)
  const baseUrl = `https://${stored.domain}`
  const tickets = await _fetchTickets(baseUrl, auth)

  const updated = { ...stored, tickets, syncedAt: new Date().toISOString() }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

/** Reads cached Jira data from localStorage. Returns null if not connected. */
export function getStoredJiraData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Removes all Jira credentials and data from localStorage. */
export function disconnectJira() {
  localStorage.removeItem(STORAGE_KEY)
}

/** Returns a one-line summary for Dashboard display. */
export function getJiraSummary(data) {
  if (!data) return null
  const count = data.tickets?.length ?? 0
  return `${count} open ticket${count !== 1 ? 's' : ''}`
}

/** Returns the priority icon emoji for a Jira priority name. */
export function jiraPriorityIcon(priority) {
  const icons = { Highest: '🔴', High: '🟠', Medium: '🟡', Low: '🔵', Lowest: '⚪' }
  return icons[priority] ?? '🟡'
}
