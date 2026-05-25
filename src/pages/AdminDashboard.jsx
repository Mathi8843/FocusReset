import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from '../services/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { getProfile } from '../utils/storage'

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Authentication & Gating States
  const [profile, setProfile] = useState(null)
  const [team, setTeam] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  // Team Admin Data States
  const [members, setMembers] = useState([])
  const [invitations, setInvitations] = useState([])
  const [sessions, setSessions] = useState([])
  const [chartData, setChartData] = useState([])

  // UI / Action States
  const [newTeamName, setNewTeamName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteSuccessLink, setInviteSuccessLink] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState('')

  // 1. Initial Access Gating Checks
  useEffect(() => {
    if (!user) return

    async function checkAccess() {
      try {
        setLoading(true)
        const userProfile = await getProfile()
        setProfile(userProfile)

        // Query team memberships for this user
        const { data: memberRows, error } = await supabase
          .from('team_members')
          .select(`
            role,
            team_id,
            teams (
              id,
              name,
              admin_id,
              plan,
              seat_count,
              created_at
            )
          `)
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) throw error

        if (memberRows) {
          setTeam(memberRows.teams)
          setUserRole(memberRows.role)
          
          if (memberRows.role === 'admin') {
            await loadTeamData(memberRows.team_id, memberRows.teams.seat_count)
          }
        }
      } catch (err) {
        console.error('[AdminDashboard] Access check failed:', err)
      } finally {
        setLoading(false)
      }
    }

    checkAccess()
  }, [user])

  // 2. Load B2B Team Details
  async function loadTeamData(teamId, seatCount) {
    try {
      // A. Fetch team members linked with profiles
      const { data: memberList, error: memberErr } = await supabase
        .from('team_members')
        .select(`
          user_id,
          role,
          joined_at
        `)
        .eq('team_id', teamId)

      if (memberErr) throw memberErr

      // Fetch user profile info (names/roles) for all team members
      const memberIds = memberList.map(m => m.user_id)
      const { data: profilesList, error: profileErr } = await supabase
        .from('profiles')
        .select('id, name, role')
        .in('id', memberIds)

      if (profileErr) throw profileErr

      // Fetch pending invitations
      const { data: inviteList, error: inviteErr } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('team_id', teamId)

      if (inviteErr) throw inviteErr
      setInvitations(inviteList || [])

      // Fetch sessions in the last 30 days for team members
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 30)
      const { data: sessionList, error: sessionErr } = await supabase
        .from('sessions')
        .select('user_id, created_at, focus_minutes, completed')
        .in('user_id', memberIds)
        .gte('created_at', cutoff.toISOString())

      if (sessionErr) throw sessionErr
      setSessions(sessionList || [])

      // Join members & profiles locally
      const enrichedMembers = memberList.map(m => {
        const p = profilesList.find(prof => prof.id === m.user_id)
        
        // Count member sessions in the last 7 days
        const startOfWeek = new Date()
        startOfWeek.setDate(startOfWeek.getDate() - 7)
        const weeklySessionCount = (sessionList || []).filter(
          s => s.user_id === m.user_id && s.completed && new Date(s.created_at) >= startOfWeek
        ).length

        return {
          userId: m.user_id,
          name: p?.name || 'New Member',
          userRole: p?.role || 'Contributor',
          teamRole: m.role,
          joinedAt: m.joined_at,
          weeklySessions: weeklySessionCount
        }
      })
      setMembers(enrichedMembers)

      // B. Compute Weekly Chart Data (Focus minutes per day)
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const now = new Date()
      const dayOfWeek = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
      monday.setHours(0, 0, 0, 0)

      const dailySums = days.map((day, index) => {
        const d = new Date(monday)
        d.setDate(monday.getDate() + index)
        const dateString = d.toISOString().slice(0, 10)

        // Sum minutes for this date across the team
        const totalMinutes = (sessionList || []).reduce((sum, s) => {
          const sDate = new Date(s.created_at).toISOString().slice(0, 10)
          if (sDate === dateString) {
            return sum + (s.focus_minutes || 0)
          }
          return sum
        }, 0)

        return {
          label: day,
          minutes: totalMinutes,
          isToday: new Date().toISOString().slice(0, 10) === dateString
        }
      })
      setChartData(dailySums)

    } catch (err) {
      console.error('[AdminDashboard] Load team data error:', err)
    }
  }

  // 3. Create Team Handler
  async function handleCreateTeam(e) {
    e.preventDefault()
    if (!newTeamName.trim()) return

    try {
      setActionLoading(true)
      setError('')

      // Create team
      const { data: teamData, error: teamErr } = await supabase
        .from('teams')
        .insert({
          name: newTeamName.trim(),
          admin_id: user.id,
          plan: 'team',
          seat_count: 5
        })
        .select()
        .single()

      if (teamErr) throw teamErr

      // Add admin user as first member of team
      const { error: memberErr } = await supabase
        .from('team_members')
        .insert({
          team_id: teamData.id,
          user_id: user.id,
          role: 'admin'
        })

      if (memberErr) throw memberErr

      // Reload
      setTeam(teamData)
      setUserRole('admin')
      await loadTeamData(teamData.id, teamData.seat_count)
      setMessage('Team created successfully!')
    } catch (err) {
      console.error('[AdminDashboard] Create team failed:', err)
      setInviteError(err.message || 'Failed to create team.')
    } finally {
      setActionLoading(false)
    }
  }

  // 4. Invite Member Handler
  async function handleInviteMember(e) {
    e.preventDefault()
    setInviteError('')
    setInviteSuccessLink('')
    
    if (!inviteEmail.trim()) return

    const totalSeats = members.length + invitations.length
    if (totalSeats >= (team?.seat_count || 5)) {
      setInviteError(`Seat limit reached (${team?.seat_count} seats max). Remove members or upgrade your plan.`)
      return
    }

    try {
      setActionLoading(true)

      // 1. Create a pending invite in team_invitations
      const { error } = await supabase
        .from('team_invitations')
        .insert({
          team_id: team.id,
          email: inviteEmail.trim().toLowerCase(),
          role: 'member'
        })

      if (error) {
        if (error.code === '23505') {
          throw new Error('This user is already invited or a member of your team.')
        }
        throw error
      }

      // Generate join link
      const joinLink = `${window.location.origin}/register?email=${encodeURIComponent(inviteEmail.trim())}`
      setInviteSuccessLink(joinLink)
      setInviteEmail('')

      // Reload invitations list
      const { data: newInvites } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('team_id', team.id)
      setInvitations(newInvites || [])

    } catch (err) {
      console.error('[AdminDashboard] Invite failed:', err)
      setInviteError(err.message || 'Failed to invite user.')
    } finally {
      setActionLoading(false)
    }
  }

  // 5. Revoke Invitation Handler
  async function handleRevokeInvite(inviteId) {
    try {
      const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', inviteId)

      if (error) throw error

      setInvitations(prev => prev.filter(i => i.id !== inviteId))
    } catch (err) {
      console.error('[AdminDashboard] Revoke invite failed:', err)
    }
  }

  // 6. Loader View
  if (loading) {
    return (
      <div className="admin-page-loading">
        <p>Loading Admin Dashboard...</p>
      </div>
    )
  }

  // 7. Plan Check View: Plan is not 'team' AND they have no team
  if (!team && profile?.plan !== 'team') {
    return (
      <div className="admin-denied container card">
        <h2>Team Features Locked</h2>
        <p>The administration panel is reserved for B2B accounts. Access team analytics, member comparisons, and license distribution by upgrading to our Team plan.</p>
        <div style={{ marginTop: '20px' }}>
          <Link to="/dashboard">
            <button className="btn btn-primary">Go to Dashboard</button>
          </Link>
        </div>
      </div>
    )
  }

  // 8. Create Team View: Has upgraded to 'team' plan but hasn't created a team yet
  if (!team && profile?.plan === 'team') {
    return (
      <div className="admin-create container card">
        <h2>Setup Your B2B Team</h2>
        <p>You have unlocked B2B seat licenses! Choose a name for your organization to begin inviting members.</p>
        
        <form onSubmit={handleCreateTeam} style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label htmlFor="team-name-input">Organization / Team Name</label>
            <input 
              id="team-name-input"
              type="text" 
              placeholder="e.g. Acme Engineering" 
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={actionLoading}>
            {actionLoading ? 'Creating...' : 'Create Team & Claim Admin seat'}
          </button>
        </form>
      </div>
    )
  }

  // 9. Member Denied View: In a team but role is member
  if (userRole !== 'admin') {
    return (
      <div className="admin-denied container card">
        <h2>Access Denied</h2>
        <p>Only team administrators can access the admin dashboard. Contact your organization administrator to upgrade your access privileges.</p>
        <div style={{ marginTop: '20px' }}>
          <Link to="/dashboard">
            <button className="btn btn-primary">Go to Dashboard</button>
          </Link>
        </div>
      </div>
    )
  }

  // 10. Admin Dashboard Render
  const totalFocusMinutes = sessions.reduce((sum, s) => sum + (s.focus_minutes || 0), 0)
  const totalResets = sessions.filter(s => s.completed).length

  return (
    <div className="admin-dashboard-page container">
      <div className="admin-header">
        <div>
          <span className="badge badge-accent">B2B Admin Console</span>
          <h1>{team.name} Panel</h1>
          <p>Manage seats, view focus metrics, and invite team members.</p>
        </div>
      </div>

      {message && <div className="admin-success-banner">{message}</div>}

      {/* Grid of B2B statistics */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-val">{members.length} / {team.seat_count}</div>
            <div className="stat-lbl">Active Seats Used</div>
          </div>
        </div>
        <div className="admin-stat-card card">
          <div className="stat-icon">⏱</div>
          <div className="stat-content">
            <div className="stat-val">{Math.round(totalFocusMinutes / 60)}h</div>
            <div className="stat-lbl">Team Focus Recovered (30d)</div>
          </div>
        </div>
        <div className="admin-stat-card card">
          <div className="stat-icon">🔥</div>
          <div className="stat-content">
            <div className="stat-val">{totalResets}</div>
            <div className="stat-lbl">Completed Resets (30d)</div>
          </div>
        </div>
      </div>

      {/* Dashboard Analytics & invite split */}
      <div className="admin-main-grid">
        {/* Left Side: Chart & Members List */}
        <div className="admin-left-col">
          {/* Daily team focus minutes Recharts Bar Chart */}
          <div className="card">
            <h2 className="section-title">Weekly Team Focus</h2>
            <p className="section-sub">Total focus minutes recovered daily across the organization</p>
            <div style={{ marginTop: '20px' }}>
              {chartData.length === 0 ? (
                <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)' }}>
                  Loading focus trends...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }} barCategoryGap="25%">
                    <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontFamily: 'Syne,sans-serif', fontSize: 12, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 11, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(212,201,184,0.25)' }} 
                      contentStyle={{ background: 'var(--color-bg-card)', border: '1.5px solid var(--color-border)', borderRadius: '6px', fontFamily: 'Syne' }}
                    />
                    <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={
                          entry.isToday ? 'var(--color-accent)' :
                          entry.minutes > 0 ? 'rgba(45, 110, 78, 0.7)' : 'var(--color-border)'
                        } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Members Table */}
          <div className="card">
            <h2 className="section-title">Active Team Members</h2>
            <p className="section-sub">A list of registered developers and their session engagement</p>
            
            <div className="members-table-wrapper" style={{ marginTop: '20px' }}>
              <table className="members-table">
                <thead>
                  <tr>
                    <th>Developer</th>
                    <th>Role</th>
                    <th>Engagement</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(member => (
                    <tr key={member.userId}>
                      <td>
                        <strong className="member-name">{member.name}</strong>
                      </td>
                      <td>
                        <span className={`member-role ${member.teamRole === 'admin' ? 'role-admin' : 'role-member'}`}>
                          {member.teamRole}
                        </span>
                      </td>
                      <td>
                        <span className="member-engagement">
                          ⚡ {member.weeklySessions} resets this week
                        </span>
                      </td>
                      <td>
                        <span className="member-joined">
                          {new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Invites & Actions */}
        <div className="admin-right-col">
          {/* Invite Member form */}
          <div className="card">
            <h2 className="section-title">Add Team Member</h2>
            <p className="section-sub">Allocate an active seat to a teammate</p>

            <form onSubmit={handleInviteMember} style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label htmlFor="invite-email-input">Teammate Email Address</label>
                <input 
                  id="invite-email-input"
                  type="email" 
                  placeholder="name@company.com" 
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                />
              </div>

              {inviteError && <div className="admin-error-text">⚠ {inviteError}</div>}

              <button type="submit" className="btn btn-primary btn-sm btn-full" disabled={actionLoading}>
                {actionLoading ? 'Inviting...' : 'Send Sign Up Invite'}
              </button>
            </form>

            {inviteSuccessLink && (
              <div className="invite-link-banner">
                <p>🚀 <strong>Seat reserved!</strong> Share this setup link with your teammate:</p>
                <input 
                  type="text" 
                  readOnly 
                  value={inviteSuccessLink} 
                  onClick={e => e.target.select()}
                  title="Click to select all text"
                />
                <button 
                  className="btn btn-ghost btn-sm btn-full" 
                  style={{ marginTop: '8px' }}
                  onClick={() => {
                    navigator.clipboard.writeText(inviteSuccessLink)
                    setMessage('Invitation link copied to clipboard!')
                    setTimeout(() => setMessage(''), 3000)
                  }}
                >
                  Copy Link
                </button>
              </div>
            )}
          </div>

          {/* Pending Invitations list */}
          <div className="card">
            <h2 className="section-title">Pending Invitations</h2>
            <p className="section-sub">Outstanding invites waiting for account onboarding</p>
            
            <div className="pending-list" style={{ marginTop: '16px' }}>
              {invitations.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>
                  No pending invites.
                </div>
              ) : (
                invitations.map(invite => (
                  <div key={invite.id} className="pending-invite-row">
                    <div className="pending-info">
                      <span className="pending-email">{invite.email}</span>
                      <span className="pending-date">
                        Invited: {new Date(invite.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <button 
                      className="revoke-btn" 
                      onClick={() => handleRevokeInvite(invite.id)}
                      title="Revoke seat reservation"
                    >
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .admin-dashboard-page {
          padding-top: var(--space-xl);
          padding-bottom: var(--space-xl);
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .admin-header h1 {
          font-family: var(--font-display);
          font-size: 2.8rem;
          margin-top: 4px;
        }

        .admin-page-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 50vh;
          color: var(--color-muted);
          font-family: var(--font-body);
        }

        .admin-denied, .admin-create {
          max-width: 500px;
          margin: 60px auto;
          text-align: center;
          padding: 40px;
        }

        .admin-denied h2, .admin-create h2 {
          font-family: var(--font-display);
          font-size: 2rem;
          margin-bottom: 12px;
        }

        .admin-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
        }

        .admin-stat-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 24px;
        }

        .stat-icon {
          font-size: 2.2rem;
          opacity: 0.85;
        }

        .stat-val {
          font-family: var(--font-display);
          font-size: 2.4rem;
          font-weight: 700;
          line-height: 1.1;
        }

        .stat-lbl {
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-muted);
          font-weight: 700;
          margin-top: 2px;
        }

        .admin-main-grid {
          display: grid;
          grid-template-columns: 1.8fr 1.2fr;
          gap: 28px;
        }

        @media (max-width: 900px) {
          .admin-main-grid {
            grid-template-columns: 1fr;
          }
        }

        .admin-left-col, .admin-right-col {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .section-title {
          font-family: var(--font-display);
          font-size: 1.6rem;
        }

        .section-sub {
          font-size: 0.8rem;
          color: var(--color-muted);
          margin-top: 2px;
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

        .members-table-wrapper {
          overflow-x: auto;
        }

        .members-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.9rem;
        }

        .members-table th {
          border-bottom: 1.5px solid var(--color-border-dark);
          padding: 10px 12px;
          font-weight: 700;
          color: var(--color-text);
        }

        .members-table td {
          border-bottom: 1px solid var(--color-border);
          padding: 14px 12px;
          vertical-align: middle;
        }

        .member-name {
          color: var(--color-text);
        }

        .member-role {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: var(--radius-sm);
        }

        .role-admin {
          background: rgba(232, 93, 38, 0.1);
          color: var(--color-accent);
        }

        .role-member {
          background: rgba(107, 95, 82, 0.1);
          color: var(--color-muted);
        }

        .member-engagement {
          font-size: 0.85rem;
          color: var(--color-muted);
        }

        .member-joined {
          font-size: 0.8rem;
          color: var(--color-muted);
        }

        .admin-error-text {
          font-size: 0.8rem;
          color: #c44d1e;
          background: rgba(196,77,30,0.06);
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          border-left: 3px solid #c44d1e;
        }

        .invite-link-banner {
          background: rgba(45, 110, 78, 0.05);
          border: 1px solid rgba(45, 110, 78, 0.25);
          padding: 16px;
          border-radius: var(--radius-md);
          margin-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .invite-link-banner p {
          font-size: 0.8rem;
          color: var(--color-success);
        }

        .invite-link-banner input {
          width: 100%;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          padding: 8px;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          border-radius: var(--radius-sm);
        }

        .pending-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .pending-invite-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: var(--color-bg);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
        }

        .pending-email {
          font-weight: 600;
          font-size: 0.85rem;
          display: block;
        }

        .pending-date {
          font-size: 0.72rem;
          color: var(--color-muted);
        }

        .revoke-btn {
          background: none;
          border: none;
          color: #c44d1e;
          font-size: 0.8rem;
          cursor: pointer;
          font-family: var(--font-body);
          font-weight: 600;
        }

        .revoke-btn:hover {
          text-decoration: underline;
        }

        .admin-success-banner {
          background: rgba(45, 110, 78, 0.1);
          color: var(--color-success);
          border-left: 4px solid var(--color-success);
          padding: 12px 16px;
          font-size: 0.9rem;
          border-radius: var(--radius-sm);
        }
      `}</style>
    </div>
  )
}
