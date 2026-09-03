/**
 * Register.tsx — NIRO Create Account Page
 * -----------------------------------------
 * Identical split-screen layout as Login.tsx:
 *   Left  (55%) — hero with NiroVisualization
 *   Right (45%) — registration form
 *
 * All existing auth logic preserved:
 *   useAuth().register, validation, error/success states,
 *   loading spinner, password toggle, navigate to /verify-email.
 *
 * Shares the same LOGIN_STYLES CSS token block so both pages
 * are visually identical — only the form content differs.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { NiroVisualization } from '@/components/brand/NiroVisualization';
import { AlertCircle, CheckCircle, Eye, EyeOff, ArrowRight } from 'lucide-react';

/* ── Shared styles (identical token set to Login.tsx) ─────────────
   Duplicated here so Register is self-contained and doesn't rely
   on Login being mounted. In a larger app these would live in a
   shared auth-layout module.
─────────────────────────────────────────────────────────────────── */
const REGISTER_STYLES = `
  .niro-login-shell {
    min-height: 100svh;
    display: flex;
    overflow: hidden;
    background: var(--login-page-bg);
  }

  .niro-hero {
    position: relative;
    width: 55%;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--hero-bg);
  }

  .niro-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 70% 55% at 62% 72%, var(--hero-bloom-1) 0%, transparent 70%),
      radial-gradient(ellipse 45% 40% at 15% 20%, var(--hero-bloom-2) 0%, transparent 60%);
    pointer-events: none;
    z-index: 0;
  }

  .niro-hero::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, var(--hero-dot) 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: 0.35;
    pointer-events: none;
    z-index: 0;
  }

  .niro-hero-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 48px 52px;
  }

  .niro-hero-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .niro-hero-logo-text {
    font-size: 1.35rem;
    font-weight: 800;
    letter-spacing: 0.18em;
    color: var(--hero-logo-text);
    user-select: none;
  }

  .niro-hero-copy {
    margin-top: 52px;
    flex-shrink: 0;
  }

  .niro-hero-headline {
    font-size: clamp(2rem, 3.2vw, 2.75rem);
    font-weight: 800;
    line-height: 1.12;
    letter-spacing: -0.025em;
    color: var(--hero-headline);
    margin: 0 0 6px;
  }

  .niro-hero-headline-accent {
    color: var(--hero-accent);
    display: block;
  }

  .niro-hero-sub {
    margin-top: 18px;
    font-size: 0.975rem;
    line-height: 1.65;
    color: var(--hero-sub);
    max-width: 380px;
  }

  .niro-vis-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: flex-end;
    padding-bottom: 16px;
    margin-left: -32px;
    margin-right: -32px;
  }

  .niro-divider {
    position: absolute;
    top: 0; right: 0;
    width: 1px; height: 100%;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      var(--divider-color) 20%,
      var(--divider-color) 80%,
      transparent 100%
    );
    z-index: 2;
  }

  /* ── RIGHT AUTH PANEL ── */
  .niro-auth {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 48px;
    background: var(--auth-bg);
    position: relative;
    overflow-y: auto;
  }

  .niro-auth::before {
    content: '';
    position: absolute;
    top: -120px; right: -80px;
    width: 340px; height: 340px;
    border-radius: 50%;
    background: var(--auth-bloom);
    filter: blur(80px);
    pointer-events: none;
    z-index: 0;
  }

  .niro-auth-inner {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 380px;
    padding: 24px 0;
  }

  .niro-mobile-logo {
    display: none;
    align-items: center;
    gap: 10px;
    margin-bottom: 36px;
  }

  .niro-mobile-logo-text {
    font-size: 1.15rem;
    font-weight: 800;
    letter-spacing: 0.18em;
    color: var(--auth-heading);
    user-select: none;
  }

  .niro-auth-heading {
    font-size: 1.65rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--auth-heading);
    margin: 0 0 6px;
  }

  .niro-auth-subheading {
    font-size: 0.9rem;
    color: var(--auth-sub);
    margin: 0 0 28px;
    line-height: 1.5;
  }

  .niro-error {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--danger-bg);
    border: 1px solid var(--danger);
    color: var(--danger);
    font-size: 0.85rem;
    line-height: 1.45;
    margin-bottom: 18px;
  }

  .niro-success {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--success-bg);
    border: 1px solid var(--success);
    color: var(--success);
    font-size: 0.85rem;
    line-height: 1.45;
    margin-bottom: 18px;
  }

  .niro-label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--auth-label);
    margin-bottom: 7px;
  }

  .niro-input {
    width: 100%;
    height: 46px;
    padding: 0 14px;
    border-radius: 10px;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
    background: var(--input-bg);
    border: 1px solid var(--input-border);
    color: var(--auth-heading);
    caret-color: var(--auth-accent);
  }

  .niro-input::placeholder { color: var(--input-placeholder); }
  .niro-input:hover         { border-color: var(--input-border-hover); }
  .niro-input:focus {
    border-color: var(--auth-accent);
    box-shadow: 0 0 0 3px var(--input-focus-ring);
    background: var(--input-bg-focus);
  }

  .niro-input-pw { padding-right: 46px; }

  .niro-field { margin-bottom: 16px; }

  .niro-pw-wrap { position: relative; }

  .niro-pw-toggle {
    position: absolute;
    right: 13px; top: 50%;
    transform: translateY(-50%);
    background: none; border: none;
    padding: 4px; cursor: pointer;
    color: var(--input-placeholder);
    display: flex; align-items: center;
    transition: color 0.15s;
  }
  .niro-pw-toggle:hover { color: var(--auth-sub); }

  /* Section divider label */
  .niro-section-label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--auth-accent);
    margin: 20px 0 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .niro-section-label::before,
  .niro-section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--input-border);
  }

  .niro-submit {
    width: 100%;
    height: 48px;
    border-radius: 10px;
    border: none;
    font-size: 0.93rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--auth-accent-btn);
    color: #ffffff;
    transition: opacity 0.18s ease, box-shadow 0.18s ease, transform 0.12s ease;
    box-shadow: 0 4px 20px var(--auth-accent-shadow);
    margin-top: 8px;
  }
  .niro-submit:hover:not(:disabled) {
    opacity: 0.9;
    box-shadow: 0 6px 28px var(--auth-accent-shadow);
    transform: translateY(-1px);
  }
  .niro-submit:active:not(:disabled) { transform: translateY(0); opacity: 1; }
  .niro-submit:disabled { opacity: 0.6; cursor: not-allowed; }

  .niro-spinner {
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: niro-reg-spin 0.7s linear infinite;
  }
  @keyframes niro-reg-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .niro-spinner { animation: none; opacity: 0.7; } }

  .niro-auth-footer {
    margin-top: 24px;
    text-align: center;
    font-size: 0.85rem;
    color: var(--auth-sub);
  }
  .niro-auth-footer a {
    color: var(--auth-accent);
    font-weight: 600;
    text-decoration: none;
    transition: opacity 0.15s;
  }
  .niro-auth-footer a:hover { opacity: 0.75; text-decoration: underline; }

  /* ── DARK THEME ── */
  :root, .dark {
    --hero-bg:            #0d0f1e;
    --hero-bloom-1:       rgba(94, 91, 193, 0.22);
    --hero-bloom-2:       rgba(60, 55, 150, 0.12);
    --hero-dot:           rgba(133, 136, 230, 0.6);
    --hero-logo-text:     #ffffff;
    --hero-headline:      #f0f1fa;
    --hero-accent:        #9b9ef5;
    --hero-sub:           rgba(200, 203, 240, 0.65);
    --divider-color:      rgba(133, 136, 230, 0.12);
    --login-page-bg:      #0d0f1e;

    --auth-bg:            #f0f1f5;
    --auth-bloom:         rgba(133, 136, 230, 0.08);
    --auth-heading:       #16183a;
    --auth-sub:           rgba(40, 50, 100, 0.58);
    --auth-label:         rgba(30, 35, 90, 0.72);
    --auth-accent:        #5e5bc1;
    --auth-accent-btn:    linear-gradient(135deg, #7375d8 0%, #5e5bc1 100%);
    --auth-accent-shadow: rgba(94, 91, 193, 0.28);

    --input-bg:           rgba(255, 255, 255, 0.85);
    --input-bg-focus:     #ffffff;
    --input-border:       rgba(94, 91, 193, 0.22);
    --input-border-hover: rgba(94, 91, 193, 0.42);
    --input-focus-ring:   rgba(94, 91, 193, 0.14);
    --input-placeholder:  rgba(80, 85, 150, 0.38);
  }

  /* ── LIGHT THEME ── */
  :root:not(.dark) {
    --hero-bg:            #e8e6f7;
    --hero-bloom-1:       rgba(107, 104, 212, 0.18);
    --hero-bloom-2:       rgba(130, 127, 210, 0.10);
    --hero-dot:           rgba(94, 91, 193, 0.45);
    --hero-logo-text:     #1a1f45;
    --hero-headline:      #16183a;
    --hero-accent:        #5e5bc1;
    --hero-sub:           rgba(40, 45, 100, 0.65);
    --divider-color:      rgba(94, 91, 193, 0.15);
    --login-page-bg:      #edeafc;

    --auth-bg:            #f0f1f5;
    --auth-bloom:         rgba(94, 91, 193, 0.07);
    --auth-heading:       #16183a;
    --auth-sub:           rgba(40, 50, 100, 0.58);
    --auth-label:         rgba(30, 35, 90, 0.72);
    --auth-accent:        #5e5bc1;
    --auth-accent-btn:    linear-gradient(135deg, #6b68d4 0%, #5048b8 100%);
    --auth-accent-shadow: rgba(94, 91, 193, 0.28);

    --input-bg:           #f5f4fb;
    --input-bg-focus:     #ffffff;
    --input-border:       rgba(94, 91, 193, 0.20);
    --input-border-hover: rgba(94, 91, 193, 0.40);
    --input-focus-ring:   rgba(94, 91, 193, 0.13);
    --input-placeholder:  rgba(80, 85, 150, 0.38);
  }

  /* ── RESPONSIVE ── */
  @media (max-width: 1100px) {
    .niro-hero         { width: 48%; }
    .niro-hero-content { padding: 36px 36px; }
    .niro-auth         { padding: 36px 32px; }
  }

  @media (max-width: 768px) {
    .niro-login-shell  { flex-direction: column; }
    .niro-hero         { width: 100%; min-height: 260px; }
    .niro-hero-content { padding: 28px 28px 20px; }
    .niro-hero-copy    { margin-top: 24px; }
    .niro-hero-sub     { display: none; }
    .niro-vis-wrap     { display: none; }
    .niro-divider      { display: none; }

    .niro-auth         { flex: 1; padding: 32px 24px 40px; justify-content: flex-start; }
    .niro-auth-inner   { max-width: 100%; }
    .niro-mobile-logo  { display: flex; }
  }

  @media (max-width: 400px) {
    .niro-hero         { min-height: 200px; }
    .niro-hero-content { padding: 22px 20px 16px; }
    .niro-auth         { padding: 24px 18px 36px; }
    .niro-input        { height: 44px; }
    .niro-submit       { height: 46px; }
  }
`;

