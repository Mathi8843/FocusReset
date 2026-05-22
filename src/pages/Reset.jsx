import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Timer from '../components/Timer.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import StepTransition from '../components/StepTransition.jsx'
import MeetingTypeSelector from '../components/MeetingTypeSelector.jsx'
import FocusTimer from '../components/FocusTimer.jsx'
import { saveSession } from '../utils/storage.js'
import {
  assembleFullContext,
  extractBrainDumpContext,
  generateStepSuggestions,
} from '../services/contextAssembler.js'
import { calculateHangoverScore, formatHangoverScore } from '../utils/hangoverScore.js'

/* ============================================================
   DATA CONSTANTS
   ============================================================ */

/* Step 2: Default priority task cards */
const PRIORITY_TASKS = [
  { id: 'coding',  label: 'Deep Coding',   emoji: '💻', desc: 'Write or review code' },
  { id: 'writing', label: 'Writing',        emoji: '✍️', desc: 'Draft, edit, or document' },
  { id: 'email',   label: 'Clear Inbox',    emoji: '📬', desc: 'Process emails & messages' },
  { id: 'notes',   label: 'Meeting Notes',  emoji: '📝', desc: 'Capture what was discussed' },
]

/* Step 3: Entry micro-tasks keyed by priority task ID */
const ENTRY_TASKS = {
  coding: [
    'Open your IDE and read only the last function you wrote',
    'Write just the function signature and a comment',
    'Set up your environment: open all needed files and tabs',
    'Read the ticket/issue description for 60 seconds only',
  ],
  writing: [
    'Open the document and read only the last paragraph',
    'Write just the section heading',
    'Open your outline and read the next bullet point',
    'Set a 2-minute timer and free-write — no editing allowed',
  ],
  email: [
    'Open your inbox and archive anything older than 2 days',
    'Reply to just one email — the shortest one',
    'Flag the 3 most important emails to handle',
    'Write one subject line you\'ve been avoiding',
  ],
  notes: [
    'Open your notes app and write today\'s date and meeting name',
    'List just the 3 key decisions made in the meeting',
    'Write one action item with your name next to it',
    'Copy the meeting agenda as a skeleton to fill in',
  ],
  custom: [
    'Open everything you need to get started',
    'Write down the very first physical action to take',
    'Set a 5-minute "just look at it" timer — no pressure to do anything',
    'Read any notes or context you have on this task',
  ],
}

/* ============================================================
   STEP VIEWS
   ============================================================ */

/* --- Step 1: Brain Dump --- */
function BrainDump({ onDone, meetingName, hangoverScore }) {
  const [text, setText] = useState('')
  const [timerDone, setTimerDone] = useState(false)

  return (
    <div className="step-view">
      {/* Corner timer */}
      <div className="step-corner-timer">
        <Timer
          durationSeconds={120}
          onComplete={() => setTimerDone(true)}
          compact
          size={72}
          strokeWidth={4}
        />
      </div>

      <div className="step-content">
        <span className="badge badge-accent">Step 1 of 4 · 2 minutes</span>

        {/* Calendar context banner — only shown when pre-filled */}
        {meetingName && (
          <div className="brain-dump-context-banner">
            <span className="brain-dump-context-icon">📅</span>
            <span>
              Resetting after: <strong>{meetingName}</strong>
              {hangoverScore && <> · {formatHangoverScore(hangoverScore)}</>}
            </span>
          </div>
        )}

        <h2 className="step-heading">Brain Dump</h2>
        <p className="step-description">
          What's still running in your mind from that meeting?{' '}
          <em>Just dump it all out.</em>
        </p>

        <textarea
          id="brain-dump-textarea"
          className="brain-dump-textarea"
          placeholder="Type freely... decisions made, things to follow up on, worries, anything..."
          value={text}
          onChange={e => setText(e.target.value)}
          rows={9}
          autoFocus
        />

        <div className="step-actions">
          {timerDone && (
            <p className="timer-done-hint">⏱ Timer complete — you can continue or move on.</p>
          )}
          {/* Brain dump text is intentionally NOT saved — privacy */}
          <button
            id="brain-dump-done-btn"
            className="btn btn-primary btn-lg"
            onClick={() => onDone(text)}
          >
            Done — Clear & Continue →
          </button>
        </div>

        <p className="step-privacy-note">
          🔒 This text is never saved. It clears the moment you continue.
        </p>
      </div>
    </div>
  )
}

