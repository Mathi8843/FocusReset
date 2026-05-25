import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, saveProfile } from '../utils/storage'
import { useAuth } from '../contexts/AuthContext'

// Selectable developer tools
const AVAILABLE_TOOLS = [
  { id: 'vscode', name: 'VS Code', icon: '💻' },
  { id: 'slack', name: 'Slack', icon: '💬' },
  { id: 'github', name: 'GitHub', icon: '🐙' },
  { id: 'jira', name: 'Jira', icon: '📋' },
  { id: 'notion', name: 'Notion', icon: '📝' },
  { id: 'linear', name: 'Linear', icon: '📊' },
  { id: 'outlook', name: 'Outlook', icon: '📧' }
]

// Professional roles with icons and descriptions
const AVAILABLE_ROLES = [
  { id: 'developer', name: 'Developer / Engineer', icon: '💻', desc: 'Coding & system architecture' },
  { id: 'designer', name: 'Designer / Creative', icon: '🎨', desc: 'UI/UX & brand design' },
  { id: 'manager', name: 'Manager / Team Lead', icon: '💼', desc: 'Coordination & management' },
  { id: 'writer', name: 'Writer / Content', icon: '✍️', desc: 'Copywriting & documentation' },
  { id: 'analyst', name: 'Analyst / Data', icon: '📊', desc: 'Research & business analytics' },
  { id: 'other', name: 'Knowledge Worker', icon: '🧠', desc: 'General administration' }
]

// Focus peak slots
const AVAILABLE_PEAKS = [
  { id: 'morning', name: 'Morning', time: '8 AM - 12 PM', icon: '🌅' },
  { id: 'afternoon', name: 'Afternoon', time: '12 PM - 5 PM', icon: '☀️' },
  { id: 'evening', name: 'Evening', time: '5 PM - 10 PM', icon: '🌙' }
]

// Meeting quantities per day
const AVAILABLE_MEETINGS = [
  { id: '1-2', name: '1 - 2 Meetings', level: 'Light', icon: '🟢' },
  { id: '3-4', name: '3 - 4 Meetings', level: 'Moderate', icon: '🟡' },
  { id: '5+', name: '5+ Meetings', level: 'Heavy Drain', icon: '🔴' }
]

