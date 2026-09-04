import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Moon, Sun, Monitor, User, Building2, Users,
  UserPlus, ShieldAlert, ShieldCheck, Loader2,
  AlertCircle, CheckCircle, X,
} from 'lucide-react';
import { adminApi } from '@/services/api/adminApi';
import type { AdminUser, AdminUserRole } from '@/services/api/adminApi';

const ROLE_LABELS: Record<AdminUserRole, string> = {
  ADMIN:   'Admin',
  ANALYST: 'Analyst',
  VIEWER:  'Viewer',
};

const ROLE_COLORS: Record<AdminUserRole, { bg: string; fg: string }> = {
  ADMIN:   { bg: 'rgba(239,68,68,0.12)',  fg: '#ef4444' },
  ANALYST: { bg: 'rgba(133,136,230,0.14)', fg: '#8588e6' },
  VIEWER:  { bg: 'rgba(107,114,128,0.14)', fg: '#9ca3af' },
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  ACTIVE:               { bg: 'rgba(34,197,94,0.12)',  fg: '#22c55e' },
  PENDING_VERIFICATION: { bg: 'rgba(234,179,8,0.12)',  fg: '#eab308' },
  SUSPENDED:            { bg: 'rgba(239,68,68,0.12)',  fg: '#ef4444' },
};