/* --- Step 2: Priority Reset --- */
function PriorityReset({ onDone, aiTasks }) {
  const [selected, setSelected] = useState(null)
  const [customTask, setCustomTask] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [timerDone, setTimerDone] = useState(false)

  // Use AI-generated tasks if available, otherwise fall back to defaults
  const taskCards = aiTasks?.length ? aiTasks : PRIORITY_TASKS
  const isAI = !!(aiTasks?.length)

  function handleContinue() {
    const task = showCustom ? customTask.trim() : taskCards.find(t => t.id === selected)?.label
    if (!task) return
    onDone({ task, taskId: showCustom ? 'custom' : selected })
  }

  const canContinue = showCustom ? customTask.trim().length > 0 : selected !== null

  return (
    <div className="step-view">
      <div className="step-corner-timer">
        <Timer
          durationSeconds={60}
          onComplete={() => setTimerDone(true)}
          compact
          size={72}
          strokeWidth={4}
        />
      </div>

      <div className="step-content">
        <span className="badge badge-accent">Step 2 of 4 · 1 minute</span>
        <h2 className="step-heading">Priority Reset</h2>
        <p className="step-description">
          What is the <em>single most important thing</em> you need to do in the next 90 minutes?
        </p>

        {isAI && (
          <div className="ai-badge-row">
            <span className="badge badge-ghost" style={{ fontSize: '0.68rem' }}>✨ AI-personalized for you</span>
          </div>
        )}

        {/* Task cards */}
        <div className="priority-grid">
          {taskCards.map(task => (
            <button
              key={task.id}
              className={`priority-card card card-selectable ${selected === task.id && !showCustom ? 'card-selected' : ''}`}
              onClick={() => { setSelected(task.id); setShowCustom(false) }}
              aria-pressed={selected === task.id && !showCustom}
            >
              <span className="priority-emoji" role="img" aria-label={task.label}>{task.emoji || '🎯'}</span>
              <span className="priority-label">{task.label}</span>
              <span className="priority-desc">{task.why || task.desc}</span>
            </button>
          ))}
        </div>

        {/* Custom task option */}
        <button
          className={`custom-task-toggle ${showCustom ? 'custom-task-toggle-active' : ''}`}
          onClick={() => { setShowCustom(s => !s); setSelected(null) }}
        >
          ✏️ Type my own task
        </button>

        {showCustom && (
          <input
            id="custom-task-input"
            type="text"
            placeholder="e.g. Finish the quarterly report"
            value={customTask}
            onChange={e => setCustomTask(e.target.value)}
            autoFocus
            style={{ marginTop: 8 }}
          />
        )}

        <div className="step-actions">
          {timerDone && (
            <p className="timer-done-hint">⏱ Timer complete — you can continue or move on.</p>
          )}
          <button
            id="priority-done-btn"
            className="btn btn-primary btn-lg"
            onClick={handleContinue}
            disabled={!canContinue}
          >
            Set My Priority →
          </button>
        </div>
      </div>
    </div>
  )
}

/* --- Step 3: Entry Task --- */
function EntryTask({ taskId, onDone, aiEntryTasks }) {
  const [selected, setSelected] = useState(null)
  const [timerDone, setTimerDone] = useState(false)

  // Use AI-generated micro-tasks for this taskId if available
  const rawAI = aiEntryTasks?.[taskId]
  const aiList = Array.isArray(rawAI)
    ? rawAI.map(t => (typeof t === 'string' ? t : t.label))
    : null

  const microTasks = aiList?.length ? aiList : (ENTRY_TASKS[taskId] || ENTRY_TASKS.custom)
  const isAI = !!(aiList?.length)

  return (
    <div className="step-view">
      <div className="step-corner-timer">
        <Timer
          durationSeconds={120}
          onComplete={() => setTimerDone(true)}
          compact
          size={72}
          strokeWidth={4}
        />
      </div>

      <div className="step-content">
        <span className="badge badge-accent">Step 3 of 4 · 2 minutes</span>
        <h2 className="step-heading">Entry Task</h2>
        <p className="step-description">
          Choose one tiny action to <em>ease yourself in</em> — no pressure to do the whole thing.
        </p>

        {isAI && (
          <div className="ai-badge-row">
            <span className="badge badge-ghost" style={{ fontSize: '0.68rem' }}>✨ AI-personalized for you</span>
          </div>
        )}

        <div className="entry-task-list">
          {microTasks.map((task, i) => (
            <button
              key={i}
              className={`entry-task-item card card-selectable ${selected === i ? 'card-selected' : ''}`}
              onClick={() => setSelected(i)}
              aria-pressed={selected === i}
            >
              <span className="entry-task-number mono">{String(i + 1).padStart(2, '0')}</span>
              <span className="entry-task-text">{task}</span>
            </button>
          ))}
        </div>

        <div className="step-actions">
          {timerDone && (
            <p className="timer-done-hint">⏱ Timer complete — you can continue or move on.</p>
          )}
          <button
            id="entry-task-done-btn"
            className="btn btn-primary btn-lg"
            onClick={() => onDone({ entryTask: microTasks[selected] })}
            disabled={selected === null}
          >
            Start My Entry Task →
          </button>
        </div>
      </div>
    </div>
  )
}

