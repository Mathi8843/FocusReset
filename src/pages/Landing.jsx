import { Link } from 'react-router-dom'

/* Feature list data */
const FEATURES = [
  {
    step: '01',
    title: 'Brain Dump',
    desc: 'Flush out every lingering thought from the meeting. Private, never saved.',
    icon: '🧠',
  },
  {
    step: '02',
    title: 'Priority Reset',
    desc: 'Identify the single most important thing for the next 90 minutes.',
    icon: '🎯',
  },
  {
    step: '03',
    title: 'Entry Task',
    desc: 'Pick a tiny micro-task that eases you into your chosen priority.',
    icon: '🚪',
  },
  {
    step: '04',
    title: 'Focus Timer',
    desc: '25 minutes of uninterrupted deep work. Celebrate when you\'re done.',
    icon: '⏱',
  },
]

/* Social proof / stat items */
const STATS = [
  { value: '40 min', label: 'Lost after every meeting' },
  { value: '7 hrs',  label: 'Wasted per week' },
  { value: '10 min', label: 'To reclaim your focus' },
]

export default function Landing() {
  return (
    <div className="landing-page">

      {/* ============================================================
          HERO SECTION
          ============================================================ */}
      <section className="landing-hero" aria-labelledby="hero-heading">
        <div className="container">
          <div className="hero-inner">
            {/* Pre-headline badge */}
            <span className="badge badge-accent hero-badge">No signup required</span>

            <h1 id="hero-heading" className="hero-heading">
              Your brain is still<br />
              <em className="display-italic text-accent">in the meeting.</em>
            </h1>

            <p className="hero-subheadline">
              FocusReset is a 10-minute protocol that gets you back in deep work
              after any meeting — without the 40-minute hangover.
            </p>

            <div className="hero-actions">
              <Link to="/reset">
                <button id="hero-cta-btn" className="btn btn-primary btn-lg">
                  Start Your Reset →
                </button>
              </Link>
              <Link to="/dashboard" className="btn btn-ghost btn-lg">
                View Dashboard
              </Link>
            </div>

            {/* Quick trust signal */}
            <p className="hero-note">
              Takes 10 minutes · Works immediately · Completely free
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          STATS BAR
          ============================================================ */}
      <section className="landing-stats-bar" aria-label="Key statistics">
        <div className="container-wide">
          <div className="stats-grid">
            {STATS.map((stat, i) => (
              <div key={i} className="stat-item">
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          PROBLEM SECTION
          ============================================================ */}
      <section className="landing-section" aria-labelledby="problem-heading">
        <div className="container">
          <div className="problem-wrapper">
            <span className="badge badge-accent">The Problem</span>
            <h2 id="problem-heading" className="section-heading">
              Meeting hangover is real —<br />
              <em className="display-italic">and nobody talks about it.</em>
            </h2>
            <p className="section-body">
              After every meeting, your brain stays in "social mode" — replaying decisions,
              worrying about follow-ups, unable to switch to deep work. The average knowledge
              worker loses <strong>40 minutes of productive time</strong> after every meeting.
              That's 7 hours a week. 350 hours a year.
            </p>
            <div className="problem-callout card">
              <span className="problem-callout-icon">💡</span>
              <p>
                "The average knowledge worker loses 40 minutes after every meeting.
                That's <strong>7 hours a week</strong> — almost an entire workday."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          HOW IT WORKS — 4 steps
          ============================================================ */}
      <section className="landing-section landing-features" aria-labelledby="features-heading">
        <div className="container">
          <div className="text-center" style={{ marginBottom: 48 }}>
            <span className="badge badge-accent">How it works</span>
            <h2 id="features-heading" className="section-heading" style={{ marginTop: 12 }}>
              Four steps. Ten minutes.<br />
              <em className="display-italic">Back in flow.</em>
            </h2>
          </div>

          <div className="features-grid">
            {FEATURES.map((feature, i) => (
              <div key={i} className="feature-card card">
                <div className="feature-card-top">
                  <span className="feature-step mono">{feature.step}</span>
                  <span className="feature-icon" role="img" aria-label={feature.title}>
                    {feature.icon}
                  </span>
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-desc">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          CTA SECTION
          ============================================================ */}
      <section className="landing-cta-section" aria-labelledby="cta-heading">
        <div className="container">
          <div className="cta-inner">
            <h2 id="cta-heading" className="cta-heading">
              Ready to reclaim<br />
              <em className="display-italic">your focus?</em>
            </h2>
            <p className="cta-sub">
              No account. No app. Just open it right after your next meeting.
            </p>
            <Link to="/reset">
              <button id="cta-bottom-btn" className="btn btn-primary btn-lg">
                Start Your Reset — It's Free →
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Simple footer */}
      <footer className="landing-footer">
        <div className="container">
          <span className="landing-footer-logo">FocusReset</span>
          <span className="landing-footer-tagline">Built for knowledge workers who value their time.</span>
        </div>
      </footer>

      <style>{`
        .landing-page {
          width: 100%;
        }

        /* --- Hero --- */
        .landing-hero {
          padding: 80px 0 72px;
          border-bottom: 1px solid var(--color-border);
        }

        .hero-inner {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 20px;
          max-width: 640px;
        }

        .hero-badge { margin-bottom: 4px; }

        .hero-heading {
          font-size: clamp(2.5rem, 6vw, 4rem);
          line-height: 1.08;
          letter-spacing: -0.025em;
        }

        .hero-subheadline {
          font-size: clamp(1rem, 2.5vw, 1.2rem);
          color: var(--color-muted);
          max-width: 520px;
          line-height: 1.65;
        }

        .hero-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 8px;
        }

        .hero-note {
          font-size: 0.8rem;
          color: var(--color-muted);
          opacity: 0.7;
          margin: 0;
        }

        /* --- Stats bar --- */
        .landing-stats-bar {
          background: var(--color-bg-card);
          border-bottom: 1px solid var(--color-border);
          padding: 36px 0;
        }

        .stats-grid {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          flex-wrap: wrap;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px 48px;
          border-right: 1px solid var(--color-border);
        }

        .stat-item:last-child { border-right: none; }

        .stat-value {
          font-family: var(--font-display);
          font-size: clamp(2rem, 4vw, 2.75rem);
          font-weight: 400;
          color: var(--color-accent);
          letter-spacing: -0.02em;
        }

        .stat-label {
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-muted);
        }

        /* --- Sections --- */
        .landing-section {
          padding: 80px 0;
          border-bottom: 1px solid var(--color-border);
        }

        .section-heading {
          font-size: clamp(1.75rem, 4vw, 2.5rem);
          margin-top: 12px;
          line-height: 1.15;
        }

        .section-body {
          font-size: 1.0625rem;
          color: var(--color-muted);
          line-height: 1.7;
          max-width: 560px;
          margin-top: 16px;
        }

        .section-body strong {
          color: var(--color-text);
          font-weight: 700;
        }

        .problem-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .problem-callout {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-top: 32px;
          padding: 24px;
          border-left: 3px solid var(--color-accent);
        }

        .problem-callout-icon { font-size: 1.5rem; flex-shrink: 0; }

        .problem-callout p {
          font-size: 1rem;
          color: var(--color-muted);
          font-style: italic;
          line-height: 1.6;
          margin: 0;
        }

        .problem-callout p strong { color: var(--color-text); font-style: normal; }

        /* --- Features --- */
        .landing-features { background: var(--color-bg-card); }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .feature-card {
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .feature-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .feature-step {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-muted);
          letter-spacing: 0.08em;
        }

        .feature-icon { font-size: 1.6rem; }

        .feature-title {
          font-size: 1.2rem;
          color: var(--color-text);
          margin: 0;
        }

        .feature-desc {
          font-size: 0.9rem;
          color: var(--color-muted);
          line-height: 1.6;
          margin: 0;
        }

        /* --- CTA Section --- */
        .landing-cta-section {
          padding: 96px 0;
        }

        .cta-inner {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 20px;
          max-width: 560px;
        }

        .cta-heading {
          font-size: clamp(2rem, 5vw, 3rem);
          line-height: 1.1;
        }

        .cta-sub {
          font-size: 1.0625rem;
          color: var(--color-muted);
          margin: 0;
        }

        /* --- Footer --- */
        .landing-footer {
          border-top: 1px solid var(--color-border);
          padding: 28px 0;
        }

        .landing-footer .container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }

        .landing-footer-logo {
          font-family: var(--font-display);
          font-size: 1.1rem;
          color: var(--color-text);
        }

        .landing-footer-tagline {
          font-size: 0.8rem;
          color: var(--color-muted);
        }

        /* --- Mobile --- */
        @media (max-width: 640px) {
          .landing-hero { padding: 56px 0 52px; }
          .hero-heading { font-size: 2.25rem; }
          .hero-actions { flex-direction: column; }
          .hero-actions .btn { width: 100%; justify-content: center; }
          .features-grid { grid-template-columns: 1fr; }
          .stats-grid { flex-direction: column; }
          .stat-item { border-right: none; border-bottom: 1px solid var(--color-border); width: 100%; padding: 16px 0; }
          .stat-item:last-child { border-bottom: none; }
          .landing-section { padding: 56px 0; }
          .landing-cta-section { padding: 64px 0; }
        }
      `}</style>
    </div>
  )
}
