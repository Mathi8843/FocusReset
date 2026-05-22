import { useState } from 'react'

/**
 * IntegrationCard — reusable card for GitHub / Jira / Notion integrations.
 *
 * Props:
 *  id           — unique string id ('github' | 'jira' | 'notion')
 *  icon         — JSX or string emoji for the tool logo
 *  name         — display name e.g. "GitHub"
 *  description  — one-line description of what it provides
 *  status       — 'disconnected' | 'connecting' | 'connected' | 'error'
 *  connectedAs  — string shown when connected (username / email)
 *  summary      — one-line data summary when connected
 *  syncedAt     — ISO string of last sync time
 *  onConnect    — async () => void
 *  onDisconnect — () => void
 *  onSync       — async () => void
 *  children     — optional expanded data list (PRs / tickets / pages)
 */
export default function IntegrationCard({
  id, icon, name, description,
  status = 'disconnected',
  connectedAs, summary, syncedAt,
  onConnect, onDisconnect, onSync,
  children,
}) {
  const [expanded, setExpanded] = useState(false)
  const [syncing, setSyncing]   = useState(false)
  const [connecting, setConnecting] = useState(false)

  const isConnected = status === 'connected'
  const isError     = status === 'error'

  async function handleConnect() {
    setConnecting(true)
    try { await onConnect?.() }
    catch { /* parent handles errors */ }
    finally { setConnecting(false) }
  }

  async function handleSync() {
    setSyncing(true)
    try { await onSync?.() }
    catch { /* parent handles errors */ }
    finally { setSyncing(false) }
  }

  /* Relative time for "Last synced X" */
  function relativeTime(iso) {
    if (!iso) return null
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)  return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)  return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className={`ic-card card${isConnected ? ' ic-card-connected' : ''}${isError ? ' ic-card-error' : ''}`}>
      {/* Header row */}
      <div className="ic-header">
        <div className="ic-icon-wrap">{icon}</div>
        <div className="ic-meta">
          <span className="ic-name">{name}</span>
          <span className="ic-desc">{description}</span>
        </div>
        <div className="ic-status-badge">
          {isConnected && <span className="badge badge-success">Connected</span>}
          {isError     && <span className="ic-error-badge">⚠ Error</span>}
          {!isConnected && !isError && <span className="ic-disconnected-badge">Not connected</span>}
        </div>
      </div>

      {/* Connected state */}
      {isConnected && (
        <div className="ic-connected-body">
          {connectedAs && (
            <span className="ic-connected-as">as <strong>{connectedAs}</strong></span>
          )}
          {summary && <p className="ic-summary">{summary}</p>}
          <div className="ic-footer-row">
            {syncedAt && (
              <span className="ic-synced-at">Synced {relativeTime(syncedAt)}</span>
            )}
            <div className="ic-actions">
              {children && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setExpanded(e => !e)}
                >
                  {expanded ? 'Hide' : 'View'} details
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleSync}
                disabled={syncing}
                title="Re-fetch latest data"
              >
                {syncing ? '⟳ Syncing…' : '⟳ Sync'}
              </button>
              <button
                className="btn btn-ghost btn-sm ic-disconnect-btn"
                onClick={onDisconnect}
              >
                Disconnect
              </button>
            </div>
          </div>

          {/* Expandable data list */}
          {expanded && children && (
            <div className="ic-expanded-data">
              {children}
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="ic-error-body">
          <p className="ic-error-msg">Connection lost. Your data may be outdated.</p>
          <button className="btn btn-ghost btn-sm" onClick={handleConnect}>
            Reconnect
          </button>
        </div>
      )}

      {/* Disconnected state */}
      {!isConnected && !isError && (
        <button
          id={`connect-${id}-btn`}
          className="btn btn-ghost btn-sm ic-connect-btn"
          onClick={handleConnect}
          disabled={connecting || status === 'connecting'}
        >
          {connecting ? 'Connecting…' : `Connect ${name}`}
        </button>
      )}

      <style>{`
        .ic-card {
          padding: 20px;
          transition: all var(--transition-fast);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .ic-card-connected {
          border-color: rgba(45, 110, 78, 0.3);
          background: #fafdf8;
        }
        .ic-card-error {
          border-color: rgba(200, 50, 50, 0.3);
          background: #fdfaf8;
        }

        .ic-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .ic-icon-wrap {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.3rem;
          flex-shrink: 0;
        }
        .ic-meta {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .ic-name {
          font-weight: 700;
          font-size: 0.9375rem;
          color: var(--color-text);
          font-family: var(--font-body);
        }
        .ic-desc {
          font-size: 0.78rem;
          color: var(--color-muted);
          line-height: 1.4;
        }
        .ic-status-badge { flex-shrink: 0; }
        .ic-disconnected-badge {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--color-muted);
          font-family: var(--font-body);
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .ic-error-badge {
          font-size: 0.78rem;
          font-weight: 700;
          color: #c44d1e;
          font-family: var(--font-body);
        }

        .ic-connected-body {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-top: 4px;
          border-top: 1px solid var(--color-border);
        }
        .ic-connected-as {
          font-size: 0.82rem;
          color: var(--color-muted);
          font-family: var(--font-body);
        }
        .ic-connected-as strong { color: var(--color-text); }
        .ic-summary {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-success);
          margin: 0;
          font-family: var(--font-body);
        }
        .ic-footer-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }
        .ic-synced-at {
          font-size: 0.72rem;
          color: var(--color-muted);
          font-family: var(--font-mono);
        }
        .ic-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .ic-disconnect-btn {
          color: var(--color-muted) !important;
          border-color: transparent !important;
          font-size: 0.78rem !important;
          padding: 8px 10px !important;
        }
        .ic-disconnect-btn:hover {
          color: #c44d1e !important;
          background: rgba(196,77,30,0.06) !important;
        }

        .ic-expanded-data {
          background: var(--color-bg);
          border-radius: var(--radius-md);
          padding: 12px;
          border: 1px solid var(--color-border);
          margin-top: 4px;
        }

        .ic-connect-btn { width: 100%; }

        .ic-error-body {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-top: 8px;
          border-top: 1px solid var(--color-border);
          flex-wrap: wrap;
        }
        .ic-error-msg {
          font-size: 0.82rem;
          color: #c44d1e;
          margin: 0;
          font-family: var(--font-body);
        }
      `}</style>
    </div>
  )
}
