/**
 * meetingTypes.js — canonical meeting type definitions with keyword matching.
 * Used by contextAssembler.detectMeetingTypeFromTitle().
 */

export const MEETING_TYPES = [
  {
    id: 'standup',
    label: 'Team Standup',
    keywords: ['standup', 'stand-up', 'stand up', 'daily', 'scrum', 'sync'],
  },
  {
    id: 'one-on-one',
    label: '1-on-1',
    keywords: ['1:1', '1-on-1', 'one on one', 'one-on-one', '1 on 1', 'check-in', 'check in'],
  },
  {
    id: 'client',
    label: 'Client Call',
    keywords: ['client', 'customer', 'stakeholder', 'demo', 'sales', 'pitch', 'discovery'],
  },
  {
    id: 'allhands',
    label: 'All-Hands',
    keywords: ['all hands', 'all-hands', 'allhands', 'company meeting', 'town hall', 'townhall', 'company update'],
  },
  {
    id: 'planning',
    label: 'Planning',
    keywords: ['planning', 'sprint planning', 'roadmap', 'kickoff', 'kick-off', 'kick off', 'brainstorm'],
  },
  {
    id: 'review',
    label: 'Review',
    keywords: ['review', 'retrospective', 'retro', 'postmortem', 'post-mortem', 'debrief'],
  },
  {
    id: 'interview',
    label: 'Interview',
    keywords: ['interview', 'hiring', 'candidate', 'screen', 'recruiting'],
  },
  {
    id: 'other',
    label: 'Other',
    keywords: [],
  },
]
