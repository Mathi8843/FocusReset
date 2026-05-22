/**
 * ProgressBar — Step indicator dots/line at the top of the Reset flow.
 *
 * Props:
 *  currentStep — 0-indexed current step (0-3)
 *  totalSteps  — total number of steps (default 4)
 */
export default function ProgressBar({ currentStep, totalSteps = 4 }) {
  const stepLabels = ['Brain Dump', 'Priority', 'Entry Task', 'Focus']

  return (
    <div className="progress-bar-wrapper" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemax={totalSteps}>
      <div className="progress-bar-steps">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className="progress-step-item">
            {/* Connector line — shown before each step except the first */}
            {i > 0 && (
              <div
                className={`progress-connector ${i <= currentStep ? 'progress-connector-active' : ''}`}
              />
            )}
            {/* Step dot */}
            <div
              className={`progress-dot ${
                i < currentStep ? 'progress-dot-done' :
                i === currentStep ? 'progress-dot-active' :
                'progress-dot-pending'
              }`}
              aria-label={`Step ${i + 1}: ${stepLabels[i]}`}
            >
              {i < currentStep ? (
                /* Checkmark for completed steps */
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Step labels row */}
      <div className="progress-labels">
        {stepLabels.map((label, i) => (
          <span
            key={i}
            className={`progress-label ${i === currentStep ? 'progress-label-active' : ''}`}
          >
            {label}
          </span>
        ))}
      </div>

      <style>{`
        .progress-bar-wrapper {
          padding: 20px 0 0;
          width: 100%;
        }

        .progress-bar-steps {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          margin-bottom: 8px;
        }

        .progress-step-item {
          display: flex;
          align-items: center;
        }

        .progress-connector {
          width: 60px;
          height: 2px;
          background-color: var(--color-border);
          transition: background-color 0.4s ease;
        }

        .progress-connector-active {
          background-color: var(--color-accent);
        }

        .progress-dot {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          font-weight: 700;
          transition: all 0.3s ease;
          flex-shrink: 0;
        }

        .progress-dot-pending {
          background-color: var(--color-bg);
          border: 2px solid var(--color-border);
          color: var(--color-muted);
        }

        .progress-dot-active {
          background-color: var(--color-accent);
          border: 2px solid var(--color-accent);
          color: white;
          box-shadow: 0 0 0 4px rgba(232, 93, 38, 0.18);
        }

        .progress-dot-done {
          background-color: var(--color-success);
          border: 2px solid var(--color-success);
          color: white;
        }

        .progress-labels {
          display: flex;
          justify-content: center;
          gap: 0;
          padding: 0 4px;
        }

        .progress-label {
          width: 92px;
          text-align: center;
          font-family: var(--font-body);
          font-size: 0.7rem;
          font-weight: 500;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-muted);
          transition: color 0.3s ease;
          flex-shrink: 0;
        }

        .progress-label-active {
          color: var(--color-accent);
          font-weight: 700;
        }

        @media (max-width: 480px) {
          .progress-connector { width: 36px; }
          .progress-label { width: 68px; font-size: 0.62rem; }
          .progress-dot { width: 28px; height: 28px; font-size: 0.7rem; }
        }
      `}</style>
    </div>
  )
}
