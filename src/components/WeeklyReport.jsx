/**
 * WeeklyReport.jsx
 * ─────────────────────────────────────────────────────────────
 * Renders the AI-powered weekly insight report on the Dashboard.
 *
 * States:
 *  - idle        — no report yet, show "Generate" CTA
 *  - loading     — spinner while calling Grok
 *  - report      — 5-section insight grid
 *  - error       — error message + retry button
 */

import { useState, useEffect } from 'react'
import { generateWeeklyReport, getCachedReport, clearReportCache } from '../services/aiInsights.js'

/* ── Card accent colours ─────────────────────────────────────── */
const CARD_META = {
  hangoverPattern: { icon: '😵', accent: '#b8956a' },
  focusPeaks:      { icon: '⚡', accent: '#4a9d6f' },
  recoverySpeed:   { icon: '⏱',  accent: '#5b8dd9' },
  weeklyMomentum:  { icon: '📈', accent: '#8b6bbf' },
  oneThing:        { icon: '🎯', accent: '#e85d26' },  // orange accent, left-border highlight
}

const SECTION_ORDER = ['hangoverPattern', 'focusPeaks', 'recoverySpeed', 'weeklyMomentum', 'oneThing']

/* ── Subcomponents ───────────────────────────────────────────── */

function InsightCard({ sectionKey, data }) {
  const meta     = CARD_META[sectionKey]
  const isAction = sectionKey === 'oneThing'

  return (
    <div
      className={`wr-card card animate-fade-in ${isAction ? 'wr-card-action' : ''}`}
      style={isAction ? { borderLeft: `4px solid #e85d26` } : {}}
    >
      <div className="wr-card-header">
        <span className="wr-card-icon" style={{ color: meta.accent }}>{meta.icon}</span>
        <div className="wr-card-title-group">
          <h3 className="wr-card-title">{data.title}</h3>
          {data.metric && (
            <span className="wr-card-metric" style={{ color: meta.accent }}>
              {data.metric}
            </span>
          )}
        </div>
      </div>
      <p className="wr-card-insight">{data.insight}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="wr-loading">
      <div className="wr-spinner" aria-hidden="true" />
      <div>
        <p className="wr-loading-title">Analyzing your week…</p>
        <p className="wr-loading-sub">Grok is reading your session patterns. This takes ~10 seconds.</p>
      </div>
    </div>
  )
}

function EmptyState({ sessionCount, hasEnough, onGenerate }) {
  return (
    <div className="card wr-empty">
      <div className="wr-empty-icon">🤖</div>
      <div className="wr-empty-body">
        <h3 className="wr-empty-title">Your weekly AI report</h3>
        <p className="wr-empty-desc">
          {hasEnough
            ? 'Get a personalized analysis of your meeting recovery patterns, focus peaks, and one high-leverage habit to change next week.'
            : `Complete ${3 - sessionCount} more session${3 - sessionCount !== 1 ? 's' : ''} to unlock your first report.`
          }
        </p>
        <button
          id="generate-report-btn"
          className="btn btn-primary"
          onClick={onGenerate}
          disabled={!hasEnough}
          title={!hasEnough ? 'Complete 3+ sessions first' : 'Generate AI report'}
        >
          {hasEnough ? '✨ Generate My Report' : `${3 - sessionCount} more sessions needed`}
        </button>
        {hasEnough && (
          <p className="wr-empty-note">Powered by Grok · requires VITE_GROK_API_KEY</p>
        )}
      </div>
    </div>
  )
}

