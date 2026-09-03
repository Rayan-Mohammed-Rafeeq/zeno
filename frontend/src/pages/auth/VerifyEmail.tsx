import { Link } from 'react-router-dom';
import { MailCheck, ArrowLeft } from 'lucide-react';

export function VerifyEmail() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-[400px] text-center">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <img src="/light-logo.svg" alt="Niro" className="h-9 w-auto dark:hidden" draggable={false} />
          <img src="/dark-logo.svg"  alt="Niro" className="h-9 w-auto hidden dark:block" draggable={false} />
          <span className="text-xl font-bold tracking-widest" style={{ color: 'var(--fg)' }}>NIRO</span>
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--accent-muted)' }}>
            <MailCheck className="h-8 w-8" style={{ color: 'var(--accent)' }} />
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Check your inbox</h2>
        <p className="text-sm mb-8 max-w-xs mx-auto" style={{ color: 'var(--fg-muted)' }}>
          We sent a verification email to complete your registration. The link expires in 24 hours.
        </p>

        <div className="space-y-3">
          <button
            className="w-full h-10 rounded-lg text-sm font-semibold transition-all"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            Resend verification email
          </button>

          <Link to="/login" className="w-full h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--fg-muted)' }}>
            <ArrowLeft className="h-4 w-4" /> Return to sign in
          </Link>
        </div>

        <p className="mt-6 text-xs" style={{ color: 'var(--fg-subtle)' }}>
          Didn't receive the email? Check your spam folder or request a new link above.
        </p>
      </div>
    </div>
  );
}
