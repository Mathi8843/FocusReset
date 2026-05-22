import { useEffect, useRef, useState } from 'react'

/**
 * Timer — Reusable countdown with circular SVG progress ring.
 *
 * Props:
 *  durationSeconds  — total countdown time
 *  onComplete       — called when timer hits 0
 *  paused           — pause/resume externally
 *  size             — diameter of the SVG ring (default 120)
 *  strokeWidth      — ring stroke width (default 5)
 *  showLabel        — whether to show "Time remaining" label
 *  compact          — smaller corner variant (no label, smaller font)
 */
export default function Timer({
  durationSeconds,
  onComplete,
  paused = false,
  size = 120,
  strokeWidth = 5,
  showLabel = false,
  compact = false,
}) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds)
  const intervalRef = useRef(null)
  const completedRef = useRef(false)

  /* Reset when duration changes (new step loaded) */
  useEffect(() => {
    setSecondsLeft(durationSeconds)
    completedRef.current = false
  }, [durationSeconds])

  /* Countdown logic */
  useEffect(() => {
    if (paused) {
      clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          if (!completedRef.current) {
            completedRef.current = true
            onComplete && onComplete()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [paused, onComplete])

  /* SVG ring math */
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress = secondsLeft / durationSeconds
  const strokeDashoffset = circumference * (1 - progress)

  /* Format MM:SS */
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  /* Color transitions: accent → orange-red when low */
  const isLow = secondsLeft <= 30 && durationSeconds > 30
  const ringColor = isLow ? '#c44d1e' : 'var(--color-accent)'

  const cx = size / 2
  const cy = size / 2
  const fontSize = compact ? '1.1rem' : size > 200 ? '2.8rem' : '1.4rem'

  return (
    <div className="timer-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {showLabel && !compact && (
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
          Time remaining
        </span>
      )}

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Timer: ${timeString} remaining`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
        />
        {/* Time text — rotated back upright */}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill={isLow ? ringColor : 'var(--color-text)'}
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="700"
          fontSize={fontSize}
          style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'fill 0.5s ease' }}
        >
          {timeString}
        </text>
      </svg>
    </div>
  )
}
