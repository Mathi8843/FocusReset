import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getSessions, getProfile } from '../utils/storage.js'
import {
  getThisWeekSessions, getLastWeekSessions, getStreak, getAverageRecoveryTime,
  getTotalFocusMinutes, getMeetingTypeDrainRanking, getSessionsPerDay,
  getAverageHangoverScore, getHighHangoverSessions,
  getTrend, formatDuration, formatRelativeDate, formatTime, getGreeting,
} from '../utils/calculations.js'

import IntegrationCard from '../components/IntegrationCard.jsx'
import WeeklyReport from '../components/WeeklyReport.jsx'
import {
  connectGithub,
  disconnectGithub,
  syncGithubData,
  getStoredGithubData,
  getGithubSummary
} from '../services/githubService.js'
import {
  connectNotion,
  disconnectNotion,
  syncNotionData,
  getStoredNotionData,
  getNotionSummary
} from '../services/notionService.js'
import {
  connectJira,
  disconnectJira,
  syncJiraData,
  getStoredJiraData,
  getJiraSummary,
  jiraPriorityIcon
} from '../services/jiraService.js'
import {
  connectCalendar,
  disconnectCalendar,
  syncCalendarData,
  getStoredCalendarData,
  getStoredMeetings,
  getCalendarSummary,
  isCalendarConnected,
} from '../services/calendarService.js'
import {
  connectLinear,
  disconnectLinear,
  syncLinearData,
  getStoredLinearData,
  getLinearSummary,
  linearPriorityIcon,
} from '../services/linearService.js'
import {
  connectOutlook,
  disconnectOutlook,
  syncOutlookData,
  getStoredOutlookData,
  getStoredMeetings as getStoredOutlookMeetings,
  isOutlookConnected,
} from '../services/outlookService.js'

const MEETING_LABELS = {
  standup: 'Team Standup', 'one-on-one': '1-on-1',
  client: 'Client Call', allhands: 'All-Hands', other: 'Other',
}
const MEETING_EMOJIS = {
  standup: '☀️', 'one-on-one': '💬', client: '📞', allhands: '🏛️', other: '📋',
}

/* ---- Empty state SVG illustration ---- */
function EmptyIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <rect x="8" y="16" width="64" height="56" rx="6" fill="#fdfaf5" stroke="#d4c9b8" strokeWidth="2"/>
      <rect x="8" y="16" width="64" height="14" rx="6" fill="#e8e0d4" stroke="#d4c9b8" strokeWidth="2"/>
      <rect x="20" y="8" width="6" height="16" rx="3" fill="#b8a99a"/>
      <rect x="54" y="8" width="6" height="16" rx="3" fill="#b8a99a"/>
      <circle cx="54" cy="54" r="16" fill="#fff7f3" stroke="#e85d26" strokeWidth="2"/>
      <path d="M54 46v10l6 3" stroke="#e85d26" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

/* ---- Trend arrow ---- */
function TrendArrow({ thisVal, lastVal }) {
  const { direction, delta } = getTrend(thisVal, lastVal)
  if (direction === 'flat' || delta === 0) return null
  const up = direction === 'up'
  return (
    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: up ? 'var(--color-success)' : '#c44d1e', display: 'flex', alignItems: 'center', gap: 2 }}>
      {up ? '↑' : '↓'} {delta} vs last week
    </span>
  )
}

/* ---- Stat card ---- */
function StatCard({ icon, value, label, sub, trend, accent }) {
  return (
    <div className="db-stat card">
      <div className="db-stat-top">
        <span className="db-stat-icon">{icon}</span>
        <span className={`db-stat-value${accent ? ' text-accent' : ''}`}>{value}</span>
      </div>
      <span className="db-stat-label">{label}</span>
      <div className="db-stat-footer">
        <span className="db-stat-sub">{sub}</span>
        {trend}
      </div>
    </div>
  )
}

/* ---- Bar chart tooltip ---- */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="db-tooltip">
      <strong>{label}</strong>
      <span>{d.count} session{d.count !== 1 ? 's' : ''}</span>
      {d.focusMin > 0 && <span>{d.focusMin} min recovered</span>}
    </div>
  )
}

/* ---- Step completion dots ---- */
function StepDots({ stepsReached }) {
  return (
    <div className="db-step-dots" aria-label={`${stepsReached} of 4 steps completed`}>
      {[1, 2, 3, 4].map(n => (
        <span key={n} className={`db-dot${n <= stepsReached ? ' db-dot-filled' : ''}`} />
      ))}
    </div>
  )
}

