import { useState } from 'react'
import { loadRazorpayScript, updateUserPlan } from '../services/paywallService'
import { useAuth } from '../contexts/AuthContext'

export default function PricingModal({ isOpen, onClose, currentCount = 0, onSuccess }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [teamUsers, setTeamUsers] = useState(5) // default min 5

  if (!isOpen) return null

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
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=128&h=128&q=80', // elegant abstract icon
      handler: async function (response) {
        try {
          setLoading(true)
          if (response.razorpay_payment_id) {
            const success = await updateUserPlan(user.id, 'pro')
            if (success) {
              if (onSuccess) onSuccess('pro')
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
        color: '#e85d26', // FocusReset orange accent
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
      image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=128&h=128&q=80', // team work icon
      handler: async function (response) {
        try {
          setLoading(true)
          if (response.razorpay_payment_id) {
            const success = await updateUserPlan(user.id, 'team')
            if (success) {
              if (onSuccess) onSuccess('team')
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
        color: '#2d6e4e', // FocusReset green success
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
    <div className="pricing-modal-overlay" role="dialog" aria-modal="true">
      <div className="pricing-modal-content animate-fade-in">
        <button className="pricing-modal-close" onClick={onClose} aria-label="Close pricing modal">×</button>
        
        <div className="pricing-modal-header">
          <span className="pricing-modal-badge">Monthly Limit Reached</span>
          <h2>Unlock FocusReset</h2>
          <p>
            You have used <strong>{currentCount}</strong> of your 100 free resets this calendar month. 
            Upgrade to keep recovering from draining meetings.
          </p>
        </div>

        {error && <div className="pricing-modal-error">⚠ {error}</div>}

        <div className="pricing-tiers">
          {/* Free Tier */}
          <div className="pricing-card">
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
              Current Plan
            </button>
          </div>

          {/* Pro Tier */}
          <div className="pricing-card card-pro">
            <div className="card-badge">Most Popular</div>
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
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Upgrade to Pro'}
            </button>
          </div>

          {/* Team Tier */}
          <div className="pricing-card">
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
              disabled={loading}
            >
              {loading ? 'Processing...' : `Upgrade for ${teamUsers} users`}
            </button>
          </div>
        </div>

        <div className="pricing-modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Back to Dashboard
          </button>
        </div>
      </div>

      <style>{`
        .pricing-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(26, 20, 16, 0.6);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 24px;
          overflow-y: auto;
        }

        .pricing-modal-content {
          width: 100%;
          max-width: 900px;
          background: var(--color-bg-card);
          padding: 40px;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          gap: 28px;
          position: relative;
          border: 1.5px solid var(--color-border);
        }

        .pricing-modal-close {
          position: absolute;
          top: 20px;
          right: 24px;
          background: none;
          border: none;
          font-size: 2.2rem;
          cursor: pointer;
          color: var(--color-muted);
          line-height: 1;
          transition: color var(--transition-fast);
        }

        .pricing-modal-close:hover {
          color: var(--color-text);
        }

        .pricing-modal-header {
          text-align: center;
          max-width: 600px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pricing-modal-badge {
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

        .pricing-modal-header h2 {
          font-family: var(--font-display);
          font-size: 2.5rem;
          margin-top: 4px;
        }

        .pricing-modal-error {
          font-size: 0.88rem;
          color: #c44d1e;
          background: rgba(196, 77, 30, 0.06);
          padding: 12px 16px;
          border-radius: var(--radius-md);
          border-left: 4px solid #c44d1e;
          text-align: left;
        }

        .pricing-tiers {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          width: 100%;
        }

        .pricing-card {
          background: var(--color-bg);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          position: relative;
          transition: transform var(--transition-normal), box-shadow var(--transition-normal);
        }

        .pricing-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
          border-color: var(--color-border-dark);
        }

        .card-pro {
          background: var(--color-bg-card);
          border-color: var(--color-accent);
        }

        .card-pro:hover {
          border-color: var(--color-accent-dark);
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
          font-size: 1.4rem;
        }

        .price {
          font-family: var(--font-display);
          font-size: 2.8rem;
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
          gap: 16px;
        }

        .card-body ul {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: 0.88rem;
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
          width: 28px;
          height: 28px;
          border: 1.5px solid var(--color-border);
          background: var(--color-bg-card);
          color: var(--color-text);
          border-radius: var(--radius-sm);
          font-size: 1.1rem;
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
          width: 50px;
          height: 28px;
          text-align: center;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-family: var(--font-body);
          font-size: 0.9rem;
          background: var(--color-bg-card);
          color: var(--color-text);
        }

        .team-total {
          font-size: 0.8rem;
          color: var(--color-muted);
          margin-top: 4px;
        }

        .pricing-modal-footer {
          margin-top: 8px;
          display: flex;
          justify-content: center;
        }

        /* Animation */
        .animate-fade-in {
          animation: fadeIn 300ms ease-out forwards;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.97) translateY(10px);
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
