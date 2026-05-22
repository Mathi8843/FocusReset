import { useEffect, useRef, useState } from 'react'

/**
 * FocusTimer — Full-screen 25-minute Pomodoro-style timer (Step 4).
 *
 * Props:
 *  task        — the priority task string chosen in Step 2
 *  onComplete  — called when 25 min finishes or user clicks "I'm in flow"
 *  onRestart   — called when user clicks Restart
 */

const FOCUS_DURATION = 25 * 60 // 25 minutes in seconds

export default function FocusTimer({ task, onComplete, onRestart }) {
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_DURATION)
  const [paused, setPaused] = useState(false)
  const [completed, setCompleted] = useState(false)
  const intervalRef = useRef(null)
  const wakeLockRef = useRef(null)

  /* --- Screen Wake Lock: prevent device sleep during focus session --- */
  useEffect(() => {
    async function requestWakeLock() {
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
        } catch (err) {
          // Wake lock not available — silent fail, non-critical
          console.log('Wake lock not available:', err.message)
        }
      }
    }
    requestWakeLock()

    /* Re-acquire wake lock when page becomes visible again */
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestWakeLock()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
      }
    }
  }, [])

  /* --- Countdown logic --- */
  useEffect(() => {
    if (paused || completed) {
      clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          setCompleted(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [paused, completed])

  /* When countdown hits 0, notify parent */
  useEffect(() => {
    if (completed) {
      onComplete && onComplete({ earlyExit: false })
    }
  }, [completed])

  /* --- SVG ring math --- */
  const SIZE = 280
  const STROKE = 8
  const radius = (SIZE - STROKE * 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress = secondsLeft / FOCUS_DURATION
  const strokeDashoffset = circumference * (1 - progress)

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const cx = SIZE / 2
  const cy = SIZE / 2

  /* Percentage complete for display */
  const pctDone = Math.round((1 - progress) * 100)

  return (
    <div className="ft-wrapper animate-fade-in">
      {/* Task reminder */}
      <div className="ft-task-pill">
        <span className="ft-task-icon">🎯</span>
        <span className="ft-task-text">{task}</span>
      </div>

      {/* Large circular timer */}
      <div className="ft-ring-container">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`Focus timer: ${timeString} remaining`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background ring */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={STROKE}
          />
          {/* Progress ring */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />

          {/* Center content — rotated back upright */}
          <g style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px` }}>
            <text
              x={cx} y={cy - 18}
              textAnchor="middle" dominantBaseline="central"
              fill="var(--color-text)"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight="700"
              fontSize="3rem"
            >
              {timeString}
            </text>
            <text
              x={cx} y={cy + 28}
              textAnchor="middle"
              fill="var(--color-muted)"
              fontFamily="'Syne', sans-serif"
              fontWeight="500"
              fontSize="0.85rem"
            >
              {paused ? 'PAUSED' : `${pctDone}% complete`}
            </text>
          </g>
        </svg>
      </div>

      {/* Controls */}
      <div className="ft-controls">
        <button
          id="ft-pause-btn"
          className="btn btn-ghost"
          onClick={() => setPaused(p => !p)}
        >
          {paused ? '▶  Resume' : '⏸  Pause'}
        </button>

        <button
          id="ft-flow-btn"
          className="btn btn-success"
          onClick={() => onComplete && onComplete({ earlyExit: true })}
        >
          ✨ I'm in Flow
        </button>

        <button
          id="ft-restart-btn"
          className="btn btn-ghost"
          onClick={() => {
            setSecondsLeft(FOCUS_DURATION)
            setPaused(false)
            setCompleted(false)
            onRestart && onRestart()
          }}
        >
          ↺ Restart
        </button>
      </div>

      <p className="ft-hint">
        The "I'm in flow" button ends your session early and marks it complete.
      </p>

      <style>{`
        .ft-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 32px;
          padding: 40px 0;
          min-height: 70vh;
          justify-content: center;
        }

        .ft-task-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--color-bg-card);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-full);
          padding: 10px 20px;
          max-width: 420px;
          width: 100%;
          box-shadow: var(--shadow-sm);
        }

        .ft-task-icon {
          font-size: 1.1rem;
          flex-shrink: 0;
        }

        .ft-task-text {
          font-family: var(--font-body);
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--color-text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ft-ring-container {
          position: relative;
          filter: drop-shadow(0 4px 20px rgba(232, 93, 38, 0.15));
        }

        .ft-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .ft-hint {
          font-size: 0.8rem;
          color: var(--color-muted);
          text-align: center;
          max-width: 340px;
          opacity: 0.75;
        }

        @media (max-width: 480px) {
          .ft-wrapper { gap: 24px; padding: 24px 0; }
          .ft-controls { flex-direction: column; width: 100%; }
          .ft-controls .btn { width: 100%; }
        }
      `}</style>
    </div>
  )
}
