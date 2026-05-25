import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveProfile } from '../utils/storage.js'

/* ================================================================
   DATA CONSTANTS
================================================================ */
const ROLES = [
  { id: 'developer',  label: 'Developer / Engineer', emoji: '💻' },
  { id: 'designer',   label: 'Designer / Creative',  emoji: '🎨' },
  { id: 'manager',    label: 'Manager / Lead',        emoji: '📋' },
  { id: 'writer',     label: 'Writer / Content',      emoji: '✍️' },
  { id: 'analyst',    label: 'Analyst / Data',        emoji: '📊' },
  { id: 'other',      label: 'Other',                 emoji: '🔧' },
]

const TOOLS = [
  { id: 'jira',    label: 'Jira / Linear / Trello',          category: 'Project tracking' },
  { id: 'github',  label: 'GitHub / GitLab',                  category: 'Code' },
  { id: 'figma',   label: 'Figma / Sketch',                   category: 'Design' },
  { id: 'notion',  label: 'Notion / Confluence',              category: 'Docs' },
  { id: 'slack',   label: 'Slack / Teams',                    category: 'Chat' },
  { id: 'gworkspace', label: 'Google Workspace / Office 365', category: 'Docs/Calendar' },
  { id: 'zoom',    label: 'Zoom / Google Meet',               category: 'Video calls' },
]

const FOCUS_PEAKS = [
  { id: 'morning',   emoji: '☀️',  label: 'Morning person',  desc: "I'm sharpest before noon" },
  { id: 'afternoon', emoji: '🌤',  label: 'Afternoon',       desc: 'I hit my stride after lunch' },
  { id: 'evening',   emoji: '🌙',  label: 'Night owl',       desc: 'I focus best in the evening' },
]

const MEETINGS_PER_DAY = ['1–2', '3–4', '5–6', '7–8', '8+']

const TOTAL_STEPS = 5

