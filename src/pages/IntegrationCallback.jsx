import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { handleGithubCallback, fetchGithubData } from '../services/githubService.js'
import { handleNotionCallback, fetchNotionPages } from '../services/notionService.js'
// Google Calendar uses GSI popup flow — no callback page needed.

export default function IntegrationCallback() {
  const { provider } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('processing') // 'processing' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let active = true

    async function processCallback() {
      if (provider === 'outlook') {
        try {
          const hash = window.location.hash
          if (!hash || !hash.includes('access_token')) {
            throw new Error('No access token returned in URL hash fragment.')
          }
          const { handleOutlookCallback, fetchOutlookData } = await import('../services/outlookService.js')
          const token = await handleOutlookCallback(hash)
          await fetchOutlookData(token)
          if (active) {
            setStatus('success')
            setTimeout(() => {
              if (active) navigate('/dashboard')
            }, 2000)
          }
        } catch (err) {
          console.error('Error during Outlook integration callback:', err)
          if (active) {
            setStatus('error')
            setErrorMsg(err.message || 'An unexpected error occurred during Outlook authorization.')
          }
        }
        return
      }

      const code = searchParams.get('code')
      const state = searchParams.get('state')

      if (!code) {
        if (active) {
          setStatus('error')
          setErrorMsg('No authorization code found in URL callback parameters.')
        }
        return
      }

      try {
        if (provider === 'github') {
          const token = await handleGithubCallback(code, state)
          await fetchGithubData(token)
        } else if (provider === 'notion') {
          const tokenData = await handleNotionCallback(code, state)
          await fetchNotionPages(tokenData.access_token, tokenData.workspace_name)
        } else if (provider === 'google') {
          // Google uses GSI popup — this route shouldn't be reached,
          // but redirect back to dashboard gracefully.
          if (active) {
            navigate('/dashboard')
          }
          return
        } else {
          throw new Error(`Unknown integration provider: ${provider}`)
        }

        if (active) {
          setStatus('success')
          setTimeout(() => {
            if (active) navigate('/dashboard')
          }, 2000)
        }
      } catch (err) {
        console.error('Error during integration callback:', err)
        if (active) {
          setStatus('error')
          setErrorMsg(err.message || 'An unexpected error occurred during authorization.')
        }
      }
    }

    processCallback()

    return () => {
      active = false
    }
  }, [provider, searchParams, navigate])

  const providerName = provider === 'github' ? 'GitHub' : provider === 'notion' ? 'Notion' : provider === 'google' ? 'Google Calendar' : provider === 'outlook' ? 'Outlook Calendar' : provider

  return (
    <div className="cb-page container-narrow animate-fade-in">
      <div className="card cb-card">
        {status === 'processing' && (
          <div className="cb-state">
            <div className="spinner"></div>
            <h2>Connecting {providerName}</h2>
            <p className="cb-sub">Completing authentication and fetching initial metadata. Please don't close this window.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="cb-state">
            <div className="cb-icon cb-icon-success">✓</div>
            <h2>Successfully Connected!</h2>
            <p className="cb-sub">Your {providerName} account is connected. Redirecting you back to your dashboard...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="cb-state">
            <div className="cb-icon cb-icon-error">⚠</div>
            <h2>Connection Failed</h2>
            <p className="cb-sub">{errorMsg}</p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
          </div>
        )}
      </div>

      <style>{`
        .cb-page {
          min-height: calc(100vh - 120px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .cb-card {
          width: 100%;
          max-width: 460px;
          padding: 40px;
          text-align: center;
          box-shadow: var(--shadow-lg);
        }
        .cb-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
        .cb-state h2 {
          font-family: var(--font-display);
          font-size: 1.6rem;
          margin: 0;
        }
        .cb-sub {
          font-size: 0.9rem;
          color: var(--color-muted);
          line-height: 1.5;
          margin: 0 0 8px;
        }
        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid var(--color-border);
          border-top: 4px solid var(--color-accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .cb-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          font-weight: bold;
        }
        .cb-icon-success {
          background: rgba(45, 110, 78, 0.1);
          color: var(--color-success);
        }
        .cb-icon-error {
          background: rgba(196, 77, 30, 0.1);
          color: #c44d1e;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
