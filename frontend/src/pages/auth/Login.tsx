import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, Eye, EyeOff, ArrowRight } from 'lucide-react';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ email, password });
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>

      {/* ── Left panel — brand ─────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0f1629 0%, #1a1f45 60%, #0d1232 100%)' }}
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Glow behind logo */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #8588e6 0%, transparent 70%)' }}
        />

        {/* Logo top-left */}
        <div className="relative z-10 flex items-center gap-4">
          <img src="/dark-logo.svg" alt="Niro" className="h-10 w-auto" draggable={false} />
          <span className="text-2xl font-bold tracking-widest text-white">NIRO</span>
        </div>

        {/* Centre copy */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
            style={{ background: 'rgba(133,136,230,0.15)', color: '#a5a8f0', border: '1px solid rgba(133,136,230,0.25)' }}>
            Track 02 · AI Risk Manager
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Risk intelligence<br />for modern merchants.
          </h1>
          <p className="text-base leading-relaxed max-w-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Detect coordinated abuse patterns, investigate suspicious behaviour,
            and measure detector performance — all in one platform.
          </p>

          {/* Stats row */}
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { label: 'Precision',  value: '70.9%' },
              { label: 'Recall',     value: '84.7%' },
              { label: 'Signals',    value: '6 types' },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl p-4"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
          © 2026 Niro · Defensive merchant risk platform
        </div>
      </div>

      {/* ── Right panel — form ─────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="lg:hidden mb-10 flex items-center gap-3">
            <img src="/light-logo.svg" alt="Niro"
              className="h-9 w-auto dark:hidden" draggable={false} />
            <img src="/dark-logo.svg"  alt="Niro"
              className="h-9 w-auto hidden dark:block" draggable={false} />
            <span className="text-xl font-bold tracking-widest" style={{ color: 'var(--fg)' }}>NIRO</span>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--fg)' }}>
            Sign in
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--fg-muted)' }}>
            Enter your credentials to access your workspace.
          </p>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3.5 rounded-lg flex items-start gap-3 text-sm"
              style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg)' }}>
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="analyst@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e)  => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--fg)' }}>Password</label>
                <Link to="/forgot-password" className="text-xs hover:underline" style={{ color: 'var(--accent)' }}>
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 px-3 pr-10 rounded-lg text-sm outline-none transition-all"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--fg)',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={(e)  => (e.target.style.borderColor = 'var(--border)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--fg-subtle)' }}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60 mt-2"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
              onMouseEnter={(e) => !loading && ((e.target as HTMLElement).style.background = 'var(--accent-hover)')}
              onMouseLeave={(e) => !loading && ((e.target as HTMLElement).style.background = 'var(--accent)')}
            >
              {loading ? (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign in <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--fg-muted)' }}>
            Don't have an account?{' '}
            <Link to="/register" className="font-medium hover:underline" style={{ color: 'var(--accent)' }}>
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
