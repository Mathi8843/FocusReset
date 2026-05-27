/**
 * githubService.js
 * GitHub OAuth integration for FocusReset.
 *
 * Flow:
 *   1. connectGithub()  — redirects to GitHub OAuth
 *   2. handleGithubCallback(code) — exchanges code for token (via proxy)
 *   3. fetchGithubData(token) — fetches repos + open PRs
 *   4. getStoredGithubData() — reads cached data from localStorage
 *
 * Env vars needed (.env):
 *   VITE_GITHUB_CLIENT_ID    — from your GitHub OAuth App
 */

const STORAGE_KEY   = 'focusreset_integration_github'
const CLIENT_ID     = import.meta.env.VITE_GITHUB_CLIENT_ID ?? ''
const REDIRECT_URI  = `${window.location.origin}/integrations/github/callback`
const SCOPES        = 'read:user repo'

/* ── OAuth ──────────────────────────────────────────────────── */

/**
 * Starts the GitHub OAuth flow.
 * Saves a random state token to sessionStorage to prevent CSRF.
 * Redirects the browser to GitHub's authorization page.
 */
export function connectGithub() {
  if (!CLIENT_ID) {
    alert('GitHub Client ID is not configured.\nAdd VITE_GITHUB_CLIENT_ID to your .env file.')
    throw new Error('GitHub Client ID is not configured.')
  }
  const state = crypto.randomUUID()
  sessionStorage.setItem('github_oauth_state', state)

  const params = new URLSearchParams({
    client_id:    CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope:        SCOPES,
    state,
  })
  window.location.href = `https://github.com/login/oauth/authorize?${params}`
}

/**
 * Called on the /integrations/github/callback route.
 * Exchanges the OAuth code for an access token.
 *
 * NOTE: GitHub does not allow token exchange from the browser
 * (CORS restriction). You need a tiny proxy. This function calls
 * a Vite dev proxy or a deployed edge function.
 *
 * For local dev: add to vite.config.js proxy (instructions below).
 * For production: deploy a Cloudflare Worker or Vercel function.
 *
 * Returns the access token string or throws on failure.
 */
export async function handleGithubCallback(code, state) {
  const savedState = sessionStorage.getItem('github_oauth_state')
  if (state !== savedState) throw new Error('OAuth state mismatch — possible CSRF')
  sessionStorage.removeItem('github_oauth_state')

  /* Call your proxy endpoint that exchanges code → token */
  const response = await fetch('/api/github/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })

  if (!response.ok) {
    let errMsg = `Status ${response.status}`
    try {
      const errData = await response.json()
      if (errData?.error) {
        errMsg = errData.error
      }
    } catch (_) {}
    throw new Error(`GitHub token exchange failed: ${errMsg}`)
  }

  const tokenData = await response.json()
  if (tokenData.error) {
    throw new Error(`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`)
  }

  const access_token = tokenData.access_token
  if (!access_token) throw new Error('No access token returned')

  return access_token
}

/* ── Data fetching ──────────────────────────────────────────── */

/**
 * Fetches GitHub repos and their open PRs, then stores to localStorage.
 * token — a valid GitHub personal access token or OAuth token.
 */
export async function fetchGithubData(token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept:        'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  /* Get authenticated user */
  const userRes  = await fetch('https://api.github.com/user', { headers })
  if (!userRes.ok) throw new Error(`GitHub /user failed: ${userRes.status}`)
  const user = await userRes.json()

  /* Get 10 most recently pushed repos */
  const repoRes = await fetch(
    'https://api.github.com/user/repos?sort=pushed&per_page=10&affiliation=owner,collaborator',
    { headers }
  )
  if (!repoRes.ok) throw new Error(`GitHub /repos failed: ${repoRes.status}`)
  const repos = await repoRes.json()

  /* For each repo, fetch open PRs (parallel) */
  const reposWithPRs = await Promise.all(
    repos.map(async repo => {
      try {
        const prRes = await fetch(
          `https://api.github.com/repos/${repo.full_name}/pulls?state=open&per_page=10`,
          { headers }
        )
        const prs = prRes.ok ? await prRes.json() : []
        return {
          name:     repo.name,
          fullName: repo.full_name,
          openPRs:  prs.map(pr => ({
            number:    pr.number,
            title:     pr.title,
            createdAt: pr.created_at,
            isDraft:   pr.draft ?? false,
          })),
        }
      } catch {
        return { name: repo.name, fullName: repo.full_name, openPRs: [] }
      }
    })
  )

  const data = {
    token,
    username:    user.login,
    avatarUrl:   user.avatar_url,
    connectedAt: new Date().toISOString(),
    syncedAt:    new Date().toISOString(),
    repos:       reposWithPRs,
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  return data
}

/**
 * Re-syncs GitHub data using the stored token.
 * Returns updated data or throws (caller should catch).
 */
export async function syncGithubData() {
  const stored = getStoredGithubData()
  if (!stored?.token) throw new Error('GitHub not connected')
  return fetchGithubData(stored.token)
}

/** Reads cached GitHub data from localStorage. Returns null if not connected. */
export function getStoredGithubData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Removes GitHub data and token from localStorage. */
export function disconnectGithub() {
  localStorage.removeItem(STORAGE_KEY)
}

/** Returns a one-line summary string for Dashboard display. */
export function getGithubSummary(data) {
  if (!data) return null
  const totalPRs  = data.repos.reduce((acc, r) => acc + r.openPRs.length, 0)
  const reposWithPRs = data.repos.filter(r => r.openPRs.length > 0).length
  return `${totalPRs} open PR${totalPRs !== 1 ? 's' : ''} across ${reposWithPRs} repo${reposWithPRs !== 1 ? 's' : ''}`
}
