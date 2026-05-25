/**
 * storage.js — Dual-path data layer for FocusReset.
 *
 * Strategy:
 *  • All reads: try Supabase first, fall back to localStorage on error/offline.
 *  • All writes: always write localStorage immediately (instant), then also
 *    upsert/insert into Supabase in the background so the app works offline.
 *  • All Supabase operations are scoped to the currently signed-in user.
 *
 * Session shape stored in Supabase `sessions` table:
 *  id, user_id, meeting_type, meeting_name, task_chosen,
 *  steps_completed, focus_minutes, step_timings (jsonb),
 *  total_duration, ai_context (jsonb), drain_level,
 *  hangover_score (jsonb), completed, early_exit, created_at
 *
 * Profile shape stored in Supabase `profiles` table:
 *  id (= auth.uid), name, role, daily_tools, projects,
 *  peak_time, meetings_per_day, onboarding_completed,
 *  onboarding_date, created_at
 */

import { supabase } from '../services/supabaseClient'

/* ================================================================
   CONSTANTS
================================================================ */
const LS_SESSIONS_KEY    = 'focusreset_sessions'
const LS_PROFILE_KEY     = 'focusreset_profile'
const LS_MIGRATED_KEY    = 'focusreset_migrated_to_supabase'

/* ================================================================
   INTERNAL HELPERS
================================================================ */

/** Returns the currently signed-in user, or null if unauthenticated. */
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/* ── localStorage helpers ─────────────────────────────────── */