function ErrorState({ error, onRetry, onDismiss }) {
  const isKeyMissing = error?.includes('VITE_GROK_API_KEY')

  return (
    <div className="card wr-error">
      <span className="wr-error-icon">⚠️</span>
      <div className="wr-error-body">
        <p className="wr-error-title">
          {isKeyMissing ? 'API key not configured' : 'Could not generate report'}
        </p>
        <p className="wr-error-desc">
          {isKeyMissing
            ? 'Add your VITE_GROK_API_KEY to the .env file and restart the dev server.'
            : error
          }
        </p>
        {!isKeyMissing && (
          <div className="wr-error-actions">
            <button className="btn btn-primary btn-sm" onClick={onRetry}>Try Again</button>
            <button className="btn btn-ghost btn-sm" onClick={onDismiss}>Dismiss</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ReportHeader({ report, onRefresh, refreshing }) {
  const generated = report.generatedAt ? new Date(report.generatedAt) : null
  const timeStr   = generated
    ? generated.toLocaleString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div className="wr-report-header">
      <div>
        <p className="wr-report-meta">
          Based on <strong>{report.sessionCount}</strong> session{report.sessionCount !== 1 ? 's' : ''} · Generated {timeStr}
        </p>
      </div>
      <button
        className="btn btn-ghost btn-sm"
        onClick={onRefresh}
        disabled={refreshing}
        title="Regenerate report with fresh data"
      >
        {refreshing ? '…' : '↺ Refresh'}
      </button>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────── */

export default function WeeklyReport({ sessions }) {
  const sessionCount = sessions.filter(s => s.completed).length
  const hasEnough    = sessionCount >= 3

  const [status,     setStatus]     = useState('idle')   // idle | loading | report | error
  const [report,     setReport]     = useState(null)
  const [errorMsg,   setErrorMsg]   = useState('')
  const [refreshing, setRefreshing] = useState(false)

  // Load cached report on mount
  useEffect(() => {
    const cached = getCachedReport()
    if (cached) {
      setReport(cached)
      setStatus('report')
    }
  }, [])

  async function handleGenerate(forceRefresh = false) {
    if (!hasEnough) return
    if (forceRefresh) {
      clearReportCache()
      setRefreshing(true)
    } else {
      setStatus('loading')
    }
    setErrorMsg('')

    try {
      const result = await generateWeeklyReport(sessions, forceRefresh)
      setReport(result)
      setStatus('report')
    } catch (err) {
      setErrorMsg(err.message || 'Unknown error')
      setStatus('error')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="wr-wrapper">
      {status === 'idle' && (
        <EmptyState
          sessionCount={sessionCount}
          hasEnough={hasEnough}
          onGenerate={() => handleGenerate(false)}
        />
      )}

      {status === 'loading' && <LoadingState />}

      {status === 'error' && (
        <ErrorState
          error={errorMsg}
          onRetry={() => handleGenerate(false)}
          onDismiss={() => setStatus('idle')}
        />
      )}

      {status === 'report' && report && (
        <div className="wr-report animate-fade-in">
          <ReportHeader
            report={report}
            onRefresh={() => handleGenerate(true)}
            refreshing={refreshing}
          />
          <div className="wr-grid">
            {SECTION_ORDER.map(key => (
              report[key]?.insight && (
                <InsightCard key={key} sectionKey={key} data={report[key]} />
              )
            ))}
          </div>
        </div>
      )}

      <style>{`
        /* ── Wrapper ── */
        .wr-wrapper { width: 100%; }

        /* ── Empty state ── */
        .wr-empty {
          display: flex;
          align-items: flex-start;
          gap: 24px;
          padding: 28px 32px;
          border-style: dashed;
        }
        .wr-empty-icon { font-size: 2.5rem; flex-shrink: 0; }
        .wr-empty-body { display: flex; flex-direction: column; gap: 10px; }
        .wr-empty-title { font-size: 1.1rem; font-family: var(--font-display); margin: 0; }
        .wr-empty-desc { font-size: 0.9rem; color: var(--color-muted); margin: 0; max-width: 480px; line-height: 1.6; }
        .wr-empty-note { font-size: 0.72rem; color: var(--color-muted); margin: 0; opacity: 0.7; }

        /* ── Loading ── */
        .wr-loading {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 32px;
          background: var(--color-bg-card);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg);
        }
        .wr-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid var(--color-border);
          border-top-color: var(--color-accent);
          border-radius: 50%;
          animation: wr-spin 0.8s linear infinite;
          flex-shrink: 0;
        }
        @keyframes wr-spin { to { transform: rotate(360deg); } }
        .wr-loading-title { font-weight: 700; font-size: 1rem; margin: 0 0 4px; }
        .wr-loading-sub { font-size: 0.85rem; color: var(--color-muted); margin: 0; }

        /* ── Error ── */
        .wr-error {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 24px;
          border-left: 3px solid #c44d1e;
        }
        .wr-error-icon { font-size: 1.5rem; flex-shrink: 0; }
        .wr-error-body { display: flex; flex-direction: column; gap: 8px; }
        .wr-error-title { font-weight: 700; font-size: 0.95rem; color: var(--color-text); margin: 0; }
        .wr-error-desc { font-size: 0.85rem; color: var(--color-muted); margin: 0; line-height: 1.5; }
        .wr-error-actions { display: flex; gap: 8px; margin-top: 4px; }

        /* ── Report header ── */
        .wr-report-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .wr-report-meta { font-size: 0.82rem; color: var(--color-muted); margin: 0; }
        .wr-report-meta strong { color: var(--color-text); }

        /* ── Grid ── */
        .wr-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        /* "One Thing to Change" spans full width */
        .wr-grid > .wr-card:last-child {
          grid-column: 1 / -1;
        }

        /* ── Card ── */
        .wr-card { padding: 24px; display: flex; flex-direction: column; gap: 12px; }
        .wr-card-action { background: rgba(232, 93, 38, 0.035); }
        .wr-card-header { display: flex; align-items: flex-start; gap: 14px; }
        .wr-card-icon { font-size: 1.6rem; flex-shrink: 0; margin-top: 2px; }
        .wr-card-title-group { display: flex; flex-direction: column; gap: 4px; }
        .wr-card-title { font-size: 0.95rem; font-weight: 700; color: var(--color-text); margin: 0; }
        .wr-card-metric {
          font-family: var(--font-mono, 'JetBrains Mono', monospace);
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .wr-card-insight {
          font-size: 0.88rem;
          color: var(--color-muted);
          line-height: 1.65;
          margin: 0;
        }

        /* ── Responsive ── */
        @media (max-width: 680px) {
          .wr-grid { grid-template-columns: 1fr; }
          .wr-grid > .wr-card:last-child { grid-column: 1; }
          .wr-empty { flex-direction: column; padding: 24px; }
        }
      `}</style>
    </div>
  )
}