/* ================================================================
   ANIMATED CHECKMARK SVG
================================================================ */
function AnimatedCheckmark() {
  return (
    <div className="ob-check-wrapper">
      <svg
        className="ob-checkmark"
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle className="ob-check-circle" cx="28" cy="28" r="25" stroke="var(--color-success)" strokeWidth="3" fill="none" />
        <path  className="ob-check-tick"   d="M16 28l9 9 15-16" stroke="var(--color-success)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

/* ================================================================
   PROGRESS BAR — thin line at top
================================================================ */
function ProgressDots({ current, total }) {
  return (
    <div className="ob-progress" role="progressbar" aria-valuenow={current} aria-valuemax={total} aria-label={`Step ${current} of ${total}`}>
      <div className="ob-progress-track">
        <div className="ob-progress-fill" style={{ width: `${(current / total) * 100}%` }} />
      </div>
      <span className="ob-progress-label">{current} of {total}</span>
    </div>
  )
}

/* ================================================================
   SELECTION CARD (single or multi select)
================================================================ */
function SelectCard({ emoji, label, desc, selected, onClick }) {
  return (
    <button
      className={`ob-card${selected ? ' ob-card-selected' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
      type="button"
    >
      {emoji && <span className="ob-card-emoji" role="img" aria-label={label}>{emoji}</span>}
      <span className="ob-card-label">{label}</span>
      {desc && <span className="ob-card-desc">{desc}</span>}
    </button>
  )
}

/* ================================================================
   STEP WRAPPER — handles slide-in animation direction
================================================================ */
function StepPane({ direction, stepKey, children }) {
  return (
    <div
      key={stepKey}
      className={`ob-step-pane ob-slide-${direction}`}
    >
      {children}
    </div>
  )
}

/* ================================================================
   INDIVIDUAL STEPS
================================================================ */

/* Step 1 — Name */
function StepName({ value, onChange, onNext }) {
  const canNext = value.trim().length > 0
  return (
    <div className="ob-step-content">
      <h1 className="ob-heading">Let's get to know you.</h1>
      <p className="ob-sub">This helps FocusReset personalize every suggestion for you.</p>
      <div className="ob-field-group">
        <label className="ob-label" htmlFor="ob-name">What's your first name?</label>
        <input
          id="ob-name"
          type="text"
          className="ob-input"
          placeholder="Mathi"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && canNext && onNext()}
          autoFocus
          autoComplete="given-name"
        />
      </div>
      <button className="btn btn-primary btn-lg ob-next-btn" onClick={onNext} disabled={!canNext}>
        Continue →
      </button>
    </div>
  )
}

/* Step 2 — Role */
function StepRole({ value, onChange, onNext, onBack }) {
  return (
    <div className="ob-step-content">
      <button className="ob-back-btn btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
      <h2 className="ob-heading">What kind of work do you do?</h2>
      <div className="ob-grid-2">
        {ROLES.map(r => (
          <SelectCard
            key={r.id} emoji={r.emoji} label={r.label}
            selected={value === r.id}
            onClick={() => onChange(r.id)}
          />
        ))}
      </div>
      <button className="btn btn-primary btn-lg ob-next-btn" onClick={onNext} disabled={!value}>
        Continue →
      </button>
    </div>
  )
}

/* Step 3 — Tools (multi-select) */
function StepTools({ value, onChange, onNext, onBack }) {
  function toggle(id) {
    onChange(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }
  return (
    <div className="ob-step-content">
      <button className="ob-back-btn btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
      <h2 className="ob-heading">Which tools do you use daily?</h2>
      <p className="ob-sub">Pick as many as apply.</p>
      <div className="ob-grid-1">
        {TOOLS.map(t => (
          <SelectCard
            key={t.id} label={t.label} desc={t.category}
            selected={value.includes(t.id)}
            onClick={() => toggle(t.id)}
          />
        ))}
      </div>
      <button className="btn btn-primary btn-lg ob-next-btn" onClick={onNext}>
        {value.length > 0 ? `Continue with ${value.length} tool${value.length !== 1 ? 's' : ''} →` : 'Skip →'}
      </button>
    </div>
  )
}

/* Step 4 — Projects */
function StepProjects({ value, onChange, onNext, onBack }) {
  function updateProject(i, val) {
    onChange(prev => { const next = [...prev]; next[i] = val; return next })
  }
  return (
    <div className="ob-step-content">
      <button className="ob-back-btn btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
      <h2 className="ob-heading">What are you currently working on?</h2>
      <p className="ob-sub">Add 1–3 project names to personalize your task suggestions.</p>
      <div className="ob-field-group">
        {[0, 1, 2].map(i => (
          <div key={i} className="ob-project-field">
            <label className="ob-label" htmlFor={`ob-project-${i}`}>
              Project {i + 1} {i === 0 ? '' : <span className="ob-optional">(optional)</span>}
            </label>
            <input
              id={`ob-project-${i}`}
              type="text"
              className="ob-input"
              placeholder={i === 0 ? 'e.g. Q2 Product Launch' : i === 1 ? 'e.g. API Redesign' : 'e.g. Team Docs'}
              value={value[i] || ''}
              onChange={e => updateProject(i, e.target.value)}
            />
          </div>
        ))}
      </div>
      <button className="btn btn-primary btn-lg ob-next-btn" onClick={onNext}>Continue →</button>
      <button className="ob-skip-link" onClick={onNext}>Skip this step</button>
    </div>
  )
}

/* Step 5 — Work Pattern */
function StepWorkPattern({ focusPeak, onFocusPeakChange, meetingsPerDay, onMeetingsChange, onNext, onBack, saving }) {
  const canNext = focusPeak && meetingsPerDay
  return (
    <div className="ob-step-content">
      <button className="ob-back-btn btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
      <h2 className="ob-heading">When do you do your best deep work?</h2>
      <div className="ob-grid-1" style={{ marginBottom: 32 }}>
        {FOCUS_PEAKS.map(p => (
          <SelectCard
            key={p.id} emoji={p.emoji} label={p.label} desc={p.desc}
            selected={focusPeak === p.id}
            onClick={() => onFocusPeakChange(p.id)}
          />
        ))}
      </div>
      <p className="ob-sub" style={{ marginBottom: 12 }}>How many meetings do you typically have per day?</p>
      <div className="ob-pills">
        {MEETINGS_PER_DAY.map(opt => (
          <button
            key={opt}
            className={`ob-pill${meetingsPerDay === opt ? ' ob-pill-active' : ''}`}
            onClick={() => onMeetingsChange(opt)}
            type="button"
          >
            {opt}
          </button>
        ))}
      </div>
      <button
        className="btn btn-primary btn-lg ob-next-btn"
        onClick={onNext}
        disabled={!canNext || saving}
      >
        {saving ? 'Saving…' : 'Finish Setup →'}
      </button>
    </div>
  )
}

/* ================================================================
   COMPLETION SCREEN
================================================================ */
function CompletionScreen({ name }) {
  const navigate = useNavigate()
  return (
    <div className="ob-completion animate-scale-in">
      <AnimatedCheckmark />
      <h2 className="ob-completion-heading">You're all set, {name}.</h2>
      <p className="ob-completion-body">
        FocusReset will now personalize every reset, every suggestion,
        and every insight for you.
      </p>
      <button
        id="ob-start-reset-btn"
        className="btn btn-primary btn-lg"
        onClick={() => navigate('/reset')}
      >
        Start My First Reset →
      </button>
      <button
        className="ob-skip-link"
        onClick={() => navigate('/dashboard')}
      >
        Go to Dashboard instead
      </button>
    </div>
  )
}

/* ================================================================
   ONBOARDING PAGE — orchestrator
================================================================ */
export default function Onboarding() {
  const [step, setStep]             = useState(1)
  const [direction, setDirection]   = useState('forward')
  const [done, setDone]             = useState(false)
  const [saving, setSaving]         = useState(false)

  /* Form state */
  const [name, setName]             = useState('')
  const [role, setRole]             = useState('')
  const [tools, setTools]           = useState([])
  const [projects, setProjects]     = useState(['', '', ''])
  const [focusPeak, setFocusPeak]   = useState('')
  const [meetingsPerDay, setMeetings] = useState('')

  function goNext() {
    setDirection('forward')
    setStep(s => s + 1)
  }

  function goBack() {
    setDirection('back')
    setStep(s => s - 1)
  }

  async function handleFinish() {
    setSaving(true)
    const profile = {
      name: name.trim(),
      role,
      tools,
      projects: projects.filter(p => p.trim() !== ''),
      focusPeak,
      meetingsPerDay,
      onboardingCompleted: true,
      onboardingDate: new Date().toISOString(),
    }
    try {
      await saveProfile(profile)
    } catch (err) {
      console.warn('[Onboarding] saveProfile error (non-fatal):', err)
    } finally {
      setSaving(false)
      setDone(true)
    }
  }

  return (
    <div className="ob-page">
      {!done && (
        <div className="ob-top-bar">
          <span className="ob-logo">Focus<span>Reset</span></span>
          <ProgressDots current={step} total={TOTAL_STEPS} />
        </div>
      )}

      <div className="ob-body">
        {done ? (
          <CompletionScreen name={name || 'there'} />
        ) : (
          <div className="ob-pane-container">
            <StepPane direction={direction} stepKey={step}>
              {step === 1 && <StepName    value={name}       onChange={setName}     onNext={goNext} />}
              {step === 2 && <StepRole    value={role}       onChange={setRole}     onNext={goNext}       onBack={goBack} />}
              {step === 3 && <StepTools   value={tools}      onChange={setTools}    onNext={goNext}       onBack={goBack} />}
              {step === 4 && <StepProjects value={projects}  onChange={setProjects} onNext={goNext}       onBack={goBack} />}
              {step === 5 && (
                <StepWorkPattern
                  focusPeak={focusPeak}         onFocusPeakChange={setFocusPeak}
                  meetingsPerDay={meetingsPerDay} onMeetingsChange={setMeetings}
                  onNext={handleFinish}          onBack={goBack}
                  saving={saving}
                />
              )}
            </StepPane>
          </div>
        )}
      </div>

      <style>{`
        /* ---- Page shell ---- */
        .ob-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--color-bg);
        }

        /* ---- Top bar ---- */
        .ob-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid var(--color-border);
          background: var(--color-bg-card);
        }
        .ob-logo {
          font-family: var(--font-display);
          font-size: 1.2rem;
          color: var(--color-text);
        }
        .ob-logo span { color: var(--color-accent); }

        /* ---- Progress bar ---- */
        .ob-progress {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .ob-progress-track {
          width: 140px;
          height: 4px;
          background: var(--color-border);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        .ob-progress-fill {
          height: 100%;
          background: var(--color-accent);
          border-radius: var(--radius-full);
          transition: width 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .ob-progress-label {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--color-muted);
          letter-spacing: 0.04em;
          white-space: nowrap;
        }

        /* ---- Body / centering ---- */
        .ob-body {
          flex: 1;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 48px 24px 80px;
          overflow: hidden;
        }

        .ob-pane-container {
          width: 100%;
          max-width: 480px;
          overflow: hidden;
        }

        /* ---- Step slide animation ---- */
        .ob-step-pane {
          width: 100%;
        }
        .ob-slide-forward {
          animation: obSlideForward 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        .ob-slide-back {
          animation: obSlideBack 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        @keyframes obSlideForward {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes obSlideBack {
          from { transform: translateX(-40px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }

        /* ---- Step content layout ---- */
        .ob-step-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
          position: relative;
          padding-top: 8px;
        }

        .ob-heading {
          font-family: var(--font-display);
          font-size: clamp(1.75rem, 5vw, 2.25rem);
          line-height: 1.15;
          color: var(--color-text);
          margin: 0;
        }

        .ob-sub {
          font-size: 1rem;
          color: var(--color-muted);
          margin: -8px 0 0;
          line-height: 1.6;
        }

        /* ---- Back button ---- */
        .ob-back-btn {
          align-self: flex-start;
          margin-bottom: -8px;
        }

        /* ---- Input ---- */
        .ob-field-group {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .ob-label {
          font-family: var(--font-body);
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text);
          display: block;
          margin-bottom: 6px;
        }
        .ob-optional {
          font-weight: 400;
          color: var(--color-muted);
        }
        .ob-input {
          font-family: var(--font-body);
          font-size: 1.0625rem;
          color: var(--color-text);
          background: var(--color-bg-card);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          width: 100%;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          outline: none;
        }
        .ob-input:focus {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px rgba(232,93,38,0.12);
        }
        .ob-input::placeholder { color: var(--color-muted); opacity: 0.6; }

        .ob-project-field { display: flex; flex-direction: column; }

        /* ---- Selection cards ---- */
        .ob-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .ob-grid-1 {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ob-card {
          background: var(--color-bg-card);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: var(--font-body);
          width: 100%;
        }
        .ob-card:hover {
          border-color: var(--color-accent);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }
        .ob-card-selected {
          border-color: var(--color-accent) !important;
          background: #fef6f1 !important;
          box-shadow: 0 0 0 3px rgba(232,93,38,0.12) !important;
          transform: scale(1.02);
        }
        .ob-card-emoji {
          font-size: 1.5rem;
          margin-bottom: 2px;
        }
        .ob-card-label {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--color-text);
          line-height: 1.3;
        }
        .ob-card-desc {
          font-size: 0.78rem;
          color: var(--color-muted);
          line-height: 1.4;
        }

        /* ---- Pill buttons ---- */
        .ob-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .ob-pill {
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          padding: 10px 20px;
          border-radius: var(--radius-full);
          border: 1.5px solid var(--color-border-dark);
          background: var(--color-bg-card);
          color: var(--color-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .ob-pill:hover {
          border-color: var(--color-accent);
          color: var(--color-accent);
        }
        .ob-pill-active {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: #fff;
        }

        /* ---- Next / skip ---- */
        .ob-next-btn { width: 100%; justify-content: center; margin-top: 4px; }
        .ob-skip-link {
          background: none;
          border: none;
          font-family: var(--font-body);
          font-size: 0.85rem;
          color: var(--color-muted);
          cursor: pointer;
          text-align: center;
          padding: 4px;
          text-decoration: underline;
          text-underline-offset: 3px;
          transition: color 0.15s ease;
          align-self: center;
        }
        .ob-skip-link:hover { color: var(--color-text); }

        /* ---- Completion screen ---- */
        .ob-completion {
          max-width: 420px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 20px;
          padding-top: 32px;
        }
        .ob-completion-heading {
          font-size: clamp(1.75rem, 5vw, 2.25rem);
          margin: 0;
        }
        .ob-completion-body {
          color: var(--color-muted);
          font-size: 1rem;
          line-height: 1.65;
          max-width: 340px;
          margin: 0;
        }
        .ob-completion .btn { width: 100%; justify-content: center; }

        /* ---- Checkmark SVG animation ---- */
        .ob-check-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ob-checkmark {
          width: 80px;
          height: 80px;
        }
        .ob-check-circle {
          stroke-dasharray: 160;
          stroke-dashoffset: 160;
          animation: obDrawCircle 0.5s ease forwards;
        }
        .ob-check-tick {
          stroke-dasharray: 40;
          stroke-dashoffset: 40;
          animation: obDrawTick 0.35s ease 0.45s forwards;
        }
        @keyframes obDrawCircle {
          to { stroke-dashoffset: 0; }
        }
        @keyframes obDrawTick {
          to { stroke-dashoffset: 0; }
        }

        /* ---- Mobile ---- */
        @media (max-width: 520px) {
          .ob-body { padding: 28px 16px 60px; }
          .ob-grid-2 { grid-template-columns: 1fr; }
          .ob-progress-track { width: 100px; }
        }
      `}</style>
    </div>
  )
}
