/**
 * contextAssembler.js
 * ────────────────────────────────────────────────────────────
 * The Context Assembly Engine for FocusReset.
 *
 * Packages everything the app knows about the user into one clean
 * context object before every AI call. All AI calls run through
 * Groq (console.groq.com) using the same VITE_GROK_API_KEY.
 *
 * Rules:
 *  - Every function that calls the API wraps in try/catch
 *  - On any failure, return sensible defaults — never block the UI
 *  - AI calls use the “fire-and-update” pattern: show defaults
 *    first, replace with AI response when ready
 *  - extractBrainDumpContext must resolve in under 4 seconds
 *    (enforced via Promise.race with a 4000ms timeout)
 */

import { getProfile, getSessions } from '../utils/storage.js'
import { MEETING_TYPES } from '../constants/meetingTypes.js'
import {
  getStreak,
  getAverageRecoveryTime,
  getMeetingTypeDrainRanking,
  toDateKey,
} from '../utils/calculations.js'

/* ----------------------------------------------------------------
   GROQ API CONFIG
   Uses the same VITE_GROK_API_KEY as aiInsights.js.
   Model: llama-3.3-70b-versatile (fast, great at JSON extraction)
   ---------------------------------------------------------------- */
const API_KEY    = import.meta.env.VITE_GROK_API_KEY ?? ''
const GROQ_URL   = API_KEY
  ? (import.meta.env.DEV ? '/api-groq/openai/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions')
  : '/api/groq'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

/** Low-level Groq call — returns the assistant text or throws */
async function callGroq({ systemPrompt, userContent, maxTokens = 512 }) {
  console.log('[FocusReset Debug] callGroq starting. GROQ_URL =', GROQ_URL, 'API_KEY present =', !!API_KEY);
  const headers = {
    'Content-Type':  'application/json',
  }
  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`
  }

  const response = await fetch(GROQ_URL, {
    method:  'POST',
    headers,
    body: JSON.stringify({
      model:      GROQ_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent  },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    console.error('[FocusReset Debug] callGroq response not OK:', response.status, err);
    throw new Error(`Groq API ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    console.error('[FocusReset Debug] callGroq empty choices response:', data);
    throw new Error('Empty response from Groq');
  }
  return text;
}

/* ================================================================
   1. assembleFullContext(currentSession?)
   ================================================================
   Main function. Reads all local data sources and returns one
   unified context object for AI calls.

   currentSession shape (optional):
   { meetingType, meetingName, startTime }
================================================================ */
export async function assembleFullContext(currentSession = null) {
  const profile  = (await getProfile()) ?? {}
  const sessions = await getSessions()
  const today    = toDateKey(new Date())

  /* ── User profile ───────────────────────────────────────────── */
  const user = {
    name:           profile.name          ?? 'there',
    role:           profile.role          ?? 'other',
    tools:          profile.tools         ?? [],
    projects:       profile.projects      ?? [],
    focusPeak:      profile.focusPeak     ?? 'morning',
    meetingsPerDay: profile.meetingsPerDay ?? '3–4',
  }

  /* ── Historical patterns ────────────────────────────────────── */
  const completed      = sessions.filter(s => s.completed)
  const totalSessions  = sessions.length
  const completionRate = totalSessions > 0
    ? Math.round((completed.length / totalSessions) * 100)
    : 0

  const avgRecoverySecs = getAverageRecoveryTime(sessions)
  const drainRanking    = getMeetingTypeDrainRanking(sessions)
  const worstMeeting    = drainRanking.sort((a, b) => b.avgDrain - a.avgDrain)[0]?.type ?? null

  /* Best focus time of day — hour of day most sessions were started */
  const bestFocusHour   = _getBestFocusHour(completed)
  const bestFocusTimeOfDay = _hourToTimeLabel(bestFocusHour)

  /* Most common priority task */
  const mostCommonTask = _getMostCommonTask(completed)

  const patterns = {
    totalSessionsAllTime:    totalSessions,
    completionRate,
    averageRecoveryMinutes:  avgRecoverySecs !== null ? Math.round(avgRecoverySecs / 60) : null,
    worstMeetingType:        worstMeeting,
    bestFocusTimeOfDay,
    currentStreak:           getStreak(sessions),
    mostCommonTask,
  }

  /* ── Today's context ────────────────────────────────────────── */
  const todaySessions = completed.filter(s => toDateKey(new Date(s.date)) === today)

  const focusMinutesToday = todaySessions.reduce((acc, s) => {
    return acc + Math.round(Math.min(s.stepTimings?.focusTimer ?? 25 * 60, 25 * 60) / 60)
  }, 0)

  const meetingsLoggedToday = [...new Set(
    sessions.filter(s => toDateKey(new Date(s.date)) === today).map(s => s.meetingType)
  )]

  const todayContext = {
    sessionsToday:       todaySessions.length,
    focusMinutesToday,
    meetingsLoggedToday,
    calendarMeetings:    _getCalendarMeetings(), // returns [] unless Calendar is connected
  }

  /* ── Current session ────────────────────────────────────────── */
  const currentSessionData = currentSession
    ? {
        meetingType: currentSession.meetingType  ?? null,
        meetingName: currentSession.meetingName  ?? null,
        startTime:   currentSession.startTime    ?? new Date().toISOString(),
        durationMinutes: currentSession.meeting?.hangoverScore?.durationMinutes ?? null,
        attendeeCount: currentSession.meeting?.attendees ?? null,
        hangoverScore: currentSession.hangoverScore ?? currentSession.meeting?.hangoverScore ?? null,
      }
    : null

  /* ── Integrations ───────────────────────────────────────────── */
  const integrations = {
    jira:   _getIntegrationData('jira'),
    github: _getIntegrationData('github'),
    notion: _getIntegrationData('notion'),
    linear: _getIntegrationData('linear'),
    outlook: _getIntegrationData('outlook'),
  }

  return { user, patterns, todayContext, currentSession: currentSessionData, integrations }
}