/* --- Step 4: Focus Timer (25 min) --- */
function FocusStep({ task, onSessionComplete }) {
  function handleComplete({ earlyExit }) {
    onSessionComplete({ earlyExit })
  }

  function handleRestart() {
    // No-op — FocusTimer resets itself internally
  }

  return (
    <div className="step-view step-view-focus">
      <div className="step-content">
        <span className="badge badge-accent" style={{ marginBottom: 8 }}>Step 4 of 4 · 25 minutes</span>
        <h2 className="step-heading" style={{ marginBottom: 0 }}>Focus Timer</h2>
        <FocusTimer
          task={task}
          onComplete={handleComplete}
          onRestart={handleRestart}
        />
      </div>
    </div>
  )
}

/* --- Completion Screen --- */
function CompletionScreen({ task, meetingType, hangoverScore, onReset }) {
  return (
    <div className="completion-wrapper animate-scale-in">
      <div className="completion-icon">✅</div>
      <h2 className="completion-title">Session Complete!</h2>
      <p className="completion-subtitle">You successfully reset your focus after your meeting.</p>

      <div className="completion-card card">
        <div className="completion-stat">
          <span className="completion-stat-label">Focus task</span>
          <span className="completion-stat-value">{task}</span>
        </div>
        <div className="completion-divider" />
        <div className="completion-stat">
          <span className="completion-stat-label">Meeting type</span>
          <span className="completion-stat-value">{meetingType}</span>
        </div>
        {hangoverScore && (
          <>
            <div className="completion-divider" />
            <div className="completion-stat">
              <span className="completion-stat-label">Hangover score</span>
              <span className="completion-stat-value">{hangoverScore.score}/100 · {hangoverScore.label}</span>
            </div>
          </>
        )}
        <div className="completion-divider" />
        <div className="completion-stat">
          <span className="completion-stat-label">Time reclaimed</span>
          <span className="completion-stat-value text-success">~40 minutes</span>
        </div>
      </div>

      <div className="completion-streak">
        <span className="completion-streak-icon">🔥</span>
        <span>Keep going — check your dashboard to see your streak.</span>
      </div>

      <div className="completion-actions">
        <button
          id="start-another-btn"
          className="btn btn-primary btn-lg"
          onClick={onReset}
        >
          Start Another Reset
        </button>
        <a href="/dashboard" className="btn btn-ghost">
          View Dashboard →
        </a>
      </div>

      <style>{`
        .completion-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 24px;
          padding: 40px 0;
          max-width: 480px;
          margin: 0 auto;
        }
        .completion-icon { font-size: 3.5rem; }
        .completion-title { font-size: 2rem; }
        .completion-subtitle { color: var(--color-muted); }
        .completion-card { width: 100%; text-align: left; }
        .completion-stat { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; }
        .completion-stat-label { font-size: 0.85rem; color: var(--color-muted); font-weight: 500; }
        .completion-stat-value { font-weight: 700; font-size: 0.95rem; color: var(--color-text); }
        .completion-divider { height: 1px; background: var(--color-border); }
        .completion-streak {
          display: flex; align-items: center; gap: 8px;
          background: var(--color-bg-card); border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg); padding: 14px 20px;
          font-size: 0.9rem; color: var(--color-muted); width: 100%;
        }
        .completion-streak-icon { font-size: 1.25rem; }
        .completion-actions { display: flex; flex-direction: column; gap: 10px; width: 100%; }
        .completion-actions .btn { justify-content: center; }
      `}</style>
    </div>
  )
}

