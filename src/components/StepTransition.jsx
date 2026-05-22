import { useEffect, useRef } from 'react'

/**
 * StepTransition — Wrapper that animates child content sliding in from the right
 * when `stepKey` changes. Uses CSS animation + a forced reflow trick.
 *
 * Props:
 *  stepKey  — unique key for the current step (change triggers animation)
 *  children — step content to display
 */
export default function StepTransition({ stepKey, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    /* Remove animation class, force reflow, then re-add to re-trigger */
    el.classList.remove('step-entering')
    void el.offsetWidth // force reflow
    el.classList.add('step-entering')
  }, [stepKey])

  return (
    <div ref={ref} className="step-entering" style={{ width: '100%' }}>
      {children}

      <style>{`
        .step-entering {
          animation: stepSlideIn 0.32s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }

        @keyframes stepSlideIn {
          from {
            transform: translateX(36px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