/* ================================================================
   2. extractBrainDumpContext(brainDumpText)
   ================================================================
   Analyses the Step 1 brain dump text with Claude.
   Hard timeout of 2000ms — returns empty defaults on failure
   so the user is never blocked.
================================================================ */
export async function extractBrainDumpContext(brainDumpText) {
  /* Default response — returned if AI fails or text is too short */
  const defaults = {
    projectsMentioned:  [],
    peopleNames:        [],
    taskTypes:          [],
    emotionalTone:      'neutral',
    deadlinesMentioned: [],
    blockers:           [],
    actionItems:        [],   // concrete follow-ups extracted from dump
    unresolvedThoughts: [],   // worries / vague anxieties still lingering
  }

  if (!brainDumpText || brainDumpText.trim().length < 20) return defaults
  if (!API_KEY) {
    console.warn('[FocusReset] VITE_GROK_API_KEY not set — skipping brain dump extraction.')
    return defaults
  }

  const systemPrompt = `You are a context extraction engine for a focus productivity app.
Analyze the brain dump and extract structured data ONLY as valid JSON.
Return nothing else — no markdown, no explanation, just the raw JSON object.`

  const userContent = `Analyze this brain dump from someone who just finished a meeting.
Extract ONLY in JSON format:
{
  "projectsMentioned": ["string — project or product names mentioned"],
  "peopleNames": ["string — first names or full names of people mentioned"],
  "taskTypes": ["one of: bug-fix, feature, writing, review, communication, planning, other"],
  "emotionalTone": "stressed | neutral | energized",
  "deadlinesMentioned": ["string — any deadline or due-date phrasing, verbatim or paraphrased"],
  "blockers": ["string — things that are blocking progress, verbatim or paraphrased"],
  "actionItems": ["string — concrete follow-up tasks the person needs to do, e.g. 'Reply to Rahul about API deadline'"],
  "unresolvedThoughts": ["string — worries, anxieties or vague lingering concerns, e.g. 'Manager seemed unhappy with delay'"]
}
Return ONLY the JSON. No explanation.
Brain dump: ${brainDumpText}`

  try {
    /* Race the API call against a 4-second timeout */
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Brain dump extraction timed out')), 4000)
    )

    console.log('[FocusReset Debug] extractBrainDumpContext calling API...');
    const apiPromise = callGroq({ systemPrompt, userContent, maxTokens: 500 })
    const raw = await Promise.race([apiPromise, timeoutPromise])

    console.log('[FocusReset Debug] extractBrainDumpContext raw response:', raw);
    /* Strip any accidental markdown code fences */
    const cleaned = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()
    const parsed  = JSON.parse(cleaned)
    console.log('[FocusReset Debug] extractBrainDumpContext parsed JSON:', parsed);

    /* Validate shape — return defaults for any missing keys */
    return {
      projectsMentioned:  Array.isArray(parsed.projectsMentioned)  ? parsed.projectsMentioned  : [],
      peopleNames:        Array.isArray(parsed.peopleNames)         ? parsed.peopleNames         : [],
      taskTypes:          Array.isArray(parsed.taskTypes)           ? parsed.taskTypes           : [],
      emotionalTone:      ['stressed','neutral','energized'].includes(parsed.emotionalTone)
                            ? parsed.emotionalTone : 'neutral',
      deadlinesMentioned: Array.isArray(parsed.deadlinesMentioned)  ? parsed.deadlinesMentioned  : [],
      blockers:           Array.isArray(parsed.blockers)            ? parsed.blockers            : [],
      actionItems:        Array.isArray(parsed.actionItems)         ? parsed.actionItems         : [],
      unresolvedThoughts: Array.isArray(parsed.unresolvedThoughts)  ? parsed.unresolvedThoughts  : [],
    }
  } catch (err) {
    console.error('[FocusReset Debug] extractBrainDumpContext failed:', err.message, err)
    return defaults
  }
}

