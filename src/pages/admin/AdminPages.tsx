import React, { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingSpinner } from '../../components/ui/Loading'
import { APP_CONFIG } from '../../config/app'
import { BookOpen, LayoutDashboard, Inbox, Tag, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react'
import type { RoleRequest, Role } from '../../types'
import { formatDate } from '../../lib/utils'

// -------------------------------------------------------------------------
// Admin Layout
// -------------------------------------------------------------------------
export function AdminLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Admin sidebar */}
      <aside style={{ width: '200px', borderRight: '1px solid var(--border-color)', background: 'var(--bg-surface)', padding: 'var(--space-6) var(--space-3)', flexShrink: 0, position: 'fixed', top: 0, bottom: 0, left: 'var(--sidebar-width)' }}>
        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', padding: '0 var(--space-2) var(--space-3)' }}>Admin</p>
        {[
          { label: 'Overview',      path: '/admin',               icon: <LayoutDashboard size={15} /> },
          { label: 'Role Requests', path: '/admin/role-requests', icon: <Inbox size={15} /> },
          { label: 'Roles',         path: '/admin/roles',         icon: <Tag size={15} /> },
        ].map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin'}
            className={({ isActive }) => `sidebar-nav__item ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </aside>
      {/* Admin content */}
      <div style={{ marginLeft: '200px', flex: 1, overflowX: 'hidden' }}>
        <Outlet />
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Admin Overview
// -------------------------------------------------------------------------
export function AdminOverviewPage() {
  const [stats, setStats] = useState({ students: 0, pendingRequests: 0, roles: 0 })

  useEffect(() => {
    async function load() {
      const [studentsRes, requestsRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'student'),
        supabase.from('role_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('roles').select('id', { count: 'exact', head: true }),
      ])
      setStats({
        students: studentsRes.count ?? 0,
        pendingRequests: requestsRes.count ?? 0,
        roles: rolesRes.count ?? 0,
      })
    }
    load()
  }, [])

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">Admin Overview</h1>
        <p className="page-header__subtitle">{APP_CONFIG.name} administration</p>
      </div>
      <div className="dashboard-grid dashboard-grid--3">
        {[
          { label: 'Students', value: stats.students },
          { label: 'Pending Role Requests', value: stats.pendingRequests },
          { label: 'Active Roles', value: stats.roles },
        ].map(s => (
          <div key={s.label} className="info-block">
            <div className="info-block__label">{s.label}</div>
            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'var(--space-6)', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
        <strong>First admin setup:</strong> Promote a user to admin by running in Supabase SQL Editor:<br />
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-accent-700)' }}>
          UPDATE public.profiles SET user_type = 'admin' WHERE id = '&lt;your-user-id&gt;';
        </code>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------------
// Admin Role Requests
// -------------------------------------------------------------------------
export function AdminRoleRequestsPage() {
  const { appUser } = useAuth()
  const { success, error: toastError } = useToast()
  const [requests, setRequests] = useState<RoleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RoleRequest | null>(null)
  const [note, setNote] = useState('')
  const [acting, setActing] = useState(false)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')

  const loadRequests = async () => {
    setLoading(true)
    let q = supabase.from('role_requests').select('*, profiles!role_requests_requester_user_id_fkey(full_name)').order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setRequests((data as RoleRequest[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadRequests() }, [filter])

  const handleAction = async (action: 'approved' | 'rejected') => {
    if (!selected) return
    setActing(true)
    const before = { ...selected }
    const { error } = await supabase.from('role_requests').update({
      status: action,
      admin_notes: note.trim() || null,
      reviewed_by: appUser!.auth.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', selected.id)

    if (error) { toastError('Action failed. Please try again.'); setActing(false); return }

    // Write audit log
    await supabase.from('audit_logs').insert({
      actor_user_id: appUser!.auth.id,
      action: `role_request.${action}`,
      entity_type: 'role_request',
      entity_id: selected.id,
      before_json: before,
      after_json: { ...before, status: action, admin_notes: note },
    })

    setActing(false)
    setSelected(null)
    setNote('')
    success(`Request ${action}.`)
    loadRequests()
  }

  const statusBadge = (status: string) => {
    if (status === 'pending')  return <Badge variant="warning"><Clock size={10} /> Pending</Badge>
    if (status === 'approved') return <Badge variant="success"><CheckCircle size={10} /> Approved</Badge>
    if (status === 'rejected') return <Badge variant="danger"><XCircle size={10} /> Rejected</Badge>
    return <Badge>{status}</Badge>
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">Role Requests</h1>
        <p className="page-header__subtitle">Review student-submitted role requests</p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        {(['pending','approved','rejected','all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`btn btn--sm btn--${filter === f ? 'primary' : 'secondary'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="section">
        {loading ? (
          <div style={{ padding: 'var(--space-8)', display: 'flex', justifyContent: 'center' }}><LoadingSpinner /></div>
        ) : requests.length === 0 ? (
          <EmptyState icon={<Inbox size={40} />} title="No requests" description={`No ${filter === 'all' ? '' : filter} role requests.`} />
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Role Requested</th>
                <th>Student</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map(req => (
                <tr key={req.id}>
                  <td style={{ fontWeight: 500 }}>{req.requested_role_name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{(req.profiles as { full_name?: string })?.full_name ?? '—'}</td>
                  <td>{statusBadge(req.status)}</td>
                  <td style={{ color: 'var(--text-tertiary)' }}>{formatDate(req.created_at)}</td>
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => { setSelected(req); setNote(req.admin_notes ?? '') }}>
                      <ExternalLink size={13} /> Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Review modal */}
      <Modal
        open={!!selected}
        onClose={() => { setSelected(null); setNote('') }}
        title="Review Role Request"
        footer={selected?.status === 'pending' ? (
          <>
            <Button variant="ghost" onClick={() => { setSelected(null); setNote('') }}>Cancel</Button>
            <Button variant="danger" onClick={() => handleAction('rejected')} loading={acting} id="admin-reject">Reject</Button>
            <Button onClick={() => handleAction('approved')} loading={acting} id="admin-approve">Approve</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
        )}
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Requested role</div>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>{selected.requested_role_name}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Status</div>
                <div style={{ marginTop: '4px' }}>{statusBadge(selected.status)}</div>
              </div>
            </div>
            {selected.description && (
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Description</div>
                <p style={{ fontSize: 'var(--text-sm)' }}>{selected.description}</p>
              </div>
            )}
            {selected.reason && (
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Reason</div>
                <p style={{ fontSize: 'var(--text-sm)' }}>{selected.reason}</p>
              </div>
            )}
            {selected.optional_skills && (
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Expected skills</div>
                <p style={{ fontSize: 'var(--text-sm)' }}>{selected.optional_skills}</p>
              </div>
            )}
            {selected.status === 'pending' && (
              <div className="form-group">
                <label className="form-label">Admin note (optional)</label>
                <textarea className="form-textarea" placeholder="Add a note for the student…" value={note} onChange={e => setNote(e.target.value)} />
              </div>
            )}
            {selected.admin_notes && selected.status !== 'pending' && (
              <div style={{ background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
                <strong>Admin note:</strong> {selected.admin_notes}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

// -------------------------------------------------------------------------
// Admin Roles
// -------------------------------------------------------------------------
export function AdminRolesPage() {
  const { success, error: toastError } = useToast()
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)

  const loadRoles = async () => {
    setLoading(true)
    const { data } = await supabase.from('roles').select('*').order('category').order('name')
    setRoles(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadRoles() }, [])

  const toggleActive = async (role: Role) => {
    const { error } = await supabase.from('roles').update({ is_active: !role.is_active }).eq('id', role.id)
    if (error) { toastError('Could not update role.'); return }
    success(`Role ${!role.is_active ? 'activated' : 'deactivated'}.`)
    loadRoles()
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">Roles</h1>
        <p className="page-header__subtitle">Manage the preparation role catalogue</p>
      </div>
      <div className="section">
        {loading ? (
          <div style={{ padding: 'var(--space-8)', display: 'flex', justifyContent: 'center' }}><LoadingSpinner /></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>CSE</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(role => (
                <tr key={role.id}>
                  <td style={{ fontWeight: 500 }}>{role.name}</td>
                  <td><Badge variant="default">{role.category}</Badge></td>
                  <td>{role.is_cse_related ? <Badge variant="accent">CSE</Badge> : '—'}</td>
                  <td>{role.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="default">Inactive</Badge>}</td>
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(role)}>
                      {role.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