export function Register() {
  /* ── Auth state (UNCHANGED) ── */
  const { register }                      = useAuth();
  const navigate                          = useNavigate();
  const [name,         setName]           = useState('');
  const [merchantName, setMerchantName]   = useState('');
  const [email,        setEmail]          = useState('');
  const [password,     setPassword]       = useState('');
  const [confirm,      setConfirm]        = useState('');
  const [showPw,       setShowPw]         = useState(false);
  const [error,        setError]          = useState('');
  const [success,      setSuccess]        = useState(false);
  const [loading,      setLoading]        = useState(false);

  /* ── Theme ── */
  const { resolvedTheme } = useTheme();
  const isDark            = resolvedTheme === 'dark';
  const logoSrc           = isDark ? '/dark-logo.svg' : '/light-logo.svg';

  /* ── Submit handler (UNCHANGED) ── */
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{REGISTER_STYLES}</style>

      <div className="niro-login-shell">

        {/* ══════════════════════════════════════════════
            LEFT — Hero panel (identical to Login)
        ══════════════════════════════════════════════ */}
        <div className="niro-hero">
          <div className="niro-hero-content">

            <div className="niro-hero-logo">
              <img src={logoSrc} alt="NIRO" height={36} draggable={false}
                style={{ height: 36, width: 'auto' }} />
              <span className="niro-hero-logo-text">NIRO</span>
            </div>

            <div className="niro-hero-copy">
              <h1 className="niro-hero-headline">
                Intelligence that
                <span className="niro-hero-headline-accent">stops abuse.</span>
              </h1>
              <p className="niro-hero-sub">
                NIRO helps merchants detect coordinated risk, uncover hidden
                patterns, and protect what matters.
              </p>
            </div>

            <div className="niro-vis-wrap" style={{ maxHeight: 420, minHeight: 260 }}>
              <NiroVisualization isDark={isDark} className="w-full h-full" />
            </div>
          </div>

          <div className="niro-divider" aria-hidden />
        </div>

        {/* ══════════════════════════════════════════════
            RIGHT — Registration form
        ══════════════════════════════════════════════ */}
        <div className="niro-auth">
          <div className="niro-auth-inner">

            {/* Mobile-only logo */}
            <div className="niro-mobile-logo">
              <img src={logoSrc} alt="NIRO" height={32} draggable={false}
                style={{ height: 32, width: 'auto' }} />
              <span className="niro-mobile-logo-text">NIRO</span>
            </div>

            <h2 className="niro-auth-heading">Create your workspace</h2>
            <p className="niro-auth-subheading">
              Register your organisation to get started.
            </p>

            {/* Error */}
            {error && (
              <div className="niro-error" role="alert">
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
                <span>{error}</span>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="niro-success" role="status">
                <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
                <span>Workspace created! Redirecting…</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>

              {/* ── Organisation ── */}
              <div className="niro-section-label">Organisation</div>

              <div className="niro-field">
                <label htmlFor="reg-merchant" className="niro-label">
                  Organisation name
                </label>
                <input
                  id="reg-merchant"
                  type="text"
                  required
                  autoFocus
                  placeholder="Acme Store"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  className="niro-input"
                  aria-label="Organisation name"
                />
              </div>

              {/* ── Account details ── */}
              <div className="niro-section-label">Your account</div>

              <div className="niro-field">
                <label htmlFor="reg-name" className="niro-label">Full name</label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="niro-input"
                />
              </div>

              <div className="niro-field">
                <label htmlFor="reg-email" className="niro-label">Work email</label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="jane@acmestore.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="niro-input"
                />
              </div>

              <div className="niro-field">
                <label htmlFor="reg-password" className="niro-label">Password</label>
                <div className="niro-pw-wrap">
                  <input
                    id="reg-password"
                    type={showPw ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="niro-input niro-input-pw"
                  />
                  <button
                    type="button"
                    className="niro-pw-toggle"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                  </button>
                </div>
              </div>

              <div className="niro-field">
                <label htmlFor="reg-confirm" className="niro-label">Confirm password</label>
                <input
                  id="reg-confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="niro-input"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || success}
                className="niro-submit"
                aria-label="Create workspace"
              >
                {loading ? (
                  <span className="niro-spinner" aria-hidden />
                ) : (
                  <>Create workspace <ArrowRight size={16} aria-hidden /></>
                )}
              </button>
            </form>

            <p className="niro-auth-footer">
              Already have a workspace?{' '}
              <Link to="/login">Sign in</Link>
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
