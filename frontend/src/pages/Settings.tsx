import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Moon, Sun, Monitor, User, Building2 } from 'lucide-react';

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

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
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                {user?.role}
              </span>
            </div>
          </div>
          <div className="grid gap-3">
            {[
              { label: 'Full Name',  value: user?.name   ?? '—' },
              { label: 'Email',      value: user?.email  ?? '—' },
              { label: 'Role',       value: user?.role   ?? '—' },
              { label: 'Merchant ID', value: user?.merchantId ?? '—' },
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
            Choose how Niro looks in your browser.
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
                  : { borderColor: 'var(--border)', background: 'var(--surface-2)' }
                }
              >
                <Icon className="h-5 w-5" style={{ color: theme === value ? 'var(--accent)' : 'var(--fg-subtle)' }} />
                <div>
                  <div className="text-sm font-semibold" style={{
                    color: theme === value ? 'var(--accent)' : 'var(--fg)',
                  }}>
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
              { label: 'Merchant',      value: 'ACME STORE'   },
              { label: 'Environment',   value: 'TEST'         },
              { label: 'API Mode',      value: 'Mock (dev)'   },
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
    </div>
  );
}
