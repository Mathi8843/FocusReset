import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadRazorpayScript, updateUserPlan } from '../services/paywallService'
import { useAuth } from '../contexts/AuthContext'
import { getProfile } from '../utils/storage'

export default function Upgrade() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  const [currentPlan, setCurrentPlan] = useState('free')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [error, setError] = useState(null)
  const [teamUsers, setTeamUsers] = useState(5) // default min 5

  useEffect(() => {
    if (user) {
      getProfile().then(profile => {
        if (profile?.plan) {
          setCurrentPlan(profile.plan)
        }
      })
    }
  }, [user])

  // Handler for Razorpay Pro payment
  async function handleUpgradePro() {
    setLoading(true)
    setError(null)

    const scriptLoaded = await loadRazorpayScript()
    if (!scriptLoaded) {
      setError('Failed to load payment gateway script. Please check your internet connection.')
      setLoading(false)
      return
    }

    const key = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_dummy_focusreset'

    const options = {
      key: key,
      amount: 19900, // ₹199 in paise
      currency: 'INR',
      name: 'FocusReset Pro',
      description: 'Monthly Unlimited Resets Plan',
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=128&h=128&q=80',
      handler: async function (response) {
        try {
          setLoading(true)
          if (response.razorpay_payment_id) {
            const success = await updateUserPlan(user.id, 'pro')
            if (success) {
              setSuccessMsg('Successfully upgraded to Pro! Redirecting to dashboard...')
              setCurrentPlan('pro')
              setTimeout(() => {
                navigate('/dashboard')
              }, 2500)
            } else {
              setError('Payment succeeded but we failed to update your account. Please contact support.')
            }
          } else {
            setError('Payment validation failed.')
          }
        } catch (err) {
          setError(err.message || 'An error occurred during account upgrade.')
        } finally {
          setLoading(false)
        }
      },
      prefill: {
        email: user?.email || '',
      },
      theme: {
        color: '#e85d26',
      },
      modal: {
        ondismiss: function () {
          setLoading(false)
        }
      }
    }

    try {
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      setError('Could not open Razorpay checkout modal: ' + err.message)
      setLoading(false)
    }
  }

  // Handler for Razorpay Team payment
  async function handleUpgradeTeam() {
    setLoading(true)
    setError(null)

    const scriptLoaded = await loadRazorpayScript()
    if (!scriptLoaded) {
      setError('Failed to load payment gateway script. Please check your internet connection.')
      setLoading(false)
      return
    }

    const key = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_dummy_focusreset'
    const totalAmount = teamUsers * 50 // ₹50 per user

    const options = {
      key: key,
      amount: totalAmount * 100, // in paise
      currency: 'INR',
      name: 'FocusReset Team',
      description: `Monthly Plan for ${teamUsers} users`,
      image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=128&h=128&q=80',
      handler: async function (response) {
        try {
          setLoading(true)
          if (response.razorpay_payment_id) {
            const success = await updateUserPlan(user.id, 'team')
            if (success) {
              setSuccessMsg('Successfully upgraded to Team! Redirecting to dashboard...')
              setCurrentPlan('team')
              setTimeout(() => {
                navigate('/dashboard')
              }, 2500)
            } else {
              setError('Payment succeeded but we failed to update your account. Please contact support.')
            }
          } else {
            setError('Payment validation failed.')
          }
        } catch (err) {
          setError(err.message || 'An error occurred during account upgrade.')
        } finally {
          setLoading(false)
        }
      },
      prefill: {
        email: user?.email || '',
      },
      theme: {
        color: '#2d6e4e',
      },
      modal: {
        ondismiss: function () {
          setLoading(false)
        }
      }
    }

    try {
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      setError('Could not open Razorpay checkout modal: ' + err.message)
      setLoading(false)
    }
  }

  return (
    <div className="upgrade-page container animate-fade-in">
      <div className="upgrade-header">
        <span className="upgrade-badge">Pricing Plans</span>
        <h1>Scale Your Focus Recovery</h1>
        <p>
          Upgrade your plan to unlock unlimited resets, team comparative metrics, 
          and advanced personalized AI coaching suggestions.
        </p>
      </div>

      {error && <div className="upgrade-error-banner">⚠ {error}</div>}
      {successMsg && <div className="upgrade-success-banner">🎉 {successMsg}</div>}

      <div className="pricing-tiers">
        {/* Free Tier */}
        <div className={`pricing-card ${currentPlan === 'free' ? 'active-plan-card' : ''}`}>
          {currentPlan === 'free' && <div className="active-badge">Active Plan</div>}
          <div className="card-header">
            <h3>Free Plan</h3>
            <div className="price">₹0</div>
            <p className="price-detail">Forever</p>
          </div>
          <div className="card-body">
            <ul>
              <li>✓ 100 meeting resets per month</li>
              <li>✓ Local localStorage backup</li>
              <li>✓ Basic AI insights</li>
            </ul>
          </div>
          <button className="btn btn-ghost btn-sm btn-full" disabled>
            {currentPlan === 'free' ? 'Your Current Plan' : 'Free Tier'}
          </button>
        </div>

        {/* Pro Tier */}
        <div className={`pricing-card card-pro ${currentPlan === 'pro' ? 'active-plan-card' : ''}`}>
          {currentPlan === 'pro' && <div className="active-badge pro-active-badge">Active Plan</div>}
          {currentPlan !== 'pro' && <div className="card-badge">Most Popular</div>}
          <div className="card-header">
            <h3>Pro Plan</h3>
            <div className="price">₹199</div>
            <p className="price-detail">per month</p>
          </div>
          <div className="card-body">
            <ul>
              <li>✓ <strong>Unlimited</strong> resets</li>
              <li>✓ Real-time Supabase sync</li>
              <li>✓ Advanced Llama 3.3 suggestions</li>
              <li>✓ Premium analytics & calendars</li>
            </ul>
          </div>
          <button 
            className="btn btn-primary btn-sm btn-full" 
            onClick={handleUpgradePro}
            disabled={loading || currentPlan === 'pro'}
          >
            {currentPlan === 'pro' ? 'Active' : loading ? 'Processing...' : 'Upgrade to Pro'}
          </button>
        </div>

        {/* Team Tier */}
        <div className={`pricing-card ${currentPlan === 'team' ? 'active-plan-card' : ''}`}>
          {currentPlan === 'team' && <div className="active-badge team-active-badge">Active Plan</div>}
          <div className="card-header">
            <h3>Team Plan</h3>
            <div className="price">₹50</div>
            <p className="price-detail">per user / month</p>
          </div>
          <div className="card-body">
            <div className="team-size-selector">
              <label htmlFor="team-users-qty">Team members (min 5):</label>
              <div className="counter-controls">
                <button 
                  type="button" 
                  onClick={() => setTeamUsers(prev => Math.max(5, prev - 1))}
                  aria-label="Decrease team size"
                >-</button>
                <input 
                  id="team-users-qty"
                  type="number" 
                  value={teamUsers} 
                  min="5" 
                  onChange={e => setTeamUsers(Math.max(5, parseInt(e.target.value) || 5))}
                />
                <button 
                  type="button" 
                  onClick={() => setTeamUsers(prev => prev + 1)}
                  aria-label="Increase team size"
                >+</button>
              </div>
              <div className="team-total">Total: <strong>₹{teamUsers * 50}</strong> / month</div>
            </div>
            <ul>
              <li>✓ Everything in Pro</li>
              <li>✓ Team-wide dashboard</li>
              <li>✓ Shared integrations</li>
              <li>✓ Priority support</li>
            </ul>
          </div>
          <button 
            className="btn btn-success btn-sm btn-full"
            onClick={handleUpgradeTeam}
            disabled={loading || currentPlan === 'team'}
          >
            {currentPlan === 'team' ? 'Active' : loading ? 'Processing...' : `Upgrade for ${teamUsers} users`}
          </button>
        </div>
      </div>

      <style>{`
        .upgrade-page {
          padding-top: var(--space-2xl);
          padding-bottom: var(--space-2xl);
          display: flex;
          flex-direction: column;
          gap: 40px;
        }

        .upgrade-header {
          text-align: center;
          max-width: 700px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .upgrade-badge {
          display: inline-block;
          margin: 0 auto;
          background: rgba(232, 93, 38, 0.1);
          color: var(--color-accent);
          padding: 4px 12px;
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .upgrade-header h1 {
          font-family: var(--font-display);
          font-size: 3rem;
          margin-top: 4px;
        }

        .upgrade-error-banner {
          font-size: 0.9rem;
          color: #c44d1e;
          background: rgba(196, 77, 30, 0.06);
          padding: 12px 16px;
          border-radius: var(--radius-md);
          border-left: 4px solid #c44d1e;
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
        }

        .upgrade-success-banner {
          font-size: 0.9rem;
          color: var(--color-success);
          background: rgba(45, 110, 78, 0.06);
          padding: 12px 16px;
          border-radius: var(--radius-md);
          border-left: 4px solid var(--color-success);
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
        }

        .pricing-tiers {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 28px;
          width: 100%;
        }

        .pricing-card {
          background: var(--color-bg-card);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 32px 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          position: relative;
          transition: transform var(--transition-normal), box-shadow var(--transition-normal);
        }

        .pricing-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
          border-color: var(--color-border-dark);
        }

        .card-pro {
          border-color: var(--color-accent);
          box-shadow: var(--shadow-sm);
        }

        .card-pro:hover {
          border-color: var(--color-accent-dark);
          box-shadow: var(--shadow-md);
        }

        .active-plan-card {
          border: 2px solid var(--color-success) !important;
          background: rgba(45, 110, 78, 0.01);
        }

        .active-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--color-success);
          color: #fff;
          padding: 4px 12px;
          border-radius: var(--radius-full);
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .pro-active-badge, .team-active-badge {
          background: var(--color-success);
        }

        .card-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--color-accent);
          color: #fff;
          padding: 4px 12px;
          border-radius: var(--radius-full);
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
        }

        .card-header {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .card-header h3 {
          font-size: 1.5rem;
        }

        .price {
          font-family: var(--font-display);
          font-size: 3rem;
          font-weight: 700;
          color: var(--color-text);
          line-height: 1.1;
          margin-top: 4px;
        }

        .price-detail {
          font-size: 0.8rem;
          color: var(--color-muted);
        }

        .card-body {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .card-body ul {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 12px;
          font-size: 0.9rem;
          color: var(--color-muted);
        }

        .card-body strong {
          color: var(--color-text);
        }

        .btn-full {
          width: 100%;
          justify-content: center;
        }

        .team-size-selector {
          background: rgba(26, 20, 16, 0.03);
          border-radius: var(--radius-md);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .team-size-selector label {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-muted);
        }

        .counter-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .counter-controls button {
          width: 30px;
          height: 30px;
          border: 1.5px solid var(--color-border);
          background: var(--color-bg-card);
          color: var(--color-text);
          border-radius: var(--radius-sm);
          font-size: 1.15rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background var(--transition-fast);
        }

        .counter-controls button:hover {
          background: var(--color-border);
        }

        .counter-controls input {
          width: 55px;
          height: 30px;
          text-align: center;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-family: var(--font-body);
          font-size: 0.95rem;
          background: var(--color-bg-card);
          color: var(--color-text);
        }

        .team-total {
          font-size: 0.82rem;
          color: var(--color-muted);
          margin-top: 4px;
        }

        .animate-fade-in {
          animation: fadeIn 400ms ease-out forwards;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.98) translateY(12px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