/* ================================================================
   3. generateStepSuggestions(context)
   ================================================================
   Generates personalised Step 2 priority tasks and Step 3
   micro-tasks. Results are cached in sessionStorage for 10 minutes.
================================================================ */
/**
 * generateStepSuggestions(context, forceRefresh?)
 *
 * forceRefresh = true → ignores sessionStorage cache and always calls the API.
 * This should be set to true whenever a new brain dump has just been extracted,
 * so the old pre-warmed generic suggestions are replaced with personalised ones.
 */
export async function generateStepSuggestions(context, forceRefresh = false) {
  /* Default fallback suggestions — always works without AI */
  const defaults = {
    priorityTasks: [
      { id: 'coding',  label: 'Deep Coding',   type: 'feature',       why: 'Continue where you left off before the meeting.' },
      { id: 'writing', label: 'Writing',        type: 'writing',       why: 'Get key thoughts captured while they are fresh.' },
      { id: 'email',   label: 'Clear Inbox',    type: 'communication', why: 'Catch up on messages that came in during the meeting.' },
      { id: 'notes',   label: 'Meeting Notes',  type: 'review',        why: 'Capture decisions and action items before you forget.' },
    ],
    entryTasks: {
      coding:  ['Open your IDE and read the last function you wrote', 'Write just the function signature', 'Read the ticket description for 60 seconds'],
      writing: ['Open the doc and read the last paragraph', 'Write just the section heading', 'Re-read your outline for 60 seconds'],
      email:   ['Scan subject lines, mark urgent ones', 'Reply to just one short email', 'Archive anything older than 2 days'],
      notes:   ["Write today's date and meeting name", 'List the 3 key decisions made', 'Write one action item with your name'],
    },
  }

  if (!API_KEY) {
    console.warn('[FocusReset] VITE_GROK_API_KEY not set — using default suggestions.')
    return defaults
  }

  /* ── Cache logic ────────────────────────────────────────────── */
  // Skip cache read if:
  //   a) forceRefresh is explicitly requested, OR
  //   b) brainDump context is present (brain dump was just processed)
  const hasBrainDump = !!(context.brainDump &&
    (
      (context.brainDump.actionItems?.length > 0) ||
      (context.brainDump.unresolvedThoughts?.length > 0) ||
      (context.brainDump.blockers?.length > 0) ||
      (context.brainDump.peopleNames?.length > 0)
    )
  )
  const skipCacheRead = forceRefresh || hasBrainDump

  const today    = toDateKey(new Date())
  const cacheKey = `focusreset_suggestions_${today}`

  if (!skipCacheRead) {
    try {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        const { timestamp, data } = JSON.parse(cached)
        const ageMin = (Date.now() - timestamp) / 60000
        if (ageMin < 10) {
          console.log('[FocusReset Debug] generateStepSuggestions: returning cached suggestions (age:', ageMin.toFixed(1), 'min)')
          return data
        }
      }
    } catch {
      /* sessionStorage unavailable — continue without cache */
    }
  } else {
    console.log('[FocusReset Debug] generateStepSuggestions: skipping cache —', hasBrainDump ? 'brain dump present' : 'forceRefresh=true')
  }

  /* ── Build the prompt ───────────────────────────────────────── */
  const { user, currentSession, integrations, brainDump } = context

  // Flatten brain dump into a readable block for the prompt
  let brainDumpBlock = ''
  if (brainDump) {
    const parts = []
    if (brainDump.actionItems?.length)        parts.push(`ACTION ITEMS (things they need to do): ${brainDump.actionItems.join('; ')}`)
    if (brainDump.unresolvedThoughts?.length) parts.push(`UNRESOLVED THOUGHTS (worries/lingering concerns): ${brainDump.unresolvedThoughts.join('; ')}`)
    if (brainDump.blockers?.length)           parts.push(`BLOCKERS: ${brainDump.blockers.join('; ')}`)
    if (brainDump.peopleNames?.length)        parts.push(`PEOPLE MENTIONED: ${brainDump.peopleNames.join(', ')}`)
    if (brainDump.projectsMentioned?.length)  parts.push(`PROJECTS MENTIONED: ${brainDump.projectsMentioned.join(', ')}`)
    if (brainDump.deadlinesMentioned?.length) parts.push(`DEADLINES MENTIONED: ${brainDump.deadlinesMentioned.join('; ')}`)
    if (brainDump.emotionalTone)              parts.push(`EMOTIONAL TONE: ${brainDump.emotionalTone}`)
    brainDumpBlock = parts.join('\n')
  }

  // Flatten integration data
  let integrationsBlock = ''
  const intParts = []
  if (integrations?.jira?.tickets?.length) {
    const tickets = integrations.jira.tickets.slice(0, 5)
    intParts.push('JIRA OPEN TICKETS:\n' + tickets.map(t => `  - ${t.key}: ${t.summary} [${t.status}]`).join('\n'))
  }
  if (integrations?.linear?.issues?.length) {
    const issues = integrations.linear.issues.slice(0, 5)
    intParts.push('LINEAR OPEN ISSUES:\n' + issues.map(i => `  - ${i.key}: ${i.summary} [${i.status}]`).join('\n'))
  }
  if (integrations?.github?.repos?.length) {
    const prs = integrations.github.repos
      .flatMap(r => r.openPRs.map(pr => `  - ${r.name}#${pr.number}: ${pr.title}`))
      .slice(0, 5)
    if (prs.length) intParts.push('GITHUB OPEN PRS:\n' + prs.join('\n'))
  }
  if (intParts.length) integrationsBlock = intParts.join('\n')

  const systemPrompt = `You are the FocusReset AI — a post-meeting cognitive recovery assistant.
Your job is to generate hyper-personalised, grounded task suggestions that help the user recover and restore focus context immediately after a meeting.
Output must be valid JSON only — no markdown, no explanation, no preamble.`

  const userContent = `Generate personalised focus task suggestions for this user who just finished a meeting.

═══ USER PROFILE ═══
Name: ${user.name}
Role: ${user.role}
Projects: ${user.projects?.join(', ') || 'not specified'}
Tools: ${user.tools?.join(', ') || 'not specified'}
Focus peak: ${user.focusPeak}
${currentSession ? `Meeting just ended: ${currentSession.meetingType || ''} — ${currentSession.meetingName || ''}` : ''}

${brainDumpBlock ? `═══ BRAIN DUMP CONTEXT (extracted from what user just typed — USE THIS AS PRIMARY INPUT) ═══
${brainDumpBlock}
` : ''}
${integrationsBlock ? `═══ ACTIVE WORK CONTEXT ═══
${integrationsBlock}
` : ''}
═══ INSTRUCTIONS ═══
1. Return exactly 4 priorityTask cards.
2. PRIORITY ENGINE RULE (CRITICAL): Prioritize tasks that restore interrupted deep-work context. Focus on what the user was already deeply engaged in before the meeting (as described in the brain dump or recent history) rather than proposing brand-new shallow or reactive items, unless they are critical blockers. The primary goal is reducing cognitive reload cost for high-friction tasks.
3. If brain dump context is available:
   - At least 2-3 cards MUST directly address real items from the brain dump (action items, unresolved thoughts, or blockers).
   - Use the actual names of people and projects from the brain dump in the card label and "why" field.
   - Example: if actionItems has "Reply to Rahul about API deadline", create a card like { id: "reply-rahul", label: "Reply to Rahul on API", ... }
4. If Jira/Linear tickets are available, reference ticket keys (e.g. "PROJ-123") in relevant cards.
5. For each priorityTask, generate exactly 3 entryTask items keyed by that task's id.
6. ENTRY TASK LANGUAGE RULE (CRITICAL):
   - Each entryTask MUST be an absurdly small, low-friction action completable in 60-90 seconds.
   - Avoid robotic, overly literal instructions (e.g. DO NOT say "Open Slack and search for Rahul's name" or "Open browser and click link").
   - Write in a natural, calm, human tone that eases the brain in (e.g., say "Re-read the deployment blocker message from Rahul" or "Open the file and re-read the last three lines you wrote").
   - Do not use corporate speak, productivity slogans, or motivational jargon.
7. The "why" field: one short sentence grounding the card in the user's actual context.
8. The "type" field: one of feature|bug-fix|writing|review|communication|planning|other

Output format (strict JSON, no trailing commas):
{
  "priorityTasks": [
    { "id": "unique-kebab-id", "label": "Short task label", "type": "string", "why": "One sentence grounded in user context" }
  ],
  "entryTasks": {
    "unique-kebab-id": [
      "Absurdly small first action in 60-90 seconds",
      "Another tiny first action",
      "A third tiny first action"
    ]
  }
}

Return ONLY the JSON object. No text before or after it.`

  try {
    console.log('[FocusReset Debug] generateStepSuggestions calling API...');
    console.log('[FocusReset Debug] generateStepSuggestions brainDump context:', brainDump);
    const raw     = await callGroq({ systemPrompt, userContent, maxTokens: 1200 })
    console.log('[FocusReset Debug] generateStepSuggestions raw response:', raw);
    const cleaned = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim()
    const parsed  = JSON.parse(cleaned)
    console.log('[FocusReset Debug] generateStepSuggestions parsed JSON:', parsed);

    /* Validate minimum shape */
    if (!Array.isArray(parsed.priorityTasks) || parsed.priorityTasks.length < 1) {
      throw new Error('Invalid priorityTasks shape from AI')
    }

    /* Store in sessionStorage with timestamp */
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: parsed }))
    } catch { /* storage full — skip cache */ }

    return parsed
  } catch (err) {
    console.error('[FocusReset Debug] generateStepSuggestions failed:', err.message, err)
    return defaults
  }
}

