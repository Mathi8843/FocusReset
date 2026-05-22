/**
 * linearService.js
 * ────────────────────────────────────────────────────────────
 * Linear API integration for FocusReset.
 *
 * Auth method: Personal API Key (created at linear.app/settings/api).
 * Endpoint: https://api.linear.app/graphql
 *
 * Flow:
 *   1. connectLinear(token) — validates token, stores it
 *   2. fetchLinearData(token) — fetches user profile and open issues
 *   3. syncLinearData() — re-fetches using stored token
 *   4. getStoredLinearData() — reads from localStorage
 *   5. disconnectLinear() — removes integration from localStorage
 */

const STORAGE_KEY = 'focusreset_integration_linear'

const LINEAR_URL = import.meta.env.DEV
  ? '/api-linear/graphql'
  : 'https://api.linear.app/graphql'

const QUERY_MY_ISSUES = `
  query {
    viewer {
      name
      email
      assignedIssues(filter: { state: { type: { neq: "completed" } } }, first: 15) {
        nodes {
          id
          identifier
          title
          priority
          state {
            name
          }
          project {
            name
          }
        }
      }
    }
  }
`

/**
 * Validates a Personal API token and fetches initial issues.
 * Throws on failure.
 */
export async function connectLinear(token) {
  if (!token || !token.trim()) {
    throw new Error('Please provide a valid Linear API token.')
  }

  const cleanToken = token.trim()

  const response = await fetch(LINEAR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': cleanToken,
    },
    body: JSON.stringify({ query: QUERY_MY_ISSUES }),
  })

  if (response.status === 401) {
    throw new Error('Invalid API token. Make sure it is copied correctly.')
  }

  if (!response.ok) {
    throw new Error(`Linear connection failed (HTTP ${response.status}).`)
  }

  const result = await response.json()
  if (result.errors && result.errors.length > 0) {
    throw new Error(`Linear GraphQL Error: ${result.errors[0].message}`)
  }

  const viewer = result.data?.viewer
  if (!viewer) {
    throw new Error('Failed to retrieve user profile from Linear.')
  }

  const issues = (viewer.assignedIssues?.nodes ?? []).map(issue => ({
    id: issue.id,
    key: issue.identifier,
    summary: issue.title,
    status: issue.state?.name ?? 'Unknown',
    priority: _formatPriority(issue.priority),
    project: issue.project?.name ?? 'No Project',
  }))

  const data = {
    token: cleanToken,
    displayName: viewer.name,
    email: viewer.email,
    connectedAt: new Date().toISOString(),
    syncedAt: new Date().toISOString(),
    issues,
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  return data
}

/**
 * Syncs the user's Linear issues using the stored token.
 */
export async function syncLinearData() {
  const stored = getStoredLinearData()
  if (!stored?.token) throw new Error('Linear not connected.')
  return connectLinear(stored.token)
}

/**
 * Reads cached Linear data. Returns null if not connected.
 */
export function getStoredLinearData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Removes the Linear connection.
 */
export function disconnectLinear() {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Returns a display summary string.
 */
export function getLinearSummary(data) {
  if (!data) return null
  const count = data.issues?.length ?? 0
  return `${count} active issue${count !== 1 ? 's' : ''}`
}

/**
 * Maps Linear's numeric priority to a friendly label.
 */
function _formatPriority(priorityNum) {
  switch (priorityNum) {
    case 1: return 'Urgent'
    case 2: return 'High'
    case 3: return 'Medium'
    case 4: return 'Low'
    default: return 'None'
  }
}

export function linearPriorityIcon(priority) {
  const icons = { Urgent: '🔴', High: '🟠', Medium: '🟡', Low: '🔵', None: '⚪' }
  return icons[priority] ?? '🟡'
}
