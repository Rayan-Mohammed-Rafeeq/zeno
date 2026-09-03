import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, CheckCircle, Eye, EyeOff, ArrowRight, Building2 } from 'lucide-react';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name,         setName]         = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [showPw,       setShowPw]       = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState(false);
  const [loading,      setLoading]      = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await register({ name, email, password, confirmPassword: confirm, merchantName });
      setSuccess(true);
      setTimeout(() => navigate('/verify-email'), 1800);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--fg)',
  } as React.CSSProperties;
  const focusOn  = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = 'var(--accent)');
  const focusOff = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = 'var(--border)');

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>

      {/* ── Left panel ─────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0f1629 0%, #1a1f45 60%, #0d1232 100%)' }}
      >
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #8588e6 0%, transparent 70%)' }} />

        <div className="relative z-10 flex items-center gap-4">
          <img src="/dark-logo.svg" alt="Niro" className="h-10 w-auto" draggable={false} />
          <span className="text-2xl font-bold tracking-widest text-white">NIRO</span>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Your store's<br />risk platform.
          </h1>
          <p className="text-base max-w-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Register your organisation and get your own workspace — isolated data, your team, your rules.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              'One workspace per organisation',
              "You're the admin — invite your team",
              'All risk data scoped to your store',
            ].map(f => (
              <li key={f} className="flex items-center gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: '#8588e6' }} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
          © 2026 Niro · Defensive merchant risk platform
        </div>
      </div>

      {/* ── Right panel — form ─────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-[400px] py-8">

          {/* Mobile logo */}
          <div className="lg:hidden mb-10 flex items-center gap-3">
            <img src="/light-logo.svg" alt="Niro" className="h-9 w-auto dark:hidden" draggable={false} />
            <img src="/dark-logo.svg"  alt="Niro" className="h-9 w-auto hidden dark:block" draggable={false} />
            <span className="text-xl font-bold tracking-widest" style={{ color: 'var(--fg)' }}>NIRO</span>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--fg)' }}>Create your workspace</h2>
          <p className="text-sm mb-8" style={{ color: 'var(--fg-muted)' }}>
            Register your organisation to get started.
          </p>

          {error && (
            <div className="mb-5 p-3.5 rounded-lg flex items-start gap-3 text-sm"
              style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{error}
            </div>
          )}
          {success && (
            <div className="mb-5 p-3.5 rounded-lg flex items-start gap-3 text-sm"
              style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}>
              <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />Workspace created! Redirecting…
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Organisation name — visually separated as the workspace field */}
            <div className="p-4 rounded-xl space-y-1"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: 'var(--accent)' }}>
                <Building2 className="h-3.5 w-3.5" /> Organisation
              </label>
              <input
                type="text" required autoFocus placeholder="Acme Store"
                value={merchantName} onChange={e => setMerchantName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-all"
                style={inputStyle} onFocus={focusOn} onBlur={focusOff}
              />
              <p className="text-xs pt-1" style={{ color: 'var(--fg-subtle)' }}>
                This becomes your workspace name. You can invite team members after setup.
              </p>
            </div>

            {/* Admin account details */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg)' }}>Your full name</label>
              <input type="text" required autoComplete="name" placeholder="Jane Smith"
                value={name} onChange={e => setName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-all"
                style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg)' }}>Work email</label>
              <input type="email" required autoComplete="email" placeholder="jane@acmestore.com"
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-all"
                style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg)' }}>Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} required autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full h-10 px-3 pr-10 rounded-lg text-sm outline-none transition-all"
                  style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-subtle)' }}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg)' }}>Confirm password</label>
              <input type="password" required autoComplete="new-password" placeholder="Re-enter password"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-all"
                style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>

            <button type="submit" disabled={loading}
              className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60 mt-2"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
              {loading
                ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <>Create workspace <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--fg-muted)' }}>
            Already have a workspace?{' '}
            <Link to="/login" className="font-medium hover:underline" style={{ color: 'var(--accent)' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
