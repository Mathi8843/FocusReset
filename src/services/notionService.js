/**
 * notionService.js
 * Notion OAuth integration for FocusReset.
 *
 * Flow:
 *   1. connectNotion()              — redirects to Notion OAuth
 *   2. handleNotionCallback(code)   — exchanges code for token
 *   3. fetchNotionPages(token)      — recent pages via search API
 *   4. syncNotionData()             — re-fetches with stored token
 *   5. getStoredNotionData()        — reads from localStorage
 *
 * Env vars needed (.env):
 *   VITE_NOTION_CLIENT_ID      — from your Notion Integration
 *   VITE_NOTION_CLIENT_SECRET  — used server-side only (proxy)
 */

const STORAGE_KEY   = 'focusreset_integration_notion'
const CLIENT_ID     = import.meta.env.VITE_NOTION_CLIENT_ID ?? ''
const REDIRECT_URI  = `${window.location.origin}/integrations/notion/callback`
const NOTION_VERSION = '2022-06-28'

/* ── OAuth ──────────────────────────────────────────────────── */

/**
 * Starts the Notion OAuth flow.
 * Saves a random state token to sessionStorage for CSRF protection.
 */
export function connectNotion() {
  if (!CLIENT_ID) {
    alert('Notion Client ID is not configured.\nAdd VITE_NOTION_CLIENT_ID to your .env file.')
    throw new Error('Notion Client ID is not configured.')
  }
  const state = crypto.randomUUID()
  sessionStorage.setItem('notion_oauth_state', state)

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    owner:         'user',
    state,
  })
  window.location.href = `https://api.notion.com/v1/oauth/authorize?${params}`
}

/**
 * Called on the /integrations/notion/callback route.
 * Exchanges the OAuth code for an access token via your proxy.
 *
 * The Notion token exchange requires client_secret which must NEVER
 * be in the browser. Use a server-side proxy (see setup instructions).
 *
 * Returns the access token string or throws on failure.
 */
export async function handleNotionCallback(code, state) {
  const savedState = sessionStorage.getItem('notion_oauth_state')
  if (state !== savedState) throw new Error('OAuth state mismatch — possible CSRF')
  sessionStorage.removeItem('notion_oauth_state')

  const response = await fetch('/api/notion/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
  })

  if (!response.ok) {
    let errMsg = `Status ${response.status}`
    try {
      const errData = await response.json()
      if (errData?.error) {
        errMsg = errData.error
      } else if (errData?.message) {
        errMsg = errData.message
      }
    } catch (_) {}
    throw new Error(`Notion token exchange failed: ${errMsg}`)
  }

  const tokenData = await response.json()
  if (tokenData.error) {
    throw new Error(`Notion OAuth error: ${tokenData.message || tokenData.error}`)
  }
  if (!tokenData.access_token) throw new Error('No access token returned from Notion')

  return tokenData
}

/* ── Data fetching ──────────────────────────────────────────── */

/**
 * Fetches the 10 most recently edited Notion pages and stores to localStorage.
 * token    — Notion OAuth access token
 * workspaceName — from the token exchange response
 */
export async function fetchNotionPages(token, workspaceName = 'Workspace') {
  const res = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      Authorization:    `Bearer ${token}`,
      'Content-Type':   'application/json',
      'Notion-Version': NOTION_VERSION,
    },
    body: JSON.stringify({
      query:     '',
      filter:    { value: 'page', property: 'object' },
      sort:      { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: 10,
    }),
  })

  if (!res.ok) throw new Error(`Notion search failed: ${res.status}`)
  const data = await res.json()

  const recentPages = (data.results ?? []).map(page => {
    /* Extract title — Notion pages store title in properties.title */
    let title = 'Untitled'
    const titleProp = page.properties?.title ?? page.properties?.Name
    if (titleProp?.title?.[0]?.plain_text) {
      title = titleProp.title[0].plain_text
    }

    return {
      id:          page.id,
      title,
      lastEdited:  page.last_edited_time,
      url:         page.url,
    }
  })

  const stored = {
    token,
    workspaceName,
    connectedAt: new Date().toISOString(),
    syncedAt:    new Date().toISOString(),
    recentPages,
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  return stored
}

/**
 * Re-fetches Notion pages using stored token.
 * Returns updated data or throws.
 */
export async function syncNotionData() {
  const stored = getStoredNotionData()
  if (!stored?.token) throw new Error('Notion not connected')
  return fetchNotionPages(stored.token, stored.workspaceName)
}

/** Reads cached Notion data from localStorage. Returns null if not connected. */
export function getStoredNotionData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Removes Notion token and data from localStorage. */
export function disconnectNotion() {
  localStorage.removeItem(STORAGE_KEY)
}

/** Returns a one-line summary for Dashboard display. */
export function getNotionSummary(data) {
  if (!data) return null
  const count = data.recentPages?.length ?? 0
  return `${count} recent page${count !== 1 ? 's' : ''} · ${data.workspaceName}`
}