// ─── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (u: AdminUser) => void;
}) {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [role,     setRole]     = useState<AdminUserRole>('ANALYST');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await adminApi.createUser({ name: name.trim(), email: email.trim(), role });
      onCreated(user);
    } catch (err: any) {
      setError(err.message || 'Failed to create user.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--fg)',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-2xl p-6 shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>Invite user</h3>
          <button onClick={onClose} style={{ color: 'var(--fg-subtle)' }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg flex items-start gap-2 text-sm"
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg)' }}>
              Full name
            </label>
            <input
              type="text" required autoFocus placeholder="Jane Smith"
              value={name} onChange={e => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg)' }}>
              Email address
            </label>
            <input
              type="email" required placeholder="jane@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg)' }}>
              Role
            </label>
            <select
              value={role} onChange={e => setRole(e.target.value as AdminUserRole)}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-all"
              style={inputStyle}
            >
              <option value="ANALYST">Analyst — can view and investigate risk data</option>
              <option value="VIEWER">Viewer — read-only access</option>
              <option value="ADMIN">Admin — full platform access</option>
            </select>
          </div>

          <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
            A verification email will be sent. The user will set their own password via the forgot-password flow.
          </p>

          <button
            type="submit" disabled={loading}
            className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-all mt-2"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            {loading
              ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><UserPlus className="h-4 w-4" /> Send invite</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  const isAdmin = user?.role === 'ADMIN';

  // User management state (admin only)
  const [users,          setUsers]          = useState<AdminUser[]>([]);
  const [usersLoading,   setUsersLoading]   = useState(false);
  const [usersError,     setUsersError]     = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading,  setActionLoading]  = useState<string | null>(null);
  const [successMsg,     setSuccessMsg]     = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    setUsersLoading(true);
    adminApi.listUsers()
      .then(setUsers)
      .catch(err => setUsersError(err.message || 'Failed to load users.'))
      .finally(() => setUsersLoading(false));
  }, [isAdmin]);

  const flash = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleToggleStatus = async (u: AdminUser) => {
    setActionLoading(u.id);
    try {
      const updated = u.status === 'SUSPENDED'
        ? await adminApi.activateUser(u.id)
        : await adminApi.suspendUser(u.id);
      setUsers(prev => prev.map(x => x.id === updated.id ? updated : x));
      flash(`${updated.name} ${updated.status === 'SUSPENDED' ? 'suspended' : 'activated'}.`);
    } catch (err: any) {
      setUsersError(err.message || 'Action failed.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
          Manage your account and workspace preferences.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <CardTitle>Profile</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5 mb-6">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
              {user?.name?.charAt(0) ?? 'A'}
            </div>
            <div>
              <div className="text-lg font-bold" style={{ color: 'var(--fg)' }}>{user?.name}</div>
              <div className="text-sm" style={{ color: 'var(--fg-muted)' }}>{user?.email}</div>
              {user?.role && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block"
                  style={ROLE_COLORS[user.role as AdminUserRole]
                    ? { background: ROLE_COLORS[user.role as AdminUserRole].bg, color: ROLE_COLORS[user.role as AdminUserRole].fg }
                    : { background: 'var(--accent-muted)', color: 'var(--accent)' }}
                >
                  {user.role}
                </span>
              )}
            </div>
          </div>
          <div className="grid gap-3">
            {[
              { label: 'Full Name', value: user?.name  ?? '—' },
              { label: 'Email',     value: user?.email ?? '—' },
              { label: 'Role',      value: user?.role  ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-3 border-b last:border-0"
                style={{ borderColor: 'var(--border)' }}>
                <span className="text-sm" style={{ color: 'var(--fg-subtle)' }}>{label}</span>
                <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── User Management (ADMIN only) ───────────────────────── */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                <CardTitle>User Management</CardTitle>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold transition-all"
                style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                <UserPlus className="h-3.5 w-3.5" /> Invite user
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {successMsg && (
              <div className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm"
                style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}>
                <CheckCircle className="h-4 w-4 shrink-0" />{successMsg}
              </div>
            )}
            {usersError && (
              <div className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm"
                style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
                <AlertCircle className="h-4 w-4 shrink-0" />{usersError}
              </div>
            )}

            {usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--accent)' }} />
              </div>
            ) : (
              <div className="space-y-2">
                {users.map(u => {
                  const roleStyle  = ROLE_COLORS[u.role]   ?? { bg: 'var(--surface-2)', fg: 'var(--fg-muted)' };
                  const statusStyle = STATUS_COLORS[u.status] ?? { bg: 'var(--surface-2)', fg: 'var(--fg-muted)' };
                  const isSelf      = u.email === user?.email;
                  const isActioning = actionLoading === u.id;

                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                          style={{ background: roleStyle.bg, color: roleStyle.fg }}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: 'var(--fg)' }}>
                            {u.name} {isSelf && <span style={{ color: 'var(--fg-subtle)' }}>(you)</span>}
                          </div>
                          <div className="text-xs truncate" style={{ color: 'var(--fg-muted)' }}>{u.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {/* Role badge */}
                        <span
                          className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: roleStyle.bg, color: roleStyle.fg }}
                        >
                          {ROLE_LABELS[u.role]}
                        </span>

                        {/* Status badge */}
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: statusStyle.bg, color: statusStyle.fg }}
                        >
                          {u.status === 'PENDING_VERIFICATION' ? 'Pending' : u.status.charAt(0) + u.status.slice(1).toLowerCase()}
                        </span>

                        {/* Suspend / activate action (can't act on yourself) */}
                        {!isSelf && u.status !== 'PENDING_VERIFICATION' && (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={!!isActioning}
                            title={u.status === 'SUSPENDED' ? 'Reactivate user' : 'Suspend user'}
                            className="h-8 w-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-50"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                          >
                            {isActioning
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--fg-subtle)' }} />
                              : u.status === 'SUSPENDED'
                                ? <ShieldCheck className="h-3.5 w-3.5" style={{ color: '#22c55e' }} />
                                : <ShieldAlert className="h-3.5 w-3.5" style={{ color: '#ef4444' }} />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {users.length === 0 && (
                  <p className="text-sm text-center py-6" style={{ color: 'var(--fg-muted)' }}>
                    No users yet. Invite your first team member above.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <CardTitle>Appearance</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4" style={{ color: 'var(--fg-muted)' }}>
            Choose how Zeno looks in your browser.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'light',  label: 'Light',  icon: Sun,     desc: 'Cool gray/blue' },
              { value: 'dark',   label: 'Dark',   icon: Moon,    desc: 'Deep charcoal'  },
              { value: 'system', label: 'System', icon: Monitor, desc: 'OS preference'  },
            ] as const).map(({ value, label, icon: Icon, desc }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center"
                style={theme === value
                  ? { borderColor: 'var(--accent)', background: 'var(--accent-muted)' }
                  : { borderColor: 'var(--border)', background: 'var(--surface-2)' }}
              >
                <Icon className="h-5 w-5" style={{ color: theme === value ? 'var(--accent)' : 'var(--fg-subtle)' }} />
                <div>
                  <div className="text-sm font-semibold"
                    style={{ color: theme === value ? 'var(--accent)' : 'var(--fg)' }}>
                    {label}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Workspace */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <CardTitle>Workspace</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {[
              { label: 'Environment', value: 'TEST' },
              { label: 'API Mode',    value: import.meta.env.VITE_MOCK_API === 'true' ? 'Mock (dev)' : 'Live' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-3 border-b last:border-0"
                style={{ borderColor: 'var(--border)' }}>
                <span className="text-sm" style={{ color: 'var(--fg-subtle)' }}>{label}</span>
                <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create user modal */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreated={u => {
            setUsers(prev => [u, ...prev]);
            setShowCreateModal(false);
            flash(`Invite sent to ${u.email}.`);
          }}
        />
      )}
    </div>
  );
}
