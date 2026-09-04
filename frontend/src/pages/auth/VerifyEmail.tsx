import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MailCheck, CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { authApi } from '@/services/api';

type State = 'pending' | 'verifying' | 'success' | 'error';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<State>(token ? 'verifying' : 'pending');
  const [errorMsg, setErrorMsg] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Auto-verify as soon as the page mounts with a token
  useEffect(() => {
    if (!token) return;

    authApi.verifyEmail({ token })
      .then(() => setState('success'))
      .catch((err: any) => {
        setErrorMsg(err.message || 'Verification failed. The link may have expired.');
        setState('error');
      });
  }, [token]);

  const handleResend = async () => {
    if (!resendEmail.trim()) return;
    setResendLoading(true);
    try {
      await authApi.resendVerification({ email: resendEmail.trim() });
      setResendSent(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not resend verification email.');
    } finally {
      setResendLoading(false);
    }
  };

  /* ── Verifying (spinner) ──────────────────────────── */
  if (state === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-[400px] text-center">
          <Logo />
          <div className="flex justify-center mb-6">
            <Loader2 className="h-12 w-12 animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Verifying your email…</h2>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>This will only take a moment.</p>
        </div>
      </div>
    );
  }

  /* ── Success ──────────────────────────────────────── */
  if (state === 'success') {
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
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Email verified</h2>
          <p className="text-sm mb-8 max-w-xs mx-auto" style={{ color: 'var(--fg-muted)' }}>
            Your account is active. You can now sign in.
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

  /* ── Error (bad / expired token) ─────────────────── */
  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-[400px] text-center">
          <Logo />
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--danger-bg)' }}>
              <XCircle className="h-8 w-8" style={{ color: 'var(--danger)' }} />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Verification failed</h2>
          <p className="text-sm mb-6 max-w-xs mx-auto" style={{ color: 'var(--fg-muted)' }}>
            {errorMsg}
          </p>

          {/* Resend form */}
          {!resendSent ? (
            <div className="space-y-3 text-left">
              <p className="text-sm font-medium" style={{ color: 'var(--fg)' }}>Request a new link:</p>
              <input
                type="email"
                placeholder="Your email address"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-all"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e)  => (e.target.style.borderColor = 'var(--border)')}
              />
              <button
                onClick={handleResend}
                disabled={resendLoading || !resendEmail.trim()}
                className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                {resendLoading
                  ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : 'Resend verification email'}
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-lg text-sm text-left"
              style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}>
              <CheckCircle className="inline h-4 w-4 mr-2" />
              A new verification link has been sent to {resendEmail}.
            </div>
          )}

          <Link to="/login" className="mt-4 w-full h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--fg-muted)' }}>
            <ArrowLeft className="h-4 w-4" /> Return to sign in
          </Link>
        </div>
      </div>
    );
  }

  /* ── Pending (no token — just registered) ─────────── */
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-[400px] text-center">
        <Logo />
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--accent-muted)' }}>
            <MailCheck className="h-8 w-8" style={{ color: 'var(--accent)' }} />
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Check your inbox</h2>
        <p className="text-sm mb-8 max-w-xs mx-auto" style={{ color: 'var(--fg-muted)' }}>
          We sent a verification link to complete your registration. It expires in 24 hours.
        </p>

        <div className="space-y-3">
          {!resendSent ? (
            <>
              <input
                type="email"
                placeholder="Enter your email to resend"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm outline-none transition-all"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e)  => (e.target.style.borderColor = 'var(--border)')}
              />
              <button
                onClick={handleResend}
                disabled={resendLoading || !resendEmail.trim()}
                className="w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
              >
                {resendLoading
                  ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : 'Resend verification email'}
              </button>
            </>
          ) : (
            <div className="p-3.5 rounded-lg text-sm text-left"
              style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}>
              <CheckCircle className="inline h-4 w-4 mr-2" />
              Verification link resent to {resendEmail}.
            </div>
          )}

          <Link to="/login" className="w-full h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--fg-muted)' }}>
            <ArrowLeft className="h-4 w-4" /> Return to sign in
          </Link>
        </div>

        <p className="mt-6 text-xs" style={{ color: 'var(--fg-subtle)' }}>
          Didn't receive it? Check your spam folder or request a new link above.
        </p>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center justify-center gap-3 mb-10">
      <img src="/light-logo.svg" alt="Zeno" className="h-9 w-auto dark:hidden" draggable={false} />
      <img src="/dark-logo.svg"  alt="Zeno" className="h-9 w-auto hidden dark:block" draggable={false} />
      <span className="text-xl font-bold tracking-widest" style={{ color: 'var(--fg)' }}>ZENO</span>
    </div>
  );
}