function lsGetSessions() {
  try {
    const raw = localStorage.getItem(LS_SESSIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function lsSetSessions(sessions) {
  try {
    localStorage.setItem(LS_SESSIONS_KEY, JSON.stringify(sessions))
  } catch (e) {
    console.warn('[storage] localStorage write failed (sessions):', e)
  }
}

function lsGetProfile() {
  try {
    const raw = localStorage.getItem(LS_PROFILE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function lsSetProfile(profile) {
  try {
    localStorage.setItem(LS_PROFILE_KEY, JSON.stringify(profile))
  } catch (e) {
    console.warn('[storage] localStorage write failed (profile):', e)
  }
}

/* ── Supabase → app shape mapping ────────────────────────── */

/**
 * Maps a Supabase `sessions` row back to the legacy shape the
 * rest of the app (Dashboard analytics, calculations.js) expects.
 */
function dbRowToSession(row) {
  return {
    id:           row.id,
    date:         row.created_at,
    meetingType:  row.meeting_type  ?? '',
    meetingName:  row.meeting_name  ?? '',
    priorityTask: row.task_chosen   ?? '',
    stepTimings:  row.step_timings  ?? {},
    totalDuration:row.total_duration ?? 0,
    completed:    row.completed     ?? false,
    earlyExit:    row.early_exit    ?? false,
    hangoverScore:row.hangover_score ?? null,
    meetingContext:row.ai_context   ?? null,
  }
}

/**
 * Maps a Supabase `profiles` row back to the legacy profile shape.
 */
function dbRowToProfile(row) {
  return {
    name:                row.name                ?? '',
    role:                row.role                ?? '',
    tools:               row.daily_tools         ?? [],
    projects:            row.projects            ?? [],
    focusPeak:           row.peak_time           ?? '',
    meetingsPerDay:      row.meetings_per_day    ?? '',
    onboardingCompleted: row.onboarding_completed ?? false,
    onboardingDate:      row.onboarding_date     ?? null,
    plan:                row.plan                ?? 'free',
  }
}

/* ================================================================
   SESSIONS
================================================================ */

/**
 * getSessions()
 * Returns all sessions for the current user.
 * Tries Supabase first; falls back to localStorage if unauthenticated or on error.
 *
 * @returns {Promise<Array>}
 */
export async function getSessions() {
  try {
    const user = await getCurrentUser()
    if (!user) return lsGetSessions()

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Keep localStorage in sync for offline use
    const mapped = data.map(dbRowToSession)
    lsSetSessions(mapped)
    return mapped
  } catch (err) {
    console.warn('[storage] getSessions Supabase error, falling back to localStorage:', err.message)
    return lsGetSessions()
  }
}

/**
 * saveSession(session)
 * Writes a session to localStorage immediately (instant feedback),
 * then upserts to Supabase in the background.
 *
 * @param {Object} session  — the raw session data from Reset.jsx
 * @returns {Promise<Object>}  — the saved session (with id)
 */
export async function saveSession(session) {
  // 1. Write to localStorage immediately so the UI is never blocked
  const existing = lsGetSessions()
  const localId  = `session_${Date.now()}`
  const newSession = { id: localId, ...session }
  existing.push(newSession)
  lsSetSessions(existing)

  // 2. Attempt Supabase insert
  try {
    const user = await getCurrentUser()
    if (!user) return newSession   // unauthenticated — localStorage only

    const focusTimerSecs = session.stepTimings?.focusTimer ?? 0
    const focusMinutes   = Math.round(Math.min(focusTimerSecs, 25 * 60) / 60)

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id:        user.id,
        meeting_type:   session.meetingType   ?? null,
        meeting_name:   session.meetingName   ?? null,
        task_chosen:    session.priorityTask  ?? null,
        steps_completed:session.stepTimings ? Object.keys(session.stepTimings).length : 0,
        focus_minutes:  focusMinutes,
        step_timings:   session.stepTimings   ?? {},
        total_duration: session.totalDuration ?? 0,
        ai_context:     session.meetingContext ?? null,
        hangover_score: session.hangoverScore  ?? null,
        drain_level:    session.hangoverScore?.score ?? null,
        completed:      session.completed     ?? false,
        early_exit:     session.earlyExit     ?? false,
        created_at:     session.date          ?? new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    // Update the localStorage entry with the real Supabase UUID
    const synced = lsGetSessions()
    const idx = synced.findIndex(s => s.id === localId)
    const supabaseSession = dbRowToSession(data)
    if (idx !== -1) {
      synced[idx] = supabaseSession
      lsSetSessions(synced)
    }
    return supabaseSession
  } catch (err) {
    console.warn('[storage] saveSession Supabase error, kept in localStorage:', err.message)
    return newSession
  }
}

/**
 * clearSessions()
 * Removes all sessions from localStorage (used in tests / dev).
 * Does NOT delete from Supabase to protect production data.
 */
export function clearSessions() {
  localStorage.removeItem(LS_SESSIONS_KEY)
}

/* ================================================================
   USER PROFILE
================================================================ */

/**
 * saveProfile(profile)
 * Writes profile to localStorage immediately, then upserts to Supabase.
 *
 * @param {Object} profile
 * @returns {Promise<void>}
 */
export async function saveProfile(profile) {
  // 1. Always write localStorage first for instant feedback
  lsSetProfile(profile)

  // 2. Attempt Supabase upsert
  try {
    const user = await getCurrentUser()
    if (!user) return   // unauthenticated — localStorage only

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id:                   user.id,
        name:                 profile.name                ?? null,
        role:                 profile.role                ?? null,
        daily_tools:          profile.tools               ?? [],
        projects:             profile.projects            ?? [],
        peak_time:            profile.focusPeak           ?? null,
        meetings_per_day:     profile.meetingsPerDay      ?? null,
        onboarding_completed: profile.onboardingCompleted ?? false,
        onboarding_date:      profile.onboardingDate      ?? null,
        plan:                 profile.plan                ?? 'free',
      }, { onConflict: 'id' })

    if (error) throw error
  } catch (err) {
    console.warn('[storage] saveProfile Supabase error, kept in localStorage:', err.message)
  }
}

/**
 * getProfile()
 * Returns the user profile.
 * Tries Supabase first; falls back to localStorage.
 *
 * @returns {Promise<Object|null>}
 */
export async function getProfile() {
  try {
    const user = await getCurrentUser()
    if (!user) return lsGetProfile()

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      // PGRST116 = no row found — user hasn't completed onboarding yet
      if (error.code === 'PGRST116') return lsGetProfile()
      throw error
    }

    const profile = dbRowToProfile(data)
    lsSetProfile(profile)   // keep localStorage in sync
    return profile
  } catch (err) {
    console.warn('[storage] getProfile Supabase error, falling back to localStorage:', err.message)
    return lsGetProfile()
  }
}

/**
 * isOnboardingComplete()
 * SYNCHRONOUS check — reads only from localStorage so it can be used
 * in React Router guards (OnboardingGuard) without async.
 * Supabase data is synced into localStorage by getProfile(), so this
 * stays accurate after the first async getProfile() call on Dashboard.
 *
 * @returns {boolean}
 */
export function isOnboardingComplete() {
  const profile = lsGetProfile()
  return !!(profile?.onboardingCompleted)
}

/* ================================================================
   ONE-SHOT MIGRATION  (localStorage → Supabase)
================================================================ */

/**
 * migrateLocalStorageToSupabase()
 * Called once on Dashboard mount.
 * Uploads any existing localStorage sessions and profile to Supabase,
 * then sets a flag so it never runs again.
 *
 * @returns {Promise<void>}
 */
export async function migrateLocalStorageToSupabase() {
  // Don't run if already migrated or if flag is set
  if (localStorage.getItem(LS_MIGRATED_KEY) === 'true') return

  try {
    const user = await getCurrentUser()
    if (!user) return   // must be authenticated to migrate

    let migratedSomething = false

    // ── Migrate profile ──────────────────────────────────────
    const localProfile = lsGetProfile()
    if (localProfile?.onboardingCompleted) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (!existingProfile) {
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id:                   user.id,
            name:                 localProfile.name              ?? null,
            role:                 localProfile.role              ?? null,
            daily_tools:          localProfile.tools             ?? [],
            projects:             localProfile.projects          ?? [],
            peak_time:            localProfile.focusPeak         ?? null,
            meetings_per_day:     localProfile.meetingsPerDay    ?? null,
            onboarding_completed: true,
            onboarding_date:      localProfile.onboardingDate    ?? null,
            plan:                 localProfile.plan              ?? 'free',
          }, { onConflict: 'id' })

        if (!error) migratedSomething = true
        else console.warn('[storage] migration: profile upsert failed:', error.message)
      }
    }

    // ── Migrate sessions ─────────────────────────────────────
    const localSessions = lsGetSessions()
    if (localSessions.length > 0) {
      // Check which sessions already exist in Supabase
      const { data: existingRows } = await supabase
        .from('sessions')
        .select('created_at')
        .eq('user_id', user.id)

      const existingDates = new Set((existingRows || []).map(r => r.created_at))

      // Filter to sessions not yet in Supabase (match by date)
      const toInsert = localSessions
        .filter(s => !existingDates.has(s.date))
        .map(s => {
          const focusTimerSecs = s.stepTimings?.focusTimer ?? 0
          return {
            user_id:        user.id,
            meeting_type:   s.meetingType   ?? null,
            meeting_name:   s.meetingName   ?? null,
            task_chosen:    s.priorityTask  ?? null,
            steps_completed:s.stepTimings ? Object.keys(s.stepTimings).length : 0,
            focus_minutes:  Math.round(Math.min(focusTimerSecs, 25 * 60) / 60),
            step_timings:   s.stepTimings   ?? {},
            total_duration: s.totalDuration ?? 0,
            ai_context:     s.meetingContext ?? null,
            hangover_score: s.hangoverScore  ?? null,
            drain_level:    s.hangoverScore?.score ?? null,
            completed:      s.completed     ?? false,
            early_exit:     s.earlyExit     ?? false,
            created_at:     s.date          ?? new Date().toISOString(),
          }
        })

      if (toInsert.length > 0) {
        const { error } = await supabase.from('sessions').insert(toInsert)
        if (!error) migratedSomething = true
        else console.warn('[storage] migration: sessions insert failed:', error.message)
      }
    }

    if (migratedSomething) {
      console.info('[storage] Migration complete — localStorage data uploaded to Supabase.')
    }

    // Mark migration as done regardless (even if nothing to migrate)
    localStorage.setItem(LS_MIGRATED_KEY, 'true')
  } catch (err) {
    console.warn('[storage] migration failed (non-fatal):', err.message)
    // Do NOT set the migrated flag — allow retry next load
  }
}