/* ============================================================
   RESET PAGE — Orchestrates the full 4-step flow
   ============================================================ */
export default function Reset({ prefillMeeting, onPrefillConsumed }) {
  /* Phase: 'meeting-select' → 'step-1' → 'step-2' → 'step-3' → 'step-4' → 'complete' */
  const [phase, setPhase] = useState('meeting-select')
  const [meetingType, setMeetingType] = useState(() => prefillMeeting?.meetingType || '')
  const [meetingName, setMeetingName] = useState(() => prefillMeeting?.meetingName || '')   // from calendar prefill
  const [meetingContext, setMeetingContext] = useState(() => prefillMeeting?.meetingType ? {
    id: prefillMeeting.meetingId,
    summary: prefillMeeting.meetingName,
    meetingType: prefillMeeting.meetingType,
    startTime: prefillMeeting.meetingStartTime,
    endTime: prefillMeeting.meetingEndTime,
    attendees: prefillMeeting.meetingAttendees,
    hangoverScore: prefillMeeting.hangoverScore,
  } : null)
  const [priorityTask, setPriorityTask] = useState('')
  const [priorityTaskId, setPriorityTaskId] = useState('custom')

  // AI-generated suggestions (populated in background after Step 1)
  const [aiSuggestions, setAiSuggestions] = useState(null) // { priorityTasks, entryTasks }

  // Ref to store brain dump context for feeding into suggestions
  const brainDumpContextRef = useRef(null)

  /* Apply calendar pre-fill on first mount */
  useEffect(() => {
    if (onPrefillConsumed) onPrefillConsumed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Step timing tracking */
  const sessionStartRef = useRef(0)
  const stepTimingsRef = useRef({})
  const stepStartRef = useRef(0)

  const navigate = useNavigate()

  /* Map phase to step index (0-based) for ProgressBar */
  const PHASE_TO_STEP = { 'step-1': 0, 'step-2': 1, 'step-3': 2, 'step-4': 3 }
  const currentStep = PHASE_TO_STEP[phase] ?? -1

  function recordStepTiming(stepName) {
    const elapsed = Math.round((Date.now() - stepStartRef.current) / 1000)
    stepTimingsRef.current[stepName] = elapsed
    stepStartRef.current = Date.now()
  }

  function handleMeetingContinue() {
    console.log('[FocusReset Debug] handleMeetingContinue: starting reset flow with type =', meetingType);
    const fallbackMeeting = {
      meetingType,
      summary: meetingName,
      startTime: new Date(Date.now() - 30 * 60000).toISOString(),
      endTime: new Date().toISOString(),
      attendees: 2,
    }
    const activeMeeting = meetingContext || {
      ...fallbackMeeting,
      hangoverScore: calculateHangoverScore({ meeting: fallbackMeeting }),
    }
    setMeetingContext(activeMeeting)
    sessionStartRef.current = Date.now()
    stepStartRef.current = Date.now()
    setPhase('step-1')

    // 🤖 Fire context assembly + AI suggestions in the background.
    // By the time the user finishes Step 1 (2 min), suggestions are ready.
    assembleFullContext({
      meetingType,
      meetingName,
      startTime: new Date().toISOString(),
      meeting: activeMeeting,
      hangoverScore: activeMeeting.hangoverScore,
    })
      .then(ctx => {
        console.log('[FocusReset Debug] handleMeetingContinue: context assembled:', ctx);
        return generateStepSuggestions(ctx);
      })
      .then(suggestions => {
        console.log('[FocusReset Debug] handleMeetingContinue: suggestions generated:', suggestions);
        setAiSuggestions(suggestions)
      })
      .catch(err => {
        // Silently fail — defaults will be used
        console.warn('[FocusReset Debug] AI suggestions failed in handleMeetingContinue:', err.message, err)
      })
  }

  function handleBrainDumpDone(text) {
    console.log('[FocusReset Debug] handleBrainDumpDone: text length =', text?.length);
    recordStepTiming('brainDump')
    setPhase('step-2')

    // 🤖 Extract context from brain dump in background to refine suggestions.
    // If this finishes before user picks Step 2, suggestions update automatically.
    if (text?.trim().length >= 20) {
      console.log('[FocusReset Debug] handleBrainDumpDone: initiating brain dump extraction for text =', text);
      extractBrainDumpContext(text)
        .then(ctx => {
          console.log('[FocusReset Debug] handleBrainDumpDone: context extracted:', ctx);
          brainDumpContextRef.current = ctx
          // Re-generate suggestions enriched with brain dump context
          return assembleFullContext({
            meetingType,
            meetingName,
            meeting: meetingContext,
            hangoverScore: meetingContext?.hangoverScore,
          })
            .then(fullCtx => {
              const enriched = { ...fullCtx, brainDump: ctx }
              console.log('[FocusReset Debug] handleBrainDumpDone: full context assembled for enrichment:', enriched);
              return generateStepSuggestions(enriched)
            })
        })
        .then(suggestions => {
          console.log('[FocusReset Debug] handleBrainDumpDone: enriched suggestions received:', suggestions);
          setAiSuggestions(suggestions)
        })
        .catch((err) => {
          console.error('[FocusReset Debug] handleBrainDumpDone enrichment failed:', err);
          /* silently use existing suggestions */
        })
    } else {
      console.log('[FocusReset Debug] handleBrainDumpDone: text too short for extraction, skipping.');
    }
  }

  function handlePriorityDone({ task, taskId }) {
    recordStepTiming('priorityReset')
    setPriorityTask(task)
    setPriorityTaskId(taskId)
    setPhase('step-3')
  }

  function handleEntryTaskDone() {
    recordStepTiming('entryTask')
    setPhase('step-4')
  }

  function handleSessionComplete({ earlyExit }) {
    recordStepTiming('focusTimer')
    const totalDuration = Math.round((Date.now() - sessionStartRef.current) / 1000)

    /* Save session to localStorage */
    saveSession({
      date: new Date().toISOString(),
      meetingType,
      meetingName,
      meetingContext,
      hangoverScore: meetingContext?.hangoverScore,
      priorityTask,
      stepTimings: stepTimingsRef.current,
      totalDuration,
      completed: true,
      earlyExit,
    })

    setPhase('complete')
  }

  function handleStartOver() {
    setPhase('meeting-select')
    setMeetingType('')
    setMeetingName('')
    setMeetingContext(null)
    setPriorityTask('')
    setPriorityTaskId('custom')
    setAiSuggestions(null)
    brainDumpContextRef.current = null
    stepTimingsRef.current = {}
  }

  return (
    <div className="reset-page">
      {/* Progress bar — visible only during steps 1-4 */}
      {currentStep >= 0 && (
        <div className="reset-progress-wrapper">
          <div className="container">
            <ProgressBar currentStep={currentStep} />
          </div>
        </div>
      )}

      <div className="reset-container container">
        {phase === 'meeting-select' && (
          <StepTransition stepKey="meeting-select">
            <MeetingTypeSelector
              selected={meetingType}
              onSelect={setMeetingType}
              onContinue={handleMeetingContinue}
            />
          </StepTransition>
        )}

        {phase === 'step-1' && (
          <StepTransition stepKey="step-1">
            <BrainDump
              onDone={handleBrainDumpDone}
              meetingName={meetingName}
              hangoverScore={meetingContext?.hangoverScore}
            />
          </StepTransition>
        )}

        {phase === 'step-2' && (
          <StepTransition stepKey="step-2">
            <PriorityReset
              onDone={handlePriorityDone}
              aiTasks={aiSuggestions?.priorityTasks}
            />
          </StepTransition>
        )}

        {phase === 'step-3' && (
          <StepTransition stepKey="step-3">
            <EntryTask
              taskId={priorityTaskId}
              onDone={handleEntryTaskDone}
              aiEntryTasks={aiSuggestions?.entryTasks}
            />
          </StepTransition>
        )}

        {phase === 'step-4' && (
          <StepTransition stepKey="step-4">
            <FocusStep
              task={priorityTask}
              meetingType={meetingType}
              onSessionComplete={handleSessionComplete}
            />
          </StepTransition>
        )}

        {phase === 'complete' && (
          <StepTransition stepKey="complete">
            <CompletionScreen
              task={priorityTask}
              meetingType={meetingType}
              hangoverScore={meetingContext?.hangoverScore}
              onReset={handleStartOver}
            />
          </StepTransition>
        )}
      </div>

      {/* Back to home link — visible during meeting select & steps */}
      {phase !== 'complete' && (
        <div className="reset-footer">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/')}
          >
            ← Back to Home
          </button>
        </div>
      )}

      <style>{`
        .reset-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--color-bg);
        }

        .reset-progress-wrapper {
          border-bottom: 1px solid var(--color-border);
          background: var(--color-bg-card);
          padding-bottom: 16px;
        }

        .reset-container {
          flex: 1;
          padding-top: 40px;
          padding-bottom: 40px;
        }

        /* --- Step shared styles --- */
        .step-view {
          position: relative;
          width: 100%;
        }

        .step-corner-timer {
          position: absolute;
          top: 0;
          right: 0;
          z-index: 10;
        }

        .step-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 600px;
        }

        .step-heading {
          font-size: clamp(1.75rem, 4vw, 2.5rem);
          margin-top: 4px;
        }

        .step-description {
          font-size: 1.0625rem;
          color: var(--color-muted);
          line-height: 1.65;
        }

        .step-description em {
          font-style: italic;
          color: var(--color-text);
          font-family: var(--font-display);
        }

        /* Calendar context banner */
        .brain-dump-context-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(232, 93, 38, 0.06);
          border: 1px solid rgba(232, 93, 38, 0.2);
          border-radius: var(--radius-md);
          padding: 9px 14px;
          font-size: 0.85rem;
          color: var(--color-muted);
        }
        .brain-dump-context-icon { font-size: 1rem; flex-shrink: 0; }
        .brain-dump-context-banner strong { color: var(--color-text); font-weight: 700; }

        /* AI badge row */
        .ai-badge-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: -4px;
        }

        .step-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 8px;
        }

        .timer-done-hint {
          font-size: 0.85rem;
          color: var(--color-accent);
          font-weight: 500;
          margin: 0;
        }

        .step-privacy-note {
          font-size: 0.8rem;
          color: var(--color-muted);
          opacity: 0.7;
          margin-top: 4px;
        }

        /* Brain dump textarea */
        .brain-dump-textarea {
          min-height: 220px;
          font-size: 1rem;
          line-height: 1.8;
          margin-top: 4px;
        }

        /* Priority grid */
        .priority-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 8px;
        }

        .priority-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 18px;
          text-align: left;
          font-family: var(--font-body);
          cursor: pointer;
          border: 1.5px solid var(--color-border);
        }

        .priority-emoji { font-size: 1.4rem; margin-bottom: 4px; }
        .priority-label { font-weight: 700; font-size: 1rem; color: var(--color-text); }
        .priority-desc  { font-size: 0.8rem; color: var(--color-muted); }

        .custom-task-toggle {
          background: transparent;
          border: 1.5px dashed var(--color-border-dark);
          border-radius: var(--radius-md);
          padding: 12px 16px;
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-muted);
          cursor: pointer;
          text-align: left;
          transition: all var(--transition-fast);
          width: 100%;
        }

        .custom-task-toggle:hover {
          border-color: var(--color-accent);
          color: var(--color-accent);
        }

        .custom-task-toggle-active {
          border-color: var(--color-accent);
          color: var(--color-accent);
          background: rgba(232, 93, 38, 0.04);
        }

        /* Entry task list */
        .entry-task-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 8px;
        }

        .entry-task-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          text-align: left;
          font-family: var(--font-body);
          cursor: pointer;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg);
          transition: all var(--transition-fast);
          width: 100%;
        }

        .entry-task-number {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--color-muted);
          flex-shrink: 0;
          width: 24px;
        }

        .entry-task-text {
          font-size: 0.9375rem;
          color: var(--color-text);
          line-height: 1.5;
        }

        /* Focus step */
        .step-view-focus .step-content {
          max-width: 100%;
          align-items: center;
        }

        /* Reset footer */
        .reset-footer {
          padding: 16px 24px;
          border-top: 1px solid var(--color-border);
          display: flex;
          justify-content: flex-start;
        }

        /* Mobile overrides */
        @media (max-width: 640px) {
          .step-corner-timer {
            position: relative;
            top: auto;
            right: auto;
            align-self: flex-end;
            margin-bottom: 8px;
          }
          .step-view {
            display: flex;
            flex-direction: column-reverse;
          }
          .priority-grid {
            grid-template-columns: 1fr;
          }
          .reset-container {
            padding-top: 24px;
          }
        }
      `}</style>
    </div>
  )
}
