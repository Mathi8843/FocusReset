const TYPE_WEIGHTS = {
  standup: 4,
  'one-on-one': 12,
  client: 18,
  allhands: 14,
  planning: 16,
  review: 13,
  interview: 17,
  other: 10,
}

const SCORE_LABELS = [
  { min: 75, label: 'High', tone: 'high', recoveryMinutes: 10 },
  { min: 45, label: 'Medium', tone: 'medium', recoveryMinutes: 7 },
  { min: 0, label: 'Low', tone: 'low', recoveryMinutes: 4 },
]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function toMs(value) {
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

function getDurationMinutes(meeting) {
  const start = toMs(meeting?.startTime)
  const end = toMs(meeting?.endTime)
  if (!start || !end || end <= start) return 30
  return Math.round((end - start) / 60000)
}

function getTimeOfDayWeight(meeting) {
  const start = new Date(meeting?.startTime)
  const hour = Number.isFinite(start.getTime()) ? start.getHours() : new Date().getHours()
  if (hour >= 15) return 14
  if (hour >= 12) return 9
  if (hour < 9) return 6
  return 3
}

function getDensityWeight(meeting, allMeetings = []) {
  const start = toMs(meeting?.startTime)
  const end = toMs(meeting?.endTime)
  if (!start || !end || !allMeetings.length) return 0

  const nearby = allMeetings.filter(candidate => {
    if (candidate.id === meeting.id) return false
    const candidateStart = toMs(candidate.startTime)
    const candidateEnd = toMs(candidate.endTime)
    if (!candidateStart || !candidateEnd) return false

    const gapBefore = start - candidateEnd
    const gapAfter = candidateStart - end
    return (gapBefore >= 0 && gapBefore <= 15 * 60000) ||
      (gapAfter >= 0 && gapAfter <= 15 * 60000)
  }).length

  return clamp(nearby * 8, 0, 18)
}

function getHistoricalWeight(meetingType, sessions = []) {
  const matching = sessions.filter(session => session.completed && session.meetingType === meetingType && session.stepTimings)
  if (matching.length < 2) return 0

  const avgRecoverySeconds = matching.reduce((total, session) => {
    const { brainDump = 0, priorityReset = 0, entryTask = 0 } = session.stepTimings
    return total + brainDump + priorityReset + entryTask
  }, 0) / matching.length

  if (avgRecoverySeconds >= 12 * 60) return 12
  if (avgRecoverySeconds >= 8 * 60) return 8
  if (avgRecoverySeconds >= 5 * 60) return 4
  return 0
}

export function getHangoverScoreMeta(score) {
  return SCORE_LABELS.find(item => score >= item.min) || SCORE_LABELS[SCORE_LABELS.length - 1]
}

export function calculateHangoverScore({ meeting, allMeetings = [], sessions = [] }) {
  const meetingType = meeting?.meetingType || 'other'
  const durationMinutes = getDurationMinutes(meeting)
  const attendeeCount = Number(meeting?.attendees ?? 0)

  const factors = {
    duration: clamp(Math.round(durationMinutes * 0.45), 8, 30),
    attendees: clamp(attendeeCount * 2, 0, 16),
    timeOfDay: getTimeOfDayWeight(meeting),
    density: getDensityWeight(meeting, allMeetings),
    meetingType: TYPE_WEIGHTS[meetingType] ?? TYPE_WEIGHTS.other,
    history: getHistoricalWeight(meetingType, sessions),
  }

  const score = clamp(Object.values(factors).reduce((sum, value) => sum + value, 0), 0, 100)
  const meta = getHangoverScoreMeta(score)

  return {
    score,
    label: meta.label,
    tone: meta.tone,
    recommendedRecoveryMinutes: meta.recoveryMinutes,
    durationMinutes,
    factors,
  }
}

export function formatHangoverScore(scoreData) {
  if (!scoreData) return 'No score'
  return `${scoreData.label} hangover risk (${scoreData.score}/100)`
}