/* ================================================================
   4. buildAIPromptContext(context)
   ================================================================
   Converts the full context object into a compact, token-efficient
   string. Use this as a system prompt prefix on every AI call.
================================================================ */
export function buildAIPromptContext(context) {
  const { user, patterns, todayContext, currentSession, integrations } = context

  const lines = []

  lines.push(`USER: ${user.name}, ${_roleLabel(user.role)}`)

  if (user.projects?.length) {
    lines.push(`PROJECTS: ${user.projects.join(', ')}`)
  }

  if (user.tools?.length) {
    lines.push(`TOOLS: ${user.tools.join(', ')}`)
  }

  lines.push(`FOCUS PEAK: ${user.focusPeak}`)

  if (currentSession) {
    const meeting = [currentSession.meetingType, currentSession.meetingName].filter(Boolean).join(' — ')
    lines.push(`CURRENT MEETING: ${meeting || 'unknown'}`)
    if (currentSession.hangoverScore) {
      lines.push(`HANGOVER SCORE: ${currentSession.hangoverScore.score}/100 (${currentSession.hangoverScore.label}), ${currentSession.hangoverScore.recommendedRecoveryMinutes}min recovery recommended`)
    }
  }

  const patternParts = []
  if (patterns.worstMeetingType)        patternParts.push(`worst meeting=${patterns.worstMeetingType}`)
  if (patterns.averageRecoveryMinutes)  patternParts.push(`avg recovery=${patterns.averageRecoveryMinutes}min`)
  if (patterns.currentStreak !== null)  patternParts.push(`streak=${patterns.currentStreak}days`)
  if (patterns.completionRate !== null) patternParts.push(`completion=${patterns.completionRate}%`)
  if (patternParts.length) {
    lines.push(`PATTERNS: ${patternParts.join(', ')}`)
  }

  const todayParts = []
  todayParts.push(`${todayContext.sessionsToday} sessions done`)
  todayParts.push(`${todayContext.focusMinutesToday}min recovered`)

  const nextMeeting = _getNextCalendarMeeting(todayContext.calendarMeetings)
  if (nextMeeting) todayParts.push(`next meeting in ${nextMeeting}min`)

  lines.push(`TODAY: ${todayParts.join(', ')}`)

  /* Active integrations */
  const activeWork = []
  if (integrations?.jira)   activeWork.push(`Jira: ${_summariseIntegration(integrations.jira)}`)
  if (integrations?.github) activeWork.push(`GitHub: ${_summariseIntegration(integrations.github)}`)
  if (integrations?.notion) activeWork.push(`Notion: ${_summariseIntegration(integrations.notion)}`)
  if (activeWork.length) {
    lines.push(`ACTIVE WORK: ${activeWork.join(' | ')}`)
  }

  return lines.join('\n')
}

