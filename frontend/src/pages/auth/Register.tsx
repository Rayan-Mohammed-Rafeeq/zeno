import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, CheckCircle, Eye, EyeOff, ArrowRight } from 'lucide-react';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState(false);
  const [loading, setLoading]         = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await register({ name, email, password, confirmPassword: confirm });
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

      {/* Left panel */}
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
            Join Niro's<br />risk platform.
          </h1>
          <p className="text-base max-w-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Create your analyst account and start investigating fraud patterns backed by observable evidence.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              'Evidence-based risk signals',
              'Coordinated fraud cluster detection',
              'Honest evaluation with limitations disclosed',
            ].map((f) => (
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

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">

          <div className="lg:hidden mb-10 flex items-center gap-3">
            <img src="/light-logo.svg" alt="Niro" className="h-9 w-auto dark:hidden" draggable={false} />
            <img src="/dark-logo.svg"  alt="Niro" className="h-9 w-auto hidden dark:block" draggable={false} />
            <span className="text-xl font-bold tracking-widest" style={{ color: 'var(--fg)' }}>NIRO</span>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--fg)' }}>Create account</h2>
          <p className="text-sm mb-8" style={{ color: 'var(--fg-muted)' }}>Get started with Niro risk intelligence.</p>

          {error && (
            <div className="mb-5 p-3.5 rounded-lg flex items-start gap-3 text-sm"
              style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{error}
            </div>
          )}
          {success && (
            <div className="mb-5 p-3.5 rounded-lg flex items-start gap-3 text-sm"
              style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}>
              <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />Registration successful! Redirecting…
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: 'Full name',         type: 'text',     ac: 'name',         ph: 'John Smith',           val: name,     set: setName },
              { label: 'Email',             type: 'email',    ac: 'email',        ph: 'analyst@example.com',  val: email,    set: setEmail },
            ].map(({ label, type, ac, ph, val, set }) => (
              <div key={label}>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg)' }}>{label}</label>
                <input type={type} required autoComplete={ac} placeholder={ph}
                  value={val} onChange={(e) => set(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-all"
                  style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
              </div>
            ))}

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg)' }}>Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} required autoComplete="new-password"
                  placeholder="Minimum 8 characters" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 px-3 pr-10 rounded-lg text-sm outline-none transition-all"
                  style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-subtle)' }}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg)' }}>Confirm password</label>
              <input type="password" required autoComplete="new-password" placeholder="Re-enter password"
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-all"
                style={inputStyle} onFocus={focusOn} onBlur={focusOff} />
            </div>

            <button type="submit" disabled={loading}
              className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60 mt-2"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
              {loading
                ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <> Create account <ArrowRight className="h-4 w-4" /> </>}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: 'var(--fg-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-medium hover:underline" style={{ color: 'var(--accent)' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
