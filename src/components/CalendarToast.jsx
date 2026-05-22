/**
 * CalendarToast.jsx
 * ─────────────────────────────────────────────────────────────
 * Floating bottom-right toast that appears when a calendar meeting
 * has just ended (within the last 30 minutes).
 *
 * Props:
 *   meetings  — array of ended meeting objects (from pollForEndedMeetings)
 *   onDismiss — called when user closes the toast
 *   onStartReset — called when user clicks "Start Reset" with meeting info
 */

import { useState, useEffect } from 'react'
import { formatHangoverScore } from '../utils/hangoverScore.js'

const MEETING_LABELS = {
  standup:      'Team Standup',
  'one-on-one': '1-on-1',
  client:       'Client Call',
  allhands:     'All-Hands',
  planning:     'Planning',
  review:       'Review',
  interview:    'Interview',
  other:        'Meeting',
}

function formatEndedAgo(endTimeStr) {
  const diffMs  = Date.now() - new Date(endTimeStr).getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return 'just ended'
  if (diffMin === 1) return '1 min ago'
  return `${diffMin} min ago`
}

export default function CalendarToast({ meetings, onDismiss, onStartReset }) {
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState(0) // index into meetings[]

  // Slide-in effect on mount
  useEffect(() => {
    if (meetings?.length > 0) {
      const t = setTimeout(() => setVisible(true), 80)
      return () => clearTimeout(t)
    }
  }, [meetings])

  if (!meetings || meetings.length === 0) return null

  const meeting = meetings[current]
  const hasMore = meetings.length > 1

  function handleDismiss() {
    setVisible(false)
    setTimeout(onDismiss, 300) // wait for slide-out
  }

  function handleStartReset() {
    setVisible(false)
    setTimeout(() => {
      onStartReset({
        meetingType: meeting.meetingType,
        meetingName: meeting.summary,
        meetingId: meeting.id,
        meetingStartTime: meeting.startTime,
        meetingEndTime: meeting.endTime,
        meetingAttendees: meeting.attendees,
        hangoverScore: meeting.hangoverScore,
      })
    }, 200)
  }

  function handleNext() {
    if (current < meetings.length - 1) setCurrent(c => c + 1)
  }

  function handlePrev() {
    if (current > 0) setCurrent(c => c - 1)
  }

  return (
    <>
      <div
        className={`cal-toast ${visible ? 'cal-toast-visible' : ''}`}
        role="alert"
        aria-live="polite"
        aria-label="Meeting ended notification"
      >
        {/* Header */}
        <div className="cal-toast-header">
          <div className="cal-toast-header-left">
            <span className="cal-toast-dot" aria-hidden="true" />
            <span className="cal-toast-label">Meeting ended</span>
            {hasMore && (
              <span className="cal-toast-count">
                {current + 1}/{meetings.length}
              </span>
            )}
          </div>
          <button
            className="cal-toast-close"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="cal-toast-body">
          <p className="cal-toast-meeting-name">{meeting.summary}</p>
          <div className="cal-toast-meta">
            <span className="badge badge-accent" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
              {MEETING_LABELS[meeting.meetingType] || 'Meeting'}
            </span>
            <span className="cal-toast-ago">{formatEndedAgo(meeting.endTime)}</span>
          </div>
          {meeting.hangoverScore && (
            <div className={`cal-toast-score cal-toast-score-${meeting.hangoverScore.tone}`}>
              <span className="cal-toast-score-value">{meeting.hangoverScore.score}</span>
              <span>
                {formatHangoverScore(meeting.hangoverScore)}
                <br />
                <strong>{meeting.hangoverScore.recommendedRecoveryMinutes} min reset recommended</strong>
              </span>
            </div>
          )}
          <p className="cal-toast-hint">
            Ready to reclaim your focus?
          </p>
        </div>

        {/* Actions */}
        <div className="cal-toast-actions">
          <button
            id="cal-toast-reset-btn"
            className="btn btn-primary btn-sm"
            onClick={handleStartReset}
          >
            Start Reset →
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleDismiss}>
            Dismiss
          </button>
        </div>

        {/* Multi-meeting navigation */}
        {hasMore && (
          <div className="cal-toast-nav">
            <button
              className="cal-toast-nav-btn"
              onClick={handlePrev}
              disabled={current === 0}
              aria-label="Previous meeting"
            >
              ‹
            </button>
            <div className="cal-toast-dots">
              {meetings.map((_, i) => (
                <span
                  key={i}
                  className={`cal-toast-nav-dot ${i === current ? 'cal-toast-nav-dot-active' : ''}`}
                  onClick={() => setCurrent(i)}
                />
              ))}
            </div>
            <button
              className="cal-toast-nav-btn"
              onClick={handleNext}
              disabled={current === meetings.length - 1}
              aria-label="Next meeting"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <style>{`
        /* ── Toast container ── */
        .cal-toast {
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 9999;
          width: 320px;
          background: var(--color-bg-card);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg);
          box-shadow: 0 12px 48px rgba(26, 20, 16, 0.18), 0 4px 16px rgba(26, 20, 16, 0.10);
          display: flex;
          flex-direction: column;
          gap: 0;
          overflow: hidden;
          transform: translateY(calc(100% + 40px));
          opacity: 0;
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
        }
        .cal-toast-visible {
          transform: translateY(0);
          opacity: 1;
        }

        /* ── Header ── */
        .cal-toast-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px 10px;
          border-bottom: 1px solid var(--color-border);
          background: var(--color-bg);
        }
        .cal-toast-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cal-toast-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-accent);
          animation: cal-pulse 1.5s ease-in-out infinite;
        }
        @keyframes cal-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }
        .cal-toast-label {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--color-text);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .cal-toast-count {
          font-size: 0.72rem;
          color: var(--color-muted);
          font-family: var(--font-mono, monospace);
        }
        .cal-toast-close {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-muted);
          font-size: 0.85rem;
          padding: 2px 4px;
          border-radius: 4px;
          line-height: 1;
          transition: color var(--transition-fast), background var(--transition-fast);
        }
        .cal-toast-close:hover {
          color: var(--color-text);
          background: var(--color-border);
        }

        /* ── Body ── */
        .cal-toast-body {
          padding: 14px 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cal-toast-meeting-name {
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-text);
          margin: 0;
          line-height: 1.3;
        }
        .cal-toast-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .cal-toast-ago {
          font-size: 0.75rem;
          color: var(--color-muted);
          font-family: var(--font-mono, monospace);
        }
        .cal-toast-hint {
          font-size: 0.82rem;
          color: var(--color-muted);
          margin: 0;
          line-height: 1.4;
        }
        .cal-toast-score {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 9px 10px;
          font-size: 0.78rem;
          color: var(--color-muted);
          line-height: 1.35;
          background: var(--color-bg);
        }
        .cal-toast-score strong {
          color: var(--color-text);
          font-weight: 700;
        }
        .cal-toast-score-value {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          font-family: var(--font-mono, monospace);
          font-size: 0.8rem;
          font-weight: 800;
          color: #fff;
          flex-shrink: 0;
        }
        .cal-toast-score-low .cal-toast-score-value { background: #4a9d6f; }
        .cal-toast-score-medium .cal-toast-score-value { background: #d8872d; }
        .cal-toast-score-high .cal-toast-score-value { background: #c44d1e; }

        /* ── Actions ── */
        .cal-toast-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 16px 14px;
        }

        /* ── Nav ── */
        .cal-toast-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 8px 16px 12px;
          border-top: 1px solid var(--color-border);
        }
        .cal-toast-nav-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-muted);
          font-size: 1.2rem;
          padding: 2px 6px;
          border-radius: 4px;
          transition: color var(--transition-fast);
          line-height: 1;
        }
        .cal-toast-nav-btn:disabled { opacity: 0.3; cursor: default; }
        .cal-toast-nav-btn:hover:not(:disabled) { color: var(--color-text); }
        .cal-toast-dots { display: flex; gap: 5px; align-items: center; }
        .cal-toast-nav-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--color-border-dark);
          cursor: pointer;
          transition: background var(--transition-fast);
        }
        .cal-toast-nav-dot-active { background: var(--color-accent); }

        /* ── Mobile ── */
        @media (max-width: 480px) {
          .cal-toast {
            width: calc(100vw - 32px);
            right: 16px;
            bottom: 16px;
          }
        }
      `}</style>
    </>
  )
}
