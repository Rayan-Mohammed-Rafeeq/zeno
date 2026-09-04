import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authApi } from '@/services/api';
import { AlertCircle, CheckCircle, Eye, EyeOff, KeyRound } from 'lucide-react';

export function ResetPassword() {
  const [searchParams]    = useSearchParams();
  const navigate          = useNavigate();
  const token             = searchParams.get('token') ?? '';

  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState(false);

  // No token in URL — shouldn't happen via the email link, but handle gracefully
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-[400px] text-center">
          <Logo />
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--danger-bg)' }}>
              <AlertCircle className="h-8 w-8" style={{ color: 'var(--danger)' }} />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Invalid reset link</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>
            This link is missing a reset token. Please request a new password reset.
          </p>
          <Link
            to="/forgot-password"
            className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center transition-all"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      // Backend ResetPasswordRequest expects { token, newPassword }
      await authApi.resetPassword({ token, password, confirmPassword: confirm });
      setSuccess(true);
      // Auto-redirect to login after 2.5 s
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--fg)',
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-[400px] text-center">
          <Logo />
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--success-bg)' }}>
              <CheckCircle className="h-8 w-8" style={{ color: 'var(--success)' }} />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Password reset</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>
            Your password has been updated. Redirecting you to sign in…
          </p>
          <Link
            to="/login"
            className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center transition-all"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-[400px]">
        <Logo />

        <div className="flex justify-center mb-6">
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--accent-muted)' }}>
            <KeyRound className="h-7 w-7" style={{ color: 'var(--accent)' }} />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center mb-1" style={{ color: 'var(--fg)' }}>
          Set new password
        </h2>
        <p className="text-sm text-center mb-8" style={{ color: 'var(--fg-muted)' }}>
          Choose a strong password — at least 8 characters.
        </p>

        {error && (
          <div className="mb-5 p-3.5 rounded-lg flex items-start gap-3 text-sm"
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              {error}{' '}
              {error.toLowerCase().includes('expired') || error.toLowerCase().includes('invalid') ? (
                <Link to="/forgot-password" className="underline font-medium">Request a new link</Link>
              ) : null}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New password */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg)' }}>
              New password
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                required
                autoFocus
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-10 px-3 pr-10 rounded-lg text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--fg-subtle)' }}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--fg)' }}>
              Confirm password
            </label>
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-all mt-2"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            {loading
              ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : 'Reset password'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm hover:underline" style={{ color: 'var(--accent)' }}>
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      <img src="/light-logo.svg" alt="Zeno" className="h-9 w-auto dark:hidden" draggable={false} />
      <img src="/dark-logo.svg"  alt="Zeno" className="h-9 w-auto hidden dark:block" draggable={false} />
      <span className="text-xl font-bold tracking-widest" style={{ color: 'var(--fg)' }}>ZENO</span>
    </div>
  );
}