/* ================================================================
   ANALYTICS HELPERS
   These are thin wrappers — the real computation stays in
   calculations.js. They just provide a convenient async fetch + calc.
================================================================ */

/** Sessions from the last N days (async) */
export async function getSessionsLastNDays(n = 7) {
  const sessions = await getSessions()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - n)
  cutoff.setHours(0, 0, 0, 0)
  return sessions.filter(s => new Date(s.date) >= cutoff)
}

/** Sessions this week Mon–Sun (async) */
export async function getSessionsThisWeek() {
  const sessions = await getSessions()
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  return sessions.filter(s => new Date(s.date) >= monday && s.completed)
}

/** Average minutes to enter flow (async) */
export async function getAvgTimeToFlow() {
  const sessions = (await getSessions()).filter(s => s.completed)
  if (sessions.length === 0) return null
  const focusDuration = 25 * 60
  const setupTimes = sessions.map(s => {
    const focusSecs = s.stepTimings?.focusTimer ?? focusDuration
    return Math.max(0, s.totalDuration - focusSecs)
  })
  const avg = setupTimes.reduce((a, b) => a + b, 0) / setupTimes.length
  return Math.round(avg / 60)
}

/** Most frequent meeting type (async) */
export async function getMostDrainingMeetingType() {
  const sessions = await getSessions()
  if (sessions.length === 0) return null
  const counts = {}
  sessions.forEach(s => {
    if (s.meetingType) counts[s.meetingType] = (counts[s.meetingType] || 0) + 1
  })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

/** Current streak — consecutive days with ≥1 completed session (async) */
export async function getCurrentStreak() {
  const sessions = (await getSessions()).filter(s => s.completed)
  if (sessions.length === 0) return 0
  const dateSet = new Set(
    sessions.map(s => new Date(s.date).toISOString().slice(0, 10))
  )
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    if (dateSet.has(d.toISOString().slice(0, 10))) {
      streak++
    } else {
      break
    }
  }
  return streak
}

/** Sessions per day for last N days (async) */
export async function getSessionsPerDay(days = 7) {
  const sessions = (await getSessions()).filter(s => s.completed)
  const result = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('en-US', { weekday: 'short' })
    const count = sessions.filter(s =>
      new Date(s.date).toISOString().slice(0, 10) === key
    ).length
    result.push({ date: key, label, count })
  }
  return result
}
