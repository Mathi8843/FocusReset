/**
 * MeetingTypeSelector — Pre-reset screen for choosing meeting type.
 *
 * Props:
 *  selected   — currently selected meeting type string
 *  onSelect   — callback(type: string)
 *  onContinue — called when user is ready to proceed
 */

const MEETING_TYPES = [
  { id: 'standup',  label: 'Team Standup',  emoji: '☀️', desc: 'Daily sync with the team' },
  { id: 'one-on-one', label: '1-on-1',     emoji: '💬', desc: 'One-to-one conversation' },
  { id: 'client',   label: 'Client Call',  emoji: '📞', desc: 'External client meeting' },
  { id: 'allhands', label: 'All-Hands',    emoji: '🏛️', desc: 'Company-wide meeting' },
  { id: 'other',    label: 'Other',        emoji: '📋', desc: 'Another type of meeting' },
]

export default function MeetingTypeSelector({ selected, onSelect, onContinue }) {
  return (
    <div className="mts-wrapper animate-fade-in">
      <div className="mts-header">
        <span className="badge badge-accent">Before we start</span>
        <h2 className="mts-title">What kind of meeting did you just come from?</h2>
        <p className="mts-subtitle">This helps us track which meetings drain you the most.</p>
      </div>

      <div className="mts-grid">
        {MEETING_TYPES.map(type => (
          <button
            key={type.id}
            className={`mts-card card-selectable card ${selected === type.id ? 'card-selected' : ''}`}
            onClick={() => onSelect(type.id)}
            aria-pressed={selected === type.id}
          >
            <span className="mts-emoji" role="img" aria-label={type.label}>{type.emoji}</span>
            <span className="mts-card-label">{type.label}</span>
            <span className="mts-card-desc">{type.desc}</span>
          </button>
        ))}
      </div>

      <button
        className="btn btn-primary btn-lg w-full"
        onClick={onContinue}
        disabled={!selected}
      >
        Start My Reset →
      </button>

      <style>{`
        .mts-wrapper {
          width: 100%;
        }

        .mts-header {
          margin-bottom: 32px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .mts-title {
          font-size: clamp(1.5rem, 4vw, 2rem);
          margin-top: 4px;
        }

        .mts-subtitle {
          font-size: 1rem;
          color: var(--color-muted);
        }

        .mts-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 32px;
        }

        /* 5th card (Other) spans full width */
        .mts-grid > :nth-child(5) {
          grid-column: 1 / -1;
        }

        .mts-card {
          background: var(--color-bg-card);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          text-align: left;
          cursor: pointer;
          transition: all var(--transition-fast);
          font-family: var(--font-body);
        }

        .mts-emoji {
          font-size: 1.5rem;
          margin-bottom: 4px;
        }

        .mts-card-label {
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-text);
        }

        .mts-card-desc {
          font-size: 0.8rem;
          color: var(--color-muted);
          line-height: 1.4;
        }

        @media (max-width: 480px) {
          .mts-grid {
            grid-template-columns: 1fr;
          }
          .mts-grid > :nth-child(5) {
            grid-column: 1;
          }
        }
      `}</style>
    </div>
  )
}