export default function Profile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const lastProjectRef = useRef(null)

  // Form states
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [focusPeak, setFocusPeak] = useState('')
  const [meetingsPerDay, setMeetingsPerDay] = useState('')
  const [selectedTools, setSelectedTools] = useState([])
  const [projects, setProjects] = useState([])
  const [plan, setPlan] = useState('free')

  // UI States
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [activeTab, setActiveTab] = useState('identity')

  // Fetch initial profile
  useEffect(() => {
    if (!user) return
    
    async function loadProfile() {
      try {
        setLoading(true)
        const profileData = await getProfile()
        if (profileData) {
          setName(profileData.name || '')
          setRole(profileData.role || 'developer')
          setFocusPeak(profileData.focusPeak || 'morning')
          setMeetingsPerDay(profileData.meetingsPerDay || '3-4')
          setSelectedTools(profileData.tools || [])
          setProjects(profileData.projects || [])
          setPlan(profileData.plan || 'free')
        }
      } catch (err) {
        console.error('[Profile] Failed to load user profile:', err)
        setErrorMsg('Failed to load profile details. Running with local cache.')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [user])

  // Toggle selected tool
  function handleToggleTool(toolId) {
    setSelectedTools(prev => 
      prev.includes(toolId) 
        ? prev.filter(id => id !== toolId) 
        : [...prev, toolId]
    )
  }

  // Dynamic project list actions
  function handleAddProject() {
    setProjects(prev => [...prev, ''])
    // Focus new input in next tick
    setTimeout(() => {
      if (lastProjectRef.current) {
        lastProjectRef.current.focus()
      }
    }, 50)
  }

  function handleProjectChange(index, value) {
    setProjects(prev => {
      const updated = [...prev]
      updated[index] = value
      return updated
    })
  }

  function handleRemoveProject(index) {
    setProjects(prev => prev.filter((_, i) => i !== index))
  }

  // Submit form data
  async function handleSubmit(e) {
    if (e) e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    
    if (!name.trim()) {
      setErrorMsg('A profile name is required.')
      return
    }

    setSaving(true)
    const cleanProjects = projects.filter(p => p.trim() !== '')

    const updatedProfile = {
      name: name.trim(),
      role,
      tools: selectedTools,
      projects: cleanProjects,
      focusPeak,
      meetingsPerDay,
      plan,
      onboardingCompleted: true,
      onboardingDate: new Date().toISOString()
    }

    try {
      await saveProfile(updatedProfile)
      setProjects(cleanProjects)
      setSuccessMsg('Profile changes saved successfully!')
      
      // Auto-clear success message
      setTimeout(() => {
        setSuccessMsg('')
      }, 4000)
    } catch (err) {
      console.error('[Profile] Save failed:', err)
      setErrorMsg('Failed to update your details. Working in offline mode.')
    } finally {
      setSaving(false)
    }
  }

  // User Initials for Avatar
  const getInitials = () => {
    if (name) {
      return name.trim().slice(0, 2).toUpperCase()
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase()
    }
    return 'FR'
  }

  if (loading) {
    return (
      <div className="profile-loading-screen">
        <div className="spinner-ring"></div>
        <p>Retrieving your focus metrics...</p>
      </div>
    )
  }

  return (
    <div className="profile-dashboard-layout container-wide animate-fade-in">
      
      {/* 1. SIDEBAR COLUMN */}
      <aside className="profile-sidebar">
        
        {/* User Card */}
        <div className="sidebar-card user-overview-card">
          <div className="avatar-circle-gradient">
            <span className="avatar-initials">{getInitials()}</span>
            <div className="online-indicator"></div>
          </div>
          
          <div className="user-info-text">
            <h3>{name || 'Focus Creator'}</h3>
            <p className="user-email">{user?.email}</p>
            <span className={`pill-badge badge-${plan}`}>
              {plan === 'pro' ? '★ Pro Unlimited' : plan === 'team' ? '👥 Team Plan' : 'Free Trial'}
            </span>
          </div>

          <div className="divider-line"></div>

          <div className="sidebar-stats">
            <div className="sidebar-stat-item">
              <span className="stat-num">{selectedTools.length}</span>
              <span className="stat-lbl">Tools</span>
            </div>
            <div className="sidebar-stat-item">
              <span className="stat-num">{projects.length}</span>
              <span className="stat-lbl">Projects</span>
            </div>
          </div>
        </div>

        {/* Dynamic Navigation Tabs */}
        <div className="sidebar-card nav-tabs-card">
          <button 
            type="button" 
            className={`tab-link-btn ${activeTab === 'identity' ? 'tab-link-active' : ''}`}
            onClick={() => setActiveTab('identity')}
          >
            <span className="tab-link-icon">👤</span>
            Identity Details
          </button>
          <button 
            type="button" 
            className={`tab-link-btn ${activeTab === 'focus' ? 'tab-link-active' : ''}`}
            onClick={() => setActiveTab('focus')}
          >
            <span className="tab-link-icon">⚡</span>
            Focus Configuration
          </button>
          <button 
            type="button" 
            className={`tab-link-btn ${activeTab === 'tools' ? 'tab-link-active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            <span className="tab-link-icon">🛠️</span>
            Tool Integrations
          </button>
          <button 
            type="button" 
            className={`tab-link-btn ${activeTab === 'projects' ? 'tab-link-active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            <span className="tab-link-icon">💼</span>
            Active Projects
          </button>
        </div>

        {/* Plan Upgrade CTA (Shown if user is Free) */}
        {plan === 'free' && (
          <div className="sidebar-card upgrade-banner-cta">
            <div className="cta-icon">✨</div>
            <h4>Supercharge Focus</h4>
            <p>Unlock team comparative metrics, unlimited daily resets, and premium calendar trackers.</p>
            <button 
              type="button" 
              className="btn btn-primary btn-sm btn-full"
              onClick={() => navigate('/upgrade')}
            >
              Upgrade Plan
            </button>
          </div>
        )}

        {/* Global Save Button (Sidebar Placement) */}
        <div className="sidebar-actions-sticky">
          <button 
            type="button" 
            className="btn btn-primary btn-lg btn-full btn-save-profile" 
            onClick={() => handleSubmit()}
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner-mini"></span>
                Saving Details...
              </>
            ) : 'Save All Settings'}
          </button>
          
          <button 
            type="button" 
            className="btn btn-ghost btn-sm btn-full" 
            onClick={() => navigate('/dashboard')}
          >
            Back to Dashboard
          </button>
        </div>
      </aside>

      {/* 2. MAIN SETTINGS FORMS */}
      <main className="profile-main-content">
        
        {/* Header Notification Banner */}
        {successMsg && (
          <div className="profile-toast toast-success animate-slide-in">
            <span className="toast-icon">🎉</span>
            <div className="toast-content">
              <strong>Success</strong>
              <p>{successMsg}</p>
            </div>
          </div>
        )}
        
        {errorMsg && (
          <div className="profile-toast toast-error animate-slide-in">
            <span className="toast-icon">⚠️</span>
            <div className="toast-content">
              <strong>Configuration Alert</strong>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        {/* IDENTITY TAB */}
        {activeTab === 'identity' && (
          <div className="card settings-panel-card animate-tab-fade">
            <div className="panel-header">
              <h2>Identity Details</h2>
              <p>Configure how you appear inside the FocusReset app and team dashboards.</p>
            </div>

            <div className="panel-body">
              <div className="form-group-custom">
                <label htmlFor="name-input">Preferred Name</label>
                <div className="input-with-icon">
                  <span className="input-icon">👤</span>
                  <input 
                    id="name-input"
                    type="text" 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter your name (e.g. Mathi)"
                    required
                  />
                </div>
                <p className="field-hint">Used in team notifications and daily welcoming greetings.</p>
              </div>

              <div className="form-group-custom">
                <label>Professional Role</label>
                <p className="field-hint">Select the profile role that closest aligns with your daily cognitive work.</p>
                
                <div className="role-cards-grid">
                  {AVAILABLE_ROLES.map(r => {
                    const isSelected = role === r.id
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={`role-select-card ${isSelected ? 'role-card-active' : ''}`}
                        onClick={() => setRole(r.id)}
                      >
                        <div className="role-card-header">
                          <span className="role-icon">{r.icon}</span>
                          {isSelected && <span className="selected-indicator">✓</span>}
                        </div>
                        <strong>{r.name}</strong>
                        <p>{r.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FOCUS TAB */}
        {activeTab === 'focus' && (
          <div className="card settings-panel-card animate-tab-fade">
            <div className="panel-header">
              <h2>Focus Configuration</h2>
              <p>Tailor the AI reset suggestions to align with your natural circadian peaks and meeting load.</p>
            </div>

            <div className="panel-body">
              
              {/* Focus Peak Grid Selector */}
              <div className="form-group-custom">
                <label>Circadian Focus Peak</label>
                <p className="field-hint">When does your brain execute high-level focus tasks with peak performance?</p>
                
                <div className="circadian-grid">
                  {AVAILABLE_PEAKS.map(peak => {
                    const isSelected = focusPeak === peak.id
                    return (
                      <button
                        key={peak.id}
                        type="button"
                        className={`circadian-select-card ${isSelected ? 'circadian-card-active' : ''}`}
                        onClick={() => setFocusPeak(peak.id)}
                      >
                        <span className="circadian-icon">{peak.icon}</span>
                        <div className="circadian-text">
                          <strong>{peak.name}</strong>
                          <span>{peak.time}</span>
                        </div>
                        {isSelected && <span className="checkmark-bubble">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="divider-line"></div>

              {/* Meetings Load Card Selector */}
              <div className="form-group-custom" style={{ marginTop: '20px' }}>
                <label>Daily Meeting Frequency</label>
                <p className="field-hint">Your average daily scheduled meetings. Used to calibrate cognitive hangover metrics.</p>
                
                <div className="meetings-grid">
                  {AVAILABLE_MEETINGS.map(meet => {
                    const isSelected = meetingsPerDay === meet.id
                    return (
                      <button
                        key={meet.id}
                        type="button"
                        className={`meeting-select-card ${isSelected ? `meeting-card-active-${meet.id}` : ''}`}
                        onClick={() => setMeetingsPerDay(meet.id)}
                      >
                        <span className="meeting-icon">{meet.icon}</span>
                        <div className="meeting-text">
                          <strong>{meet.name}</strong>
                          <span className={`drain-label level-${meet.id}`}>{meet.level}</span>
                        </div>
                        {isSelected && <span className="checkmark-bubble">✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* DAILY TOOLS TAB */}
        {activeTab === 'tools' && (
          <div className="card settings-panel-card animate-tab-fade">
            <div className="panel-header">
              <h2>Tool Integrations</h2>
              <p>Toggle the tools you rely on daily to fetch context and feed prioritizing AI resets.</p>
            </div>

            <div className="panel-body">
              <p className="tools-selection-summary">
                Selected tools will be highlighted in priority dashboards. Connect actual accounts via the Dashboard.
              </p>

              <div className="tools-selection-grid">
                {AVAILABLE_TOOLS.map(tool => {
                  const isSelected = selectedTools.includes(tool.id)
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      className={`tool-selection-card ${isSelected ? 'tool-card-active' : ''}`}
                      onClick={() => handleToggleTool(tool.id)}
                    >
                      <div className="tool-card-content">
                        <span className="tool-select-icon">{tool.icon}</span>
                        <strong>{tool.name}</strong>
                      </div>
                      <div className={`checkbox-circle ${isSelected ? 'checkbox-active' : ''}`}>
                        {isSelected && '✓'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* PROJECTS LIST TAB */}
        {activeTab === 'projects' && (
          <div className="card settings-panel-card animate-tab-fade">
            <div className="panel-header">
              <h2>Active Projects</h2>
              <p>Add and manage current key work initiatives to target AI prioritisations.</p>
            </div>

            <div className="panel-body">
              {projects.length === 0 ? (
                <div className="empty-projects-state">
                  <div className="empty-icon">📁</div>
                  <h3>No Active Projects</h3>
                  <p>Add key project phrases so the AI can automatically group tasks and meetings.</p>
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm"
                    onClick={handleAddProject}
                  >
                    + Add Your First Project
                  </button>
                </div>
              ) : (
                <div className="projects-editor-wrapper">
                  <div className="projects-list-header">
                    <span>Project Name / Keyword</span>
                    <span>Action</span>
                  </div>

                  <div className="projects-interactive-list">
                    {projects.map((project, idx) => (
                      <div key={idx} className="project-editable-row animate-slide-in">
                        <span className="project-index-badge">{idx + 1}</span>
                        <div className="project-input-container">
                          <input 
                            type="text"
                            ref={idx === projects.length - 1 ? lastProjectRef : null}
                            value={project}
                            onChange={e => handleProjectChange(idx, e.target.value)}
                            placeholder="e.g. Migration to Supabase"
                            aria-label={`Project initiative ${idx + 1}`}
                          />
                        </div>
                        <button 
                          type="button" 
                          className="project-row-delete-btn"
                          onClick={() => handleRemoveProject(idx)}
                          aria-label={`Delete project ${project || idx + 1}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm add-project-trigger-btn"
                    onClick={handleAddProject}
                  >
                    + Add New Project Initiative
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* STYLING RULES */}
      <style>{`
        /* --- Layout Grid --- */
        .profile-dashboard-layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: var(--space-xl);
          padding-top: var(--space-xl);
          padding-bottom: var(--space-3xl);
          align-items: start;
        }

        @media (max-width: 960px) {
          .profile-dashboard-layout {
            grid-template-columns: 1fr;
            gap: var(--space-lg);
            padding-top: var(--space-md);
          }
        }

        /* --- Sidebar --- */
        .profile-sidebar {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        .sidebar-card {
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-lg);
          box-shadow: var(--shadow-sm);
        }

        .user-overview-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding-top: var(--space-xl);
        }

        .avatar-circle-gradient {
          width: 80px;
          height: 80px;
          border-radius: var(--radius-full);
          background: linear-gradient(135deg, var(--color-accent), #f7a988);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          box-shadow: 0 4px 12px rgba(232, 93, 38, 0.2);
          margin-bottom: var(--space-md);
        }

        .avatar-initials {
          font-family: var(--font-body);
          font-size: 1.8rem;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.02em;
        }

        .online-indicator {
          width: 14px;
          height: 14px;
          background: var(--color-success);
          border: 2px solid var(--color-bg-card);
          border-radius: var(--radius-full);
          position: absolute;
          bottom: 2px;
          right: 2px;
        }

        .user-info-text h3 {
          font-size: 1.6rem;
          font-family: var(--font-display);
          color: var(--color-text);
          margin-bottom: 2px;
        }

        .user-email {
          font-size: 0.8rem;
          color: var(--color-muted);
          margin-bottom: var(--space-sm);
          word-break: break-all;
        }

        .pill-badge {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 12px;
          border-radius: var(--radius-full);
          margin-top: 2px;
        }

        .badge-free {
          background: rgba(107, 95, 82, 0.1);
          color: var(--color-muted);
          border: 1px solid var(--color-border);
        }

        .badge-pro {
          background: rgba(232, 93, 38, 0.1);
          color: var(--color-accent);
          border: 1px solid rgba(232, 93, 38, 0.25);
        }

        .badge-team {
          background: rgba(45, 110, 78, 0.1);
          color: var(--color-success);
          border: 1px solid rgba(45, 110, 78, 0.25);
        }

        .divider-line {
          width: 100%;
          height: 1px;
          background: var(--color-border);
          margin: var(--space-md) 0;
          opacity: 0.7;
        }

        .sidebar-stats {
          display: flex;
          width: 100%;
          justify-content: space-around;
        }

        .sidebar-stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .sidebar-stat-item .stat-num {
          font-family: var(--font-display);
          font-size: 1.8rem;
          font-weight: 700;
          color: var(--color-text);
          line-height: 1;
        }

        .sidebar-stat-item .stat-lbl {
          font-size: 0.72rem;
          color: var(--color-muted);
          text-transform: uppercase;
          font-weight: 700;
        }

        /* --- Navigation Tabs --- */
        .nav-tabs-card {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: var(--space-sm);
        }

        .tab-link-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-body);
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--color-muted);
          cursor: pointer;
          text-align: left;
          transition: all var(--transition-fast);
        }

        .tab-link-btn:hover {
          background: rgba(107, 95, 82, 0.05);
          color: var(--color-text);
        }

        .tab-link-active {
          background: rgba(232, 93, 38, 0.08) !important;
          color: var(--color-accent) !important;
        }

        .tab-link-icon {
          font-size: 1.1rem;
        }

        /* --- Upgrade CTA Sidebar --- */
        .upgrade-banner-cta {
          background: linear-gradient(135deg, #fdfaf5, #fef6f1);
          border: 1.5px dashed var(--color-accent);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .upgrade-banner-cta .cta-icon {
          font-size: 2rem;
          line-height: 1;
        }

        .upgrade-banner-cta h4 {
          font-family: var(--font-display);
          font-size: 1.4rem;
          color: var(--color-text);
        }

        .upgrade-banner-cta p {
          font-size: 0.78rem;
          line-height: 1.4;
          color: var(--color-muted);
        }

        .sidebar-actions-sticky {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: var(--space-md);
        }

        .btn-full {
          width: 100%;
          justify-content: center;
        }

        /* --- Main Content Panel --- */
        .profile-main-content {
          display: flex;
          flex-direction: column;
          gap: var(--space-lg);
        }

        .settings-panel-card {
          padding: var(--space-xl);
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }

        .panel-header {
          border-bottom: 1px solid var(--color-border);
          padding-bottom: var(--space-md);
          margin-bottom: var(--space-lg);
        }

        .panel-header h2 {
          font-family: var(--font-display);
          font-size: 2.2rem;
          font-weight: 700;
          color: var(--color-text);
          margin-bottom: 4px;
        }

        .panel-header p {
          font-size: 0.9rem;
          color: var(--color-muted);
        }

        .panel-body {
          display: flex;
          flex-direction: column;
          gap: var(--space-lg);
        }

        /* --- Custom Form Layouts --- */
        .form-group-custom {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }

        .form-group-custom label {
          font-family: var(--font-body);
          font-weight: 800;
          font-size: 0.95rem;
          color: var(--color-text);
          letter-spacing: -0.01em;
        }

        .field-hint {
          font-size: 0.8rem;
          color: var(--color-muted);
          margin-top: -4px;
          line-height: 1.4;
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-with-icon .input-icon {
          position: absolute;
          left: 14px;
          font-size: 1.1rem;
          pointer-events: none;
          opacity: 0.8;
        }

        .input-with-icon input {
          padding-left: 44px !important;
          height: 48px;
        }

        /* --- Role Cards Grid (Tactile selection instead of dropdown) --- */
        .role-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: var(--space-md);
          margin-top: var(--space-sm);
        }

        .role-select-card {
          background: var(--color-bg-card);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-md);
          text-align: left;
          cursor: pointer;
          font-family: var(--font-body);
          transition: all var(--transition-fast);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .role-select-card:hover {
          border-color: var(--color-border-dark);
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }

        .role-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }

        .role-icon {
          font-size: 1.6rem;
          line-height: 1;
        }

        .selected-indicator {
          font-size: 0.8rem;
          font-weight: 800;
          color: #fff;
          background: var(--color-accent);
          width: 20px;
          height: 20px;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .role-select-card strong {
          font-size: 0.92rem;
          color: var(--color-text);
          font-weight: 700;
        }

        .role-select-card p {
          font-size: 0.75rem;
          line-height: 1.3;
          color: var(--color-muted);
        }

        .role-card-active {
          border-color: var(--color-accent) !important;
          background: rgba(232, 93, 38, 0.04) !important;
          box-shadow: 0 0 0 3px rgba(232, 93, 38, 0.1) !important;
        }

        /* --- Circadian Focus Peak Grid --- */
        .circadian-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: var(--space-md);
          margin-top: var(--space-sm);
        }

        .circadian-select-card {
          background: var(--color-bg-card);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 18px;
          display: flex;
          align-items: center;
          gap: var(--space-md);
          cursor: pointer;
          font-family: var(--font-body);
          text-align: left;
          position: relative;
          transition: all var(--transition-fast);
        }

        .circadian-select-card:hover {
          border-color: var(--color-border-dark);
          transform: translateY(-1px);
        }

        .circadian-icon {
          font-size: 2rem;
        }

        .circadian-text {
          display: flex;
          flex-direction: column;
        }

        .circadian-text strong {
          font-size: 0.95rem;
          color: var(--color-text);
        }

        .circadian-text span {
          font-size: 0.75rem;
          color: var(--color-muted);
        }

        .circadian-card-active {
          border-color: var(--color-accent) !important;
          background: rgba(232, 93, 38, 0.04) !important;
        }

        .checkmark-bubble {
          position: absolute;
          top: -8px;
          right: -8px;
          background: var(--color-accent);
          color: #fff;
          width: 20px;
          height: 20px;
          font-size: 0.75rem;
          font-weight: 800;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(232, 93, 38, 0.3);
        }

        /* --- Meetings Selection Grid --- */
        .meetings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: var(--space-md);
          margin-top: var(--space-sm);
        }

        .meeting-select-card {
          background: var(--color-bg-card);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 18px;
          display: flex;
          align-items: center;
          gap: var(--space-md);
          cursor: pointer;
          font-family: var(--font-body);
          text-align: left;
          position: relative;
          transition: all var(--transition-fast);
        }

        .meeting-select-card:hover {
          border-color: var(--color-border-dark);
          transform: translateY(-1px);
        }

        .meeting-icon {
          font-size: 1.4rem;
        }

        .meeting-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .meeting-text strong {
          font-size: 0.92rem;
          color: var(--color-text);
        }

        .drain-label {
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .drain-label.level-1-2 { color: var(--color-success); }
        .drain-label.level-3-4 { color: #d4a017; }
        .drain-label.level-5\+ { color: #c44d1e; }

        .meeting-card-active-1-2 {
          border-color: var(--color-success) !important;
          background: rgba(45, 110, 78, 0.04) !important;
        }
        .meeting-card-active-1-2 .checkmark-bubble {
          background: var(--color-success) !important;
          box-shadow: 0 2px 6px rgba(45, 110, 78, 0.3) !important;
        }

        .meeting-card-active-3-4 {
          border-color: #d4a017 !important;
          background: rgba(212, 160, 23, 0.04) !important;
        }
        .meeting-card-active-3-4 .checkmark-bubble {
          background: #d4a017 !important;
          box-shadow: 0 2px 6px rgba(212, 160, 23, 0.3) !important;
        }

        .meeting-card-active-5\+ {
          border-color: #c44d1e !important;
          background: rgba(196, 77, 30, 0.04) !important;
        }
        .meeting-card-active-5\+ .checkmark-bubble {
          background: #c44d1e !important;
          box-shadow: 0 2px 6px rgba(196, 77, 30, 0.3) !important;
        }

        /* --- Tools Grid --- */
        .tools-selection-summary {
          font-size: 0.85rem;
          color: var(--color-muted);
          margin-bottom: var(--space-sm);
        }

        .tools-selection-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: var(--space-md);
        }

        .tool-selection-card {
          background: var(--color-bg-card);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          font-family: var(--font-body);
          transition: all var(--transition-fast);
        }

        .tool-selection-card:hover {
          border-color: var(--color-border-dark);
          transform: translateY(-2px);
        }

        .tool-card-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .tool-select-icon {
          font-size: 1.4rem;
        }

        .tool-card-content strong {
          font-size: 0.92rem;
          color: var(--color-text);
        }

        .checkbox-circle {
          width: 20px;
          height: 20px;
          border-radius: var(--radius-full);
          border: 1.5px solid var(--color-border-dark);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.72rem;
          font-weight: 800;
          color: transparent;
          transition: all var(--transition-fast);
        }

        .tool-card-active {
          border-color: var(--color-accent) !important;
          background: rgba(232, 93, 38, 0.04) !important;
        }

        .checkbox-active {
          border-color: var(--color-accent) !important;
          background: var(--color-accent) !important;
          color: #fff !important;
        }

        /* --- Projects Interactive Editor --- */
        .empty-projects-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-2xl) var(--space-lg);
          border: 2.5px dashed var(--color-border);
          border-radius: var(--radius-lg);
          text-align: center;
          gap: 8px;
        }

        .empty-projects-state .empty-icon {
          font-size: 3rem;
          line-height: 1;
        }

        .empty-projects-state h3 {
          font-family: var(--font-display);
          font-size: 1.6rem;
          margin-top: 4px;
        }

        .empty-projects-state p {
          font-size: 0.85rem;
          max-width: 320px;
          margin-bottom: var(--space-md);
        }

        .projects-editor-wrapper {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
        }

        .projects-list-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          font-weight: 800;
          color: var(--color-muted);
          border-bottom: 1.5px solid var(--color-border);
          padding-bottom: 6px;
        }

        .projects-interactive-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .project-editable-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .project-index-badge {
          background: var(--color-border);
          color: var(--color-text);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          font-weight: 700;
          width: 24px;
          height: 24px;
          border-radius: var(--radius-full);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .project-input-container {
          flex-grow: 1;
        }

        .project-input-container input {
          height: 42px;
          padding: 8px 14px;
          font-size: 0.9rem;
        }

        .project-row-delete-btn {
          width: 36px;
          height: 36px;
          background: rgba(196, 77, 30, 0.05);
          border: 1px solid rgba(196, 77, 30, 0.1);
          color: #c44d1e;
          border-radius: var(--radius-md);
          font-size: 0.9rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
        }

        .project-row-delete-btn:hover {
          background: #c44d1e;
          color: #fff;
          border-color: #c44d1e;
        }

        .add-project-trigger-btn {
          align-self: flex-start;
          margin-top: 4px;
          padding: 8px 16px;
        }

        /* --- Toast Banner --- */
        .profile-toast {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px 20px;
          border-radius: var(--radius-lg);
          border-left: 5px solid transparent;
          margin-bottom: var(--space-md);
          box-shadow: var(--shadow-sm);
        }

        .toast-icon {
          font-size: 1.4rem;
          line-height: 1;
        }

        .toast-content strong {
          display: block;
          font-size: 0.9rem;
          color: var(--color-text);
        }

        .toast-content p {
          font-size: 0.8rem;
          color: var(--color-muted);
          line-height: 1.4;
          margin-top: 2px;
        }

        .toast-success {
          background: rgba(45, 110, 78, 0.06);
          border-color: var(--color-success);
        }

        .toast-error {
          background: rgba(196, 77, 30, 0.06);
          border-color: #c44d1e;
        }

        /* --- Loading State --- */
        .profile-loading-screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          gap: var(--space-md);
          color: var(--color-muted);
        }

        .spinner-ring {
          width: 40px;
          height: 40px;
          border: 3.5px solid var(--color-border);
          border-top: 3.5px solid var(--color-accent);
          border-radius: var(--radius-full);
          animation: spin 1s linear infinite;
        }

        .spinner-mini {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid transparent;
          border-top: 2px solid #fff;
          border-radius: var(--radius-full);
          animation: spin 0.6s linear infinite;
          margin-right: 6px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* --- Animations --- */
        .animate-fade-in {
          animation: pageFadeIn 450ms ease-out forwards;
        }

        .animate-tab-fade {
          animation: tabFadeIn 350ms ease-out forwards;
        }

        .animate-slide-in {
          animation: slideIn 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes pageFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes tabFadeIn {
          from { opacity: 0; transform: scale(0.99) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

    </div>
  )
}