/* ================================================================
   5. detectMeetingTypeFromTitle(title)
   ================================================================
   Keyword-matches a calendar event title to a meeting type id.
================================================================ */
export function detectMeetingTypeFromTitle(title) {
  if (!title || typeof title !== 'string') return 'other'

  const lower = title.toLowerCase()

  for (const type of MEETING_TYPES) {
    if (type.id === 'other') continue // skip fallback
    if (type.keywords.some(kw => lower.includes(kw))) {
      return type.id
    }
  }

  return 'other'
}

/* ================================================================
   PRIVATE HELPERS
================================================================ */

/** Returns the hour of day (0–23) that most completed sessions started */
function _getBestFocusHour(completedSessions) {
  if (!completedSessions.length) return 9 // default: 9am
  const hourCounts = {}
  completedSessions.forEach(s => {
    const h = new Date(s.date).getHours()
    hourCounts[h] = (hourCounts[h] || 0) + 1
  })
  return Number(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0])
}

/** Converts an hour number to a human label */
function _hourToTimeLabel(hour) {
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

/** Returns the most frequently chosen priority task label */
function _getMostCommonTask(completedSessions) {
  if (!completedSessions.length) return null
  const counts = {}
  completedSessions.forEach(s => {
    if (s.priorityTask) counts[s.priorityTask] = (counts[s.priorityTask] || 0) + 1
  })
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return top ? top[0] : null
}

/**
 * Returns calendar meetings from localStorage if the Calendar
 * integration is connected. Returns [] until that feature is built.
 */
function _getCalendarMeetings() {
  let google = []
  let outlook = []
  try {
    const rawG = localStorage.getItem('focusreset_calendar_meetings')
    google = rawG ? JSON.parse(rawG) : []
  } catch { /* JSON parse failure — ignore, use empty array */ }
  try {
    const rawO = localStorage.getItem('focusreset_outlook_meetings')
    outlook = rawO ? JSON.parse(rawO) : []
  } catch { /* JSON parse failure — ignore, use empty array */ }

  const merged = [...google, ...outlook]
  return merged.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
}

/**
 * Returns integration data from localStorage if that integration
 * is connected. Returns null until the integration is built.
 */
function _getIntegrationData(name) {
  try {
    const raw = localStorage.getItem(`focusreset_integration_${name}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Minutes until the next upcoming calendar meeting (or null) */
function _getNextCalendarMeeting(meetings) {
  if (!meetings?.length) return null
  const now = Date.now()
  const upcoming = meetings
    .map(m => ({ ...m, msAway: new Date(m.startTime).getTime() - now }))
    .filter(m => m.msAway > 0)
    .sort((a, b) => a.msAway - b.msAway)
  if (!upcoming.length) return null
  return Math.round(upcoming[0].msAway / 60000)
}

/** Human-readable role label */
function _roleLabel(roleId) {
  const labels = {
    developer: 'Developer/Engineer', designer: 'Designer/Creative',
    manager: 'Manager/Lead', writer: 'Writer/Content',
    analyst: 'Analyst/Data', other: 'Knowledge Worker',
  }
  return labels[roleId] ?? roleId
}

/** One-line summary of integration data for prompt context */
function _summariseIntegration(data) {
  if (!data) return ''
  if (data.tickets?.length)  return `${data.tickets.length} open tickets`
  if (data.prs?.length)      return `${data.prs.length} open PRs`
  if (data.pages?.length)    return `${data.pages.length} recent pages`
  if (data.issues?.length)   return `${data.issues.length} active issues`
  return 'connected'
}