/* ---- Meeting type breakdown bars (CSS only) ---- */
function MeetingBreakdown({ sessions }) {
  const [tab, setTab] = useState('frequency')
  const ranking = getMeetingTypeDrainRanking(sessions)
  if (!ranking.length) return <p className="db-empty-inline">No meeting data yet.</p>

  const sorted = tab === 'frequency'
    ? [...ranking].sort((a, b) => b.count - a.count)
    : [...ranking].sort((a, b) => b.avgDrain - a.avgDrain)

  const max = Math.max(...sorted.map(r => tab === 'frequency' ? r.count : r.avgDrain), 1)

  return (
    <div>
      <div className="db-tabs">
        <button className={`db-tab${tab === 'frequency' ? ' db-tab-active' : ''}`} onClick={() => setTab('frequency')}>By Frequency</button>
        <button className={`db-tab${tab === 'drain' ? ' db-tab-active' : ''}`} onClick={() => setTab('drain')}>By Drain Level</button>
      </div>
      <div className="db-breakdown-list">
        {sorted.map(r => {
          const val = tab === 'frequency' ? r.count : r.avgDrain
          const pct = Math.round((val / max) * 100)
          const label = MEETING_LABELS[r.type] || r.type
          const emoji = MEETING_EMOJIS[r.type] || '📋'
          return (
            <div key={r.type} className="db-breakdown-row">
              <div className="db-breakdown-label">
                <span>{emoji} {label}</span>
                <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                  {tab === 'frequency' ? `${r.count} session${r.count !== 1 ? 's' : ''}` : formatDuration(r.avgDrain)}
                  {r.avgHangoverScore !== null ? ` · ${r.avgHangoverScore}/100` : ''}
                </span>
              </div>
              <div className="db-breakdown-track">
                <div className="db-breakdown-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---- Recent sessions row ---- */
function SessionRow({ session, alt }) {
  const stepsReached = session.completed ? 4 : session.stepTimings ? Object.keys(session.stepTimings).length : 1
  const focusMin = session.stepTimings?.focusTimer ? Math.round(session.stepTimings.focusTimer / 60) : 0
  return (
    <div className={`db-session-row${alt ? ' db-session-row-alt' : ''}`}>
      <div className="db-session-left">
        <div className="db-session-info">
          <span className="db-session-task">{session.priorityTask || 'Unnamed task'}</span>
          <span className="db-session-when">
            {formatRelativeDate(session.date)}, {formatTime(session.date)}
          </span>
        </div>
      </div>
      <div className="db-session-right">
        <span className={`badge ${session.completed ? 'badge-success' : 'badge-accent'}`} style={{ fontSize: '0.65rem' }}>
          {MEETING_LABELS[session.meetingType] || 'Meeting'}
        </span>
        {session.hangoverScore && (
          <span className={`badge db-score-badge db-score-${session.hangoverScore.tone}`} style={{ fontSize: '0.65rem' }}>
            {session.hangoverScore.score}/100
          </span>
        )}
        <StepDots stepsReached={stepsReached} />
        <span className="db-session-focus mono">
          {focusMin > 0 ? `${focusMin}m ${session.completed ? '✓' : '—'}` : '—'}
        </span>
      </div>
    </div>
  )
}

/* ---- Section wrapper with anchor id ---- */
function Section({ id, title, sub, children, action }) {
  return (
    <section id={id} className="db-section">
      <div className="db-section-head">
        <div>
          <h2 className="db-section-title">{title}</h2>
          {sub && <p className="db-section-sub">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/* ================================================================
   DASHBOARD PAGE
================================================================ */
export default function Dashboard() {
  const [sessions] = useState(() => getSessions())
  const [profile] = useState(() => getProfile())

  // Integrations states
  const [githubData, setGithubData] = useState(() => getStoredGithubData())
  const [notionData, setNotionData] = useState(() => getStoredNotionData())
  const [jiraData, setJiraData] = useState(() => getStoredJiraData())
  const [linearData, setLinearData] = useState(() => getStoredLinearData())
  
  // Calendar states
  const [calendarData, setCalendarData] = useState(() => getStoredCalendarData())
  const [meetingsList, setMeetingsList] = useState(() => getStoredMeetings())
  const [calendarSyncStatus, setCalendarSyncStatus] = useState(() => isCalendarConnected() ? 'connected' : 'disconnected')

  const [outlookData, setOutlookData] = useState(() => getStoredOutlookData())
  const [outlookMeetingsList, setOutlookMeetingsList] = useState(() => getStoredOutlookMeetings())
  const [outlookSyncStatus, setOutlookSyncStatus] = useState(() => isOutlookConnected() ? 'connected' : 'disconnected')

  // Jira connection modal states
  const [showJiraModal, setShowJiraModal] = useState(false)
  const [jiraDomain, setJiraDomain] = useState('')
  const [jiraEmail, setJiraEmail] = useState('')
  const [jiraToken, setJiraToken] = useState('')
  const [jiraError, setJiraError] = useState('')
  const [jiraConnecting, setJiraConnecting] = useState(false)

  // Linear connection modal states
  const [showLinearModal, setShowLinearModal] = useState(false)
  const [linearToken, setLinearToken] = useState('')
  const [linearError, setLinearError] = useState('')
  const [linearConnecting, setLinearConnecting] = useState(false)

  // Syncing states
  const [githubSyncStatus, setGithubSyncStatus] = useState(() => getStoredGithubData() ? 'connected' : 'disconnected')
  const [notionSyncStatus, setNotionSyncStatus] = useState(() => getStoredNotionData() ? 'connected' : 'disconnected')
  const [jiraSyncStatus, setJiraSyncStatus] = useState(() => getStoredJiraData() ? 'connected' : 'disconnected')
  const [linearSyncStatus, setLinearSyncStatus] = useState(() => getStoredLinearData() ? 'connected' : 'disconnected')

  // GitHub actions
  const handleConnectGithub = async () => {
    setGithubSyncStatus('connecting')
    try {
      connectGithub()
    } catch (err) {
      console.error(err)
      setGithubSyncStatus('error')
    }
  }

  const handleDisconnectGithub = () => {
    disconnectGithub()
    setGithubData(null)
    setGithubSyncStatus('disconnected')
  }

  const handleSyncGithub = async () => {
    setGithubSyncStatus('connecting')
    try {
      const data = await syncGithubData()
      setGithubData(data)
      setGithubSyncStatus('connected')
    } catch (err) {
      console.error(err)
      setGithubSyncStatus('error')
    }
  }

  // Notion actions
  const handleConnectNotion = async () => {
    setNotionSyncStatus('connecting')
    try {
      connectNotion()
    } catch (err) {
      console.error(err)
      setNotionSyncStatus('error')
    }
  }

  const handleDisconnectNotion = () => {
    disconnectNotion()
    setNotionData(null)
    setNotionSyncStatus('disconnected')
  }

  const handleSyncNotion = async () => {
    setNotionSyncStatus('connecting')
    try {
      const data = await syncNotionData()
      setNotionData(data)
      setNotionSyncStatus('connected')
    } catch (err) {
      console.error(err)
      setNotionSyncStatus('error')
    }
  }

  // Jira actions
  const handleConnectJiraClick = () => {
    setShowJiraModal(true)
    setJiraError('')
  }

  const handleJiraSubmit = async (e) => {
    e.preventDefault()
    if (!jiraDomain || !jiraEmail || !jiraToken) {
      setJiraError('All fields are required.')
      return
    }
    setJiraConnecting(true)
    setJiraError('')
    try {
      const data = await connectJira(jiraDomain, jiraEmail, jiraToken)
      setJiraData(data)
      setJiraSyncStatus('connected')
      setShowJiraModal(false)
      setJiraDomain('')
      setJiraEmail('')
      setJiraToken('')
    } catch (err) {
      console.error(err)
      setJiraError(err.message || 'Failed to connect to Jira.')
    } finally {
      setJiraConnecting(false)
    }
  }

  const handleDisconnectJira = () => {
    disconnectJira()
    setJiraData(null)
    setJiraSyncStatus('disconnected')
  }

  const handleSyncJira = async () => {
    setJiraSyncStatus('connecting')
    try {
      const data = await syncJiraData()
      setJiraData(data)
      setJiraSyncStatus('connected')
    } catch (err) {
      console.error(err)
      setJiraSyncStatus('error')
    }
  }

  // Calendar actions
  const handleConnectCalendar = async () => {
    setCalendarSyncStatus('connecting')
    try {
      const result = await connectCalendar()
      setCalendarData(result.integration)
      setMeetingsList(result.meetings)
      setCalendarSyncStatus('connected')
    } catch (err) {
      console.error(err)
      setCalendarSyncStatus('error')
    }
  }

  const handleDisconnectCalendar = () => {
    disconnectCalendar()
    setCalendarData(null)
    setMeetingsList([])
    setCalendarSyncStatus('disconnected')
  }

  const handleSyncCalendar = async () => {
    setCalendarSyncStatus('connecting')
    try {
      const data = await syncCalendarData()
      setCalendarData(data.integration)
      setMeetingsList(data.meetings)
      setCalendarSyncStatus('connected')
    } catch (err) {
      console.error(err)
      setCalendarSyncStatus('error')
    }
  }

  // Linear actions
  const handleConnectLinearClick = () => {
    setShowLinearModal(true)
    setLinearError('')
  }

  const handleLinearSubmit = async (e) => {
    e.preventDefault()
    if (!linearToken) {
      setLinearError('Linear API token is required.')
      return
    }
    setLinearConnecting(true)
    setLinearError('')
    try {
      const data = await connectLinear(linearToken)
      setLinearData(data)
      setLinearSyncStatus('connected')
      setShowLinearModal(false)
      setLinearToken('')
    } catch (err) {
      console.error(err)
      setLinearError(err.message || 'Failed to connect to Linear.')
    } finally {
      setLinearConnecting(false)
    }
  }

  const handleDisconnectLinear = () => {
    disconnectLinear()
    setLinearData(null)
    setLinearSyncStatus('disconnected')
  }

  const handleSyncLinear = async () => {
    setLinearSyncStatus('connecting')
    try {
      const data = await syncLinearData()
      setLinearData(data)
      setLinearSyncStatus('connected')
    } catch (err) {
      console.error(err)
      setLinearSyncStatus('error')
    }
  }

  // Outlook actions
  const handleConnectOutlook = async () => {
    setOutlookSyncStatus('connecting')
    try {
      connectOutlook()
    } catch (err) {
      console.error(err)
      setOutlookSyncStatus('error')
    }
  }

  const handleDisconnectOutlook = () => {
    disconnectOutlook()
    setOutlookData(null)
    setOutlookMeetingsList([])
    setOutlookSyncStatus('disconnected')
  }

  const handleSyncOutlook = async () => {
    setOutlookSyncStatus('connecting')
    try {
      const result = await syncOutlookData()
      setOutlookData(result.integration)
      setOutlookMeetingsList(result.meetings)
      setOutlookSyncStatus('connected')
    } catch (err) {
      console.error(err)
      setOutlookSyncStatus('error')
    }
  }

  const isEmpty = sessions.length === 0
  const hasEnough = sessions.filter(s => s.completed).length >= 3

  const thisWeek = getThisWeekSessions(sessions)
  const lastWeek = getLastWeekSessions(sessions)
  const streak = getStreak(sessions)
  const avgRecoverySecs = getAverageRecoveryTime(sessions)
  const avgHangoverScore = getAverageHangoverScore(sessions)
  const highHangoverSessions = getHighHangoverSessions(thisWeek)
  const focusMinThisWeek = getTotalFocusMinutes(thisWeek)
  const focusMinLastWeek = getTotalFocusMinutes(lastWeek)
  const chartData = getSessionsPerDay(sessions)
  const maxBar = Math.max(...chartData.map(d => d.count), 1)

  return (
    <div className="db-page">
      {/* ---- Sticky sub-nav ---- */}
      {!isEmpty && (
        <nav className="db-subnav" aria-label="Dashboard sections">
          <div className="container-wide">
            <div className="db-subnav-inner">
              {[
                ['this-week', 'This Week'],
                ['sessions-chart', 'Sessions'],
                ['meeting-types', 'Meeting Types'],
                ['recent-sessions', 'Recent'],
                ['ai-report', 'AI Report'],
                ['integrations', 'Integrations'],
                ['calendar-connect', 'Calendar']
              ].map(([id, label]) => (
                <a key={id} href={`#${id}`} className="db-subnav-link">{label}</a>
              ))}
            </div>
          </div>
        </nav>
      )}

      <div className="container-wide db-body">
        {/* ---- Header ---- */}
        <div className="db-header">
          <div>
            <h1 className="db-greeting">
              {getGreeting()}{profile?.name ? `, ${profile.name}` : ''}.
            </h1>
            <p className="db-header-sub">Here's your focus picture this week.</p>
          </div>
          <Link to="/reset">
            <button id="dash-start-reset-btn" className="btn btn-primary">Start Reset →</button>
          </Link>
        </div>

        {/* ================================================================
            EMPTY STATE
        ================================================================ */}
        {isEmpty ? (
          <div className="db-empty animate-fade-in">
            <EmptyIllustration />
            <h2 className="db-empty-title">No sessions yet</h2>
            <p className="db-empty-desc">Complete your first reset to start seeing your focus data here.</p>
            <Link to="/reset">
              <button id="dash-empty-cta" className="btn btn-primary btn-lg">Start Your First Reset →</button>
            </Link>
          </div>
        ) : (
          <>
            {/* ================================================================
                SECTION 1 — This Week at a Glance
            ================================================================ */}
            <Section id="this-week" title="This Week at a Glance" sub="Compared to last week">
              <div className="db-stats-grid animate-fade-in">
                <StatCard
                  icon="🗓️"
                  value={thisWeek.length}
                  label="Sessions Completed"
                  sub="This week"
                  accent
                  trend={<TrendArrow thisVal={thisWeek.length} lastVal={lastWeek.length} />}
                />
                <StatCard
                  icon="⏱"
                  value={`${focusMinThisWeek}m`}
                  label="Focus Minutes Recovered"
                  sub="This week"
                  trend={<TrendArrow thisVal={focusMinThisWeek} lastVal={focusMinLastWeek} />}
                />
                <StatCard
                  icon="🔥"
                  value={streak}
                  label="Day Streak"
                  sub={streak > 1 ? 'On a roll!' : streak === 1 ? 'Keep it up!' : 'Start today'}
                  accent={streak > 0}
                />
                <StatCard
                  icon="⚡"
                  value={avgRecoverySecs !== null ? formatDuration(avgRecoverySecs) : '—'}
                  label="Avg Recovery Time"
                  sub="Steps 1–3 combined"
                />
                <StatCard
                  icon="!"
                  value={avgHangoverScore !== null ? `${avgHangoverScore}` : '---'}
                  label="Avg Hangover Score"
                  sub={`${highHangoverSessions} high-risk this week`}
                  accent={avgHangoverScore >= 75}
                />
              </div>
            </Section>

            {/* ================================================================
                SECTION 2 — Bar Chart
            ================================================================ */}
            <Section
              id="sessions-chart"
              title="Sessions This Week"
              sub={!hasEnough ? `Add ${3 - sessions.filter(s => s.completed).length} more sessions to see your full chart.` : 'Daily reset completions, Mon–Sun'}
            >
              <div className="card db-chart-card animate-fade-in">
                {!hasEnough && sessions.filter(s => s.completed).length < 3 ? (
                  <div className="db-chart-placeholder">
                    <span style={{ fontSize: '2rem' }}>📈</span>
                    <p>Add {3 - sessions.filter(s => s.completed).length} more session{3 - sessions.filter(s => s.completed).length !== 1 ? 's' : ''} to see your weekly chart.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontFamily: 'Syne,sans-serif', fontSize: 12, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(212,201,184,0.25)' }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, i) => (
                          <Cell key={i} fill={
                            entry.isToday ? 'var(--color-accent)' :
                            entry.count === maxBar && entry.count > 0 ? 'rgba(232,93,38,0.6)' :
                            entry.count > 0 ? 'rgba(232,93,38,0.3)' : 'var(--color-border)'
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Section>

            {/* ================================================================
                SECTION 3 — Meeting Type Breakdown
            ================================================================ */}
            <Section id="meeting-types" title="Meeting Type Breakdown" sub="Which meetings cost you the most recovery time">
              <div className="card animate-fade-in">
                <MeetingBreakdown sessions={sessions} />
              </div>
            </Section>

            {/* ================================================================
                SECTION 4 — Recent Sessions
            ================================================================ */}
            <Section id="recent-sessions" title="Recent Sessions" sub={`Your last ${Math.min(sessions.length, 10)} resets`}>
              <div className="db-sessions-card card animate-fade-in">
                {[...sessions].reverse().slice(0, 10).map((s, i) => (
                  <div key={s.id}>
                    <SessionRow session={s} alt={i % 2 === 1} />
                    {i < Math.min(sessions.length, 10) - 1 && <div className="db-row-divider" />}
                  </div>
                ))}
              </div>
            </Section>

            {/* ================================================================
                SECTION 5 — AI Weekly Report
            ================================================================ */}
            <Section id="ai-report" title="AI Weekly Report" sub="Personalized insights powered by Grok">
              <WeeklyReport sessions={sessions} />
            </Section>

            {/* ================================================================
                SECTION 6 — Integrations (Jira, GitHub, Notion)
            ================================================================ */}
            <Section id="integrations" title="Integrations" sub="Personalize your recovery session with context from your daily tools">
              <div className="db-integrations-grid animate-fade-in">
                {/* GitHub Card */}
                <IntegrationCard
                  id="github"
                  name="GitHub"
                  description="Recent repos and open pull requests"
                  icon="💻"
                  status={githubSyncStatus}
                  connectedAs={githubData?.username}
                  summary={getGithubSummary(githubData)}
                  syncedAt={githubData?.syncedAt}
                  onConnect={handleConnectGithub}
                  onDisconnect={handleDisconnectGithub}
                  onSync={handleSyncGithub}
                >
                  {githubData?.repos?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {githubData.repos.map(repo => {
                        if (!repo.openPRs || repo.openPRs.length === 0) return null
                        return (
                          <div key={repo.fullName} style={{ fontSize: '0.8rem' }}>
                            <strong style={{ display: 'block', color: 'var(--color-text)', marginBottom: '4px' }}>
                              📁 {repo.fullName}
                            </strong>
                            <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--color-muted)', listStyleType: 'disc' }}>
                              {repo.openPRs.map(pr => (
                                <li key={pr.number} style={{ marginBottom: '2px' }}>
                                  #{pr.number} - {pr.title} {pr.isDraft && <span className="badge badge-accent" style={{ fontSize: '0.6rem', padding: '2px 4px', marginLeft: '4px' }}>Draft</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                      {githubData.repos.every(r => !r.openPRs || r.openPRs.length === 0) && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>No open PRs found in recent repos.</span>
                      )}
                    </div>
                  )}
                </IntegrationCard>

                {/* Jira Card */}
                <IntegrationCard
                  id="jira"
                  name="Jira Cloud"
                  description="Tracks open issues assigned to you"
                  icon="📋"
                  status={jiraSyncStatus}
                  connectedAs={jiraData?.displayName || jiraData?.email}
                  summary={getJiraSummary(jiraData)}
                  syncedAt={jiraData?.syncedAt}
                  onConnect={handleConnectJiraClick}
                  onDisconnect={handleDisconnectJira}
                  onSync={handleSyncJira}
                >
                  {jiraData?.tickets?.length > 0 ? (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {jiraData.tickets.map(ticket => (
                        <li key={ticket.key} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            <strong>{ticket.key}</strong>: {ticket.summary}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            {jiraPriorityIcon(ticket.priority)}
                            <span className="badge badge-ghost" style={{ fontSize: '0.65rem', padding: '2px 4px' }}>{ticket.status}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : jiraData ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>No open tickets assigned to you updated in the last 7 days.</span>
                  ) : null}
                </IntegrationCard>

                {/* Notion Card */}
                <IntegrationCard
                  id="notion"
                  name="Notion"
                  description="Accesses recently edited pages"
                  icon="📓"
                  status={notionSyncStatus}
                  connectedAs={notionData?.workspaceName}
                  summary={getNotionSummary(notionData)}
                  syncedAt={notionData?.syncedAt}
                  onConnect={handleConnectNotion}
                  onDisconnect={handleDisconnectNotion}
                  onSync={handleSyncNotion}
                >
                  {notionData?.recentPages?.length > 0 ? (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {notionData.recentPages.map(page => (
                        <li key={page.id} style={{ fontSize: '0.8rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          📄 <a href={page.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, textDecoration: 'underline' }}>{page.title}</a>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', marginLeft: '6px' }}>
                            (edited {formatRelativeDate(page.lastEdited)})
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : notionData ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>No recent pages found.</span>
                  ) : null}
                </IntegrationCard>

                {/* Linear Card */}
                <IntegrationCard
                  id="linear"
                  name="Linear"
                  description="Tracks open issues assigned to you"
                  icon="📐"
                  status={linearSyncStatus}
                  connectedAs={linearData?.displayName || linearData?.email}
                  summary={getLinearSummary(linearData)}
                  syncedAt={linearData?.syncedAt}
                  onConnect={handleConnectLinearClick}
                  onDisconnect={handleDisconnectLinear}
                  onSync={handleSyncLinear}
                >
                  {linearData?.issues?.length > 0 ? (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {linearData.issues.map(issue => (
                        <li key={issue.id} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            <strong>{issue.key}</strong>: {issue.summary}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            {linearPriorityIcon(issue.priority)}
                            <span className="badge badge-ghost" style={{ fontSize: '0.65rem', padding: '2px 4px' }}>{issue.status}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : linearData ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>No active issues assigned to you.</span>
                  ) : null}
                </IntegrationCard>
              </div>
            </Section>

            {/* ================================================================
                SECTION 7 — Calendar Connection
            ================================================================ */}
            <Section id="calendar-connect" title="Calendar Connection" sub="Auto-detect when your meetings end">
              <div className="db-integrations-grid animate-fade-in">
                {/* Google Calendar Card */}
                <IntegrationCard
                  id="google"
                  name="Google Calendar"
                  description="Auto-detect today's meetings"
                  icon="📅"
                  status={calendarSyncStatus}
                  connectedAs={calendarData?.email}
                  summary={getCalendarSummary(meetingsList)}
                  syncedAt={calendarData?.syncedAt}
                  onConnect={handleConnectCalendar}
                  onDisconnect={handleDisconnectCalendar}
                  onSync={handleSyncCalendar}
                >
                  {meetingsList && meetingsList.length > 0 ? (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {meetingsList.map(meeting => (
                        <li key={meeting.id} style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {meeting.summary}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                              {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                            </span>
                          </div>
                          <span className="badge badge-accent" style={{ fontSize: '0.7rem', padding: '2px 6px', flexShrink: 0 }}>
                            {MEETING_LABELS[meeting.meetingType] || 'Meeting'}
                          </span>
                          {meeting.hangoverScore && (
                            <span className={`badge db-score-badge db-score-${meeting.hangoverScore.tone}`} style={{ fontSize: '0.7rem', padding: '2px 6px', flexShrink: 0 }}>
                              {meeting.hangoverScore.score}/100
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : meetingsList ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>No meetings scheduled for today.</span>
                  ) : null}
                </IntegrationCard>

                {/* Outlook Calendar Card */}
                <IntegrationCard
                  id="outlook"
                  name="Outlook Calendar"
                  description="Auto-detect today's meetings"
                  icon="📅"
                  status={outlookSyncStatus}
                  connectedAs={outlookData?.email}
                  summary={getCalendarSummary(outlookMeetingsList)}
                  syncedAt={outlookData?.syncedAt}
                  onConnect={handleConnectOutlook}
                  onDisconnect={handleDisconnectOutlook}
                  onSync={handleSyncOutlook}
                >
                  {outlookMeetingsList && outlookMeetingsList.length > 0 ? (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {outlookMeetingsList.map(meeting => (
                        <li key={meeting.id} style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {meeting.summary}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                              {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                            </span>
                          </div>
                          <span className="badge badge-accent" style={{ fontSize: '0.7rem', padding: '2px 6px', flexShrink: 0 }}>
                            {MEETING_LABELS[meeting.meetingType] || 'Meeting'}
                          </span>
                          {meeting.hangoverScore && (
                            <span className={`badge db-score-badge db-score-${meeting.hangoverScore.tone}`} style={{ fontSize: '0.7rem', padding: '2px 6px', flexShrink: 0 }}>
                              {meeting.hangoverScore.score}/100
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : outlookMeetingsList ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>No meetings scheduled for today.</span>
                  ) : null}
                </IntegrationCard>
              </div>
            </Section>
          </>
        )}
      </div>

      {/* Jira Connection Modal */}
      {showJiraModal && (
        <div className="modal-overlay">
          <div className="modal-content card animate-fade-in">
            <div className="modal-header">
              <h3>Connect Jira Cloud</h3>
              <button className="btn-close" onClick={() => setShowJiraModal(false)} aria-label="Close modal">×</button>
            </div>
            <form onSubmit={handleJiraSubmit} className="modal-body">
              <div className="form-group">
                <label htmlFor="jira-domain">Jira Site Domain</label>
                <input
                  id="jira-domain"
                  type="text"
                  placeholder="mycompany.atlassian.net"
                  value={jiraDomain}
                  onChange={(e) => setJiraDomain(e.target.value)}
                  required
                />
                <span className="input-hint">No "https://", e.g., company.atlassian.net</span>
              </div>
              <div className="form-group">
                <label htmlFor="jira-email">Atlassian Email</label>
                <input
                  id="jira-email"
                  type="email"
                  placeholder="you@company.com"
                  value={jiraEmail}
                  onChange={(e) => setJiraEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="jira-token">API Token</label>
                <input
                  id="jira-token"
                  type="password"
                  placeholder="Paste Atlassian API Token"
                  value={jiraToken}
                  onChange={(e) => setJiraToken(e.target.value)}
                  required
                />
                <span className="input-hint">
                  Create one at <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer">Atlassian API Tokens</a>
                </span>
              </div>
              {jiraError && <div className="modal-error">⚠ {jiraError}</div>}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowJiraModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={jiraConnecting}>
                  {jiraConnecting ? 'Connecting...' : 'Connect Jira'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Linear Connection Modal */}
      {showLinearModal && (
        <div className="modal-overlay">
          <div className="modal-content card animate-fade-in">
            <div className="modal-header">
              <h3>Connect Linear</h3>
              <button className="btn-close" onClick={() => setShowLinearModal(false)} aria-label="Close modal">×</button>
            </div>
            <form onSubmit={handleLinearSubmit} className="modal-body">
              <div className="form-group">
                <label htmlFor="linear-token">Personal API Token</label>
                <input
                  id="linear-token"
                  type="password"
                  placeholder="Paste Linear Personal API Token"
                  value={linearToken}
                  onChange={(e) => setLinearToken(e.target.value)}
                  required
                />
                <span className="input-hint">
                  Create one at <a href="https://linear.app/settings/api" target="_blank" rel="noopener noreferrer">Linear API Settings</a>
                </span>
              </div>
              {linearError && <div className="modal-error">⚠ {linearError}</div>}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowLinearModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={linearConnecting}>
                  {linearConnecting ? 'Connecting...' : 'Connect Linear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        /* Page */
        .db-page { width: 100%; padding-bottom: 80px; }
        .db-body { padding-top: 40px; }

        /* Header */
        .db-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 36px; flex-wrap: wrap; }
        .db-greeting { font-size: clamp(1.75rem, 4vw, 2.5rem); margin-bottom: 4px; }
        .db-header-sub { font-size: 1rem; color: var(--color-muted); margin: 0; }

        /* Sticky sub-nav */
        .db-subnav {
          position: sticky; top: 57px; z-index: 90;
          background: var(--color-bg-card); border-bottom: 1px solid var(--color-border);
          padding: 0;
        }
        .db-subnav-inner { display: flex; gap: 0; overflow-x: auto; scrollbar-width: none; }
        .db-subnav-inner::-webkit-scrollbar { display: none; }
        .db-subnav-link {
          font-family: var(--font-body); font-size: 0.82rem; font-weight: 600;
          color: var(--color-muted); text-decoration: none;
          padding: 12px 20px; white-space: nowrap;
          border-bottom: 2px solid transparent;
          transition: all var(--transition-fast);
        }
        .db-subnav-link:hover { color: var(--color-text); opacity: 1; border-bottom-color: var(--color-border-dark); }

        /* Empty state */
        .db-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; padding: 80px 24px; border: 1.5px dashed var(--color-border-dark); border-radius: var(--radius-lg); }
        .db-empty-title { font-size: 1.6rem; margin: 0; }
        .db-empty-desc { color: var(--color-muted); max-width: 320px; margin: 0; }

        /* Sections */
        .db-section { margin-bottom: 32px; scroll-margin-top: 100px; }
        .db-section-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
        .db-section-title { font-size: 1.3rem; margin: 0; }
        .db-section-sub { font-size: 0.85rem; color: var(--color-muted); margin: 4px 0 0; }

        /* Stat cards */
        .db-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .db-stat { display: flex; flex-direction: column; gap: 6px; padding: 24px; }
        .db-stat-top { display: flex; align-items: center; justify-content: space-between; }
        .db-stat-icon { font-size: 1.3rem; }
        .db-stat-value { font-family: var(--font-display); font-size: 2.2rem; font-weight: 400; color: var(--color-text); letter-spacing: -0.02em; line-height: 1; }
        .db-stat-label { font-size: 0.875rem; font-weight: 700; color: var(--color-text); margin-top: 4px; }
        .db-stat-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
        .db-stat-sub { font-size: 0.75rem; color: var(--color-muted); }

        /* Chart */
        .db-chart-card { padding: 24px; }
        .db-chart-placeholder { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 20px; text-align: center; color: var(--color-muted); }
        .db-chart-placeholder p { margin: 0; font-size: 0.9rem; }

        /* Tooltip */
        .db-tooltip { background: var(--color-bg-card); border: 1.5px solid var(--color-border); border-radius: var(--radius-md); padding: 10px 14px; font-family: var(--font-body); box-shadow: var(--shadow-md); display: flex; flex-direction: column; gap: 2px; }
        .db-tooltip strong { font-size: 0.9rem; color: var(--color-text); }
        .db-tooltip span { font-size: 0.82rem; color: var(--color-muted); }
        .db-tooltip span:first-of-type { color: var(--color-accent); font-weight: 600; }

        /* Breakdown tabs */
        .db-tabs { display: flex; gap: 4px; margin-bottom: 20px; background: var(--color-bg); border-radius: var(--radius-md); padding: 4px; width: fit-content; }
        .db-tab { font-family: var(--font-body); font-size: 0.82rem; font-weight: 600; padding: 7px 16px; border-radius: 4px; border: none; cursor: pointer; background: transparent; color: var(--color-muted); transition: all var(--transition-fast); }
        .db-tab-active { background: var(--color-bg-card); color: var(--color-text); box-shadow: var(--shadow-sm); }
        .db-tab:hover:not(.db-tab-active) { color: var(--color-text); }

        /* Breakdown bars */
        .db-breakdown-list { display: flex; flex-direction: column; gap: 14px; }
        .db-breakdown-row { display: flex; flex-direction: column; gap: 6px; }
        .db-breakdown-label { display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; font-weight: 600; color: var(--color-text); }
        .db-breakdown-track { height: 8px; background: var(--color-border); border-radius: var(--radius-full); overflow: hidden; }
        .db-breakdown-fill { height: 100%; background: var(--color-accent); border-radius: var(--radius-full); transition: width 0.5s cubic-bezier(0.25,0.46,0.45,0.94); }
        .db-empty-inline { color: var(--color-muted); font-size: 0.9rem; padding: 12px 0; }

        /* Sessions */
        .db-sessions-card { padding: 0; overflow: hidden; }
        .db-session-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; transition: background var(--transition-fast); }
        .db-session-row-alt { background: var(--color-bg); }
        .db-session-row:hover { background: rgba(212,201,184,0.25); }
        .db-session-left { display: flex; align-items: center; gap: 12px; overflow: hidden; flex: 1; }
        .db-session-info { display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
        .db-session-task { font-size: 0.9rem; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .db-session-when { font-size: 0.75rem; color: var(--color-muted); }
        .db-session-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .db-session-focus { font-size: 0.78rem; color: var(--color-muted); }
        .db-row-divider { height: 1px; background: var(--color-border); margin: 0 20px; }
        .db-score-badge { font-family: var(--font-mono, monospace); }
        .db-score-low { background: rgba(74,157,111,0.12); color: #2f7d54; }
        .db-score-medium { background: rgba(216,135,45,0.13); color: #9b5d16; }
        .db-score-high { background: rgba(196,77,30,0.12); color: #c44d1e; }

        /* Step dots */
        .db-step-dots { display: flex; gap: 4px; align-items: center; }
        .db-dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid var(--color-border-dark); background: transparent; transition: background var(--transition-fast); }
        .db-dot-filled { background: var(--color-accent); border-color: var(--color-accent); }

        /* Placeholder cards */
        .db-placeholder-card { border-style: dashed; }
        .db-placeholder-inner { display: flex; align-items: flex-start; gap: 20px; flex-wrap: wrap; }
        .db-placeholder-inner h3 { font-family: var(--font-display); }

        /* Integrations */
        .db-integrations-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 1024px) {
          .db-integrations-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 640px) {
          .db-integrations-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Modal Overlay */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(26, 20, 16, 0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal-content {
          width: 100%;
          max-width: 440px;
          background: var(--color-bg-card);
          padding: 28px;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .modal-header h3 {
          font-family: var(--font-display);
          font-size: 1.5rem;
          margin: 0;
        }
        .btn-close {
          background: none;
          border: none;
          font-size: 1.8rem;
          cursor: pointer;
          color: var(--color-muted);
          line-height: 1;
        }
        .btn-close:hover {
          color: var(--color-text);
        }
        .modal-body {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-group label {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--color-text);
        }
        .form-group input {
          font-family: var(--font-body);
          font-size: 0.9rem;
          padding: 10px 12px;
          border-radius: var(--radius-md);
          border: 1.5px solid var(--color-border);
          background: var(--color-bg);
          color: var(--color-text);
          transition: border-color var(--transition-fast);
        }
        .form-group input:focus {
          outline: none;
          border-color: var(--color-accent);
        }
        .input-hint {
          font-size: 0.72rem;
          color: var(--color-muted);
        }
        .input-hint a {
          text-decoration: underline;
        }
        .modal-error {
          font-size: 0.82rem;
          color: #c44d1e;
          background: rgba(196,77,30,0.06);
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          border-left: 3px solid #c44d1e;
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 8px;
        }

        /* Responsive */
        @media (max-width: 900px) { .db-stats-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px) {
          .db-body { padding-top: 24px; }
          .db-stats-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
          .db-stat-value { font-size: 1.75rem; }
          .db-header { flex-direction: column; }
          .db-header .btn { width: 100%; justify-content: center; }
          .db-session-right .badge { display: none; }
        }
        @media (max-width: 420px) {
          .db-stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
