import { supabase } from './supabaseClient'
import { getProfile, saveProfile } from '../utils/storage'

/**
 * Loads the Razorpay checkout script dynamically.
 * @returns {Promise<boolean>}
 */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

/**
 * Checks paywall status for a user:
 * 1. Checks profile for plan type.
 * 2. If 'pro' or 'team', bypasses monthly limit.
 * 3. Otherwise (or fallback 'free'), counts resets in current calendar month.
 * 
 * @param {string} userId 
 * @returns {Promise<{ allowed: boolean, plan: string, count: number, limit: number }>}
 */
export async function checkPaywallStatus(userId) {
  if (!userId) {
    return { allowed: true, plan: 'free', count: 0, limit: 100 }
  }

  // 1. Get profile (primary Supabase, fallback localStorage)
  const profile = await getProfile()
  const plan = profile?.plan ?? 'free'

  // Pro & Team get unlimited resets
  if (plan === 'pro' || plan === 'team') {
    return { allowed: true, plan, count: 0, limit: 100 }
  }

  // 2. Count resets this month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  try {
    const { count, error } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())

    if (error) throw error

    const currentCount = count ?? 0
    return {
      allowed: currentCount < 100,
      plan,
      count: currentCount,
      limit: 100
    }
  } catch (err) {
    console.warn('[paywallService] Supabase count error, checking local fallback:', err.message)
    // fallback to counting in localStorage
    const localCount = getLocalResetsThisMonth()
    return {
      allowed: localCount < 100,
      plan,
      count: localCount,
      limit: 100
    }
  }
}

/**
 * Counts resets in the current calendar month using localStorage fallback.
 * @returns {number}
 */
function getLocalResetsThisMonth() {
  try {
    const raw = localStorage.getItem('focusreset_sessions')
    if (!raw) return 0
    const sessions = JSON.parse(raw)
    if (!Array.isArray(sessions)) return 0

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    // filter by date
    return sessions.filter(s => {
      const date = s.date ?? s.created_at
      return date && new Date(date) >= startOfMonth
    }).length
  } catch {
    return 0
  }
}

/**
 * Updates the user's subscription tier in profiles (Supabase + localStorage).
 * 
 * @param {string} userId 
 * @param {'free' | 'pro' | 'team'} plan 
 * @returns {Promise<boolean>}
 */
export async function updateUserPlan(userId, plan) {
  try {
    // 1. Fetch current profile from local cache or Supabase to update it fully
    const profile = await getProfile() ?? {
      name: '',
      role: '',
      tools: [],
      projects: [],
      focusPeak: '',
      meetingsPerDay: '',
      onboardingCompleted: true,
      onboardingDate: new Date().toISOString(),
    }

    // 2. Save profile (writes localStorage then updates Supabase)
    const updatedProfile = { ...profile, plan }
    await saveProfile(updatedProfile)

    return true
  } catch (err) {
    console.error('[paywallService] Failed to update user plan:', err)
    return false
  }
}
