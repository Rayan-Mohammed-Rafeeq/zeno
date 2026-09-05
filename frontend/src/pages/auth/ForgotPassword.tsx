import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '@/services/api';
import { useForceDark } from '@/hooks/useForceDark';
import { AlertCircle, CheckCircle, ArrowLeft, Mail } from 'lucide-react';

export function ForgotPassword() {
  useForceDark();
  const [email, setEmail]   = useState('');
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword({ email });
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-[400px]">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <img src="/light-logo.svg" alt="Zeno" className="h-9 w-auto dark:hidden" draggable={false} />
          <img src="/dark-logo.svg"  alt="Zeno" className="h-9 w-auto hidden dark:block" draggable={false} />
          <span className="text-xl font-bold tracking-widest" style={{ color: 'var(--fg)' }}>ZENO</span>
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--accent-muted)' }}>
            <Mail className="h-7 w-7" style={{ color: 'var(--accent)' }} />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center mb-2" style={{ color: 'var(--fg)' }}>
          Reset your password
        </h2>
        <p className="text-sm text-center mb-8" style={{ color: 'var(--fg-muted)' }}>
          {sent
            ? `We sent a reset link to ${email}`
            : "Enter your email and we'll send you a reset link."}
        </p>

        {error && (
          <div className="mb-5 p-3.5 rounded-lg flex items-start gap-3 text-sm"
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{error}
          </div>
        )}

        {sent ? (
          <div className="space-y-3">
            <div className="p-4 rounded-lg flex items-start gap-3 text-sm"
              style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}>
              <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
              Check your inbox for the reset link. Didn't receive it? Check your spam folder.
            </div>
            <button onClick={() => setSent(false)}
              className="w-full h-10 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'var(--surface-2)', color: 'var(--fg-muted)' }}>
              Try a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg)' }}>Email</label>
              <input type="email" required autoComplete="email" placeholder="analyst@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-all"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e)  => (e.target.style.borderColor = 'var(--border)')} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}>
              {loading
                ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Send reset link'}
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm hover:underline"
            style={{ color: 'var(--accent)' }}>
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
