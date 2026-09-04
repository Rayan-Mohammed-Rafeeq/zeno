/**
 * Login.tsx — NIRO Authentication Page
 * ----------------------------------------
 * Premium split-screen design:
 *   Left  (55%) — Hero with 3D risk-intelligence visualization
 *   Right (45%) — Polished, focused authentication form
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { NiroVisualization } from '@/components/brand/NiroVisualization';
import { AlertCircle, Eye, EyeOff, ArrowRight, Mail, Lock, ShieldCheck } from 'lucide-react';

const LOGIN_STYLES = `
  /* ── Page shell ── */
  .niro-login-shell {
    height: 100svh;
    max-height: 100svh;
    display: flex;
    overflow: hidden;
    background: var(--login-page-bg);
  }

  /* ── LEFT HERO PANEL ── */
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
    padding: 22px 44px 0;
    overflow: hidden;
  }

  .niro-hero-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .niro-hero-logo-text {
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: 0.18em;
    color: var(--hero-logo-text);
    user-select: none;
  }

  .niro-hero-copy {
    margin-top: 14px;
    flex-shrink: 0;
  }

  .niro-hero-headline {
    font-size: clamp(1.4rem, 2.2vw, 1.9rem);
    font-weight: 800;
    line-height: 1.12;
    letter-spacing: -0.025em;
    color: var(--hero-headline);
    margin: 0;
  }

  .niro-hero-headline-accent {
    color: var(--hero-accent);
    display: block;
  }

  .niro-hero-sub {
    margin-top: 10px;
    font-size: 0.875rem;
    line-height: 1.55;
    color: var(--hero-sub);
    max-width: 360px;
  }

  .niro-vis-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: -44px;
    margin-right: -44px;
  }

  /* ── Testimonial carousel ── */
  .niro-testimonial {
    flex-shrink: 0;
    padding: 6px 0 18px;
  }

  .niro-testimonial-track {
    position: relative;
    width: 100%;
  }

  .niro-tcard {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
    background: rgba(255, 255, 255, 0.055);
    border: 1px solid rgba(155, 158, 245, 0.14);
    border-radius: 10px;
    padding: 11px 14px;
    opacity: 0;
    transition: opacity 0.55s ease;
    pointer-events: none;
  }

  .niro-tcard--active {
    opacity: 1;
    pointer-events: auto;
    position: relative;
  }

  :root:not(.dark) .niro-tcard {
    background: rgba(255, 255, 255, 0.70);
    border-color: rgba(94, 91, 193, 0.13);
  }

  .niro-tcard-header {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .niro-tcard-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.62rem;
    font-weight: 800;
    color: #fff;
    flex-shrink: 0;
    letter-spacing: 0.03em;
  }

  .niro-tcard-meta { flex: 1; min-width: 0; }

  .niro-tcard-name {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--hero-headline);
    line-height: 1.2;
  }

  .niro-tcard-role {
    font-size: 0.68rem;
    color: var(--hero-sub);
    opacity: 0.75;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .niro-tcard-stars { display: flex; gap: 2px; flex-shrink: 0; }
  .niro-tcard-stars span { font-size: 0.65rem; color: #fbbf24; }

  .niro-tcard-quote {
    font-size: 0.79rem;
    line-height: 1.5;
    color: var(--hero-headline);
    opacity: 0.82;
    margin: 0;
    font-style: italic;
  }

  :root:not(.dark) .niro-tcard-quote { opacity: 0.78; }

  .niro-tcard-dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding-top: 9px;
  }

  .niro-tcard-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: rgba(155, 158, 245, 0.28);
    border: none; padding: 0; cursor: pointer;
    transition: background 0.25s ease, transform 0.25s ease;
  }

  .niro-tcard-dot--active {
    background: var(--hero-accent);
    transform: scale(1.35);
  }

  :root:not(.dark) .niro-tcard-dot { background: rgba(94, 91, 193, 0.22); }
  :root:not(.dark) .niro-tcard-dot--active { background: var(--hero-accent); }

  @media (prefers-reduced-motion: reduce) { .niro-tcard { transition: none; } }
  @media (max-width: 768px) { .niro-testimonial { display: none; } }

  .niro-divider {
    position: absolute; top: 0; right: 0;
    width: 1px; height: 100%;
    background: linear-gradient(to bottom, transparent 0%, var(--divider-color) 20%, var(--divider-color) 80%, transparent 100%);
    z-index: 2;
  }

  /* ═══════════════════════════════════════════
     RIGHT AUTH PANEL — redesigned
  ═══════════════════════════════════════════ */
  .niro-auth {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 40px;
    background: var(--auth-panel-bg);
    position: relative;
    overflow: auto;
    scrollbar-width: none;
  }
  .niro-auth::-webkit-scrollbar { display: none; }

  /* Multi-layer ambient background */
  .niro-auth::before {
    content: '';
    position: absolute;
    top: -140px; right: -100px;
    width: 420px; height: 420px;
    border-radius: 50%;
    background: var(--auth-bloom-1);
    filter: blur(90px);
    pointer-events: none;
    z-index: 0;
  }

  .niro-auth::after {
    content: '';
    position: absolute;
    bottom: -80px; left: -60px;
    width: 280px; height: 280px;
    border-radius: 50%;
    background: var(--auth-bloom-2);
    filter: blur(70px);
    pointer-events: none;
    z-index: 0;
  }

  .niro-auth-inner {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 400px;
  }

  /* ── Floating card ── */
  .niro-auth-card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 20px;
    padding: 36px 36px 28px;
    box-shadow: var(--card-shadow);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    position: relative;
    overflow: hidden;
  }

  /* Subtle top-edge shimmer on the card */
  .niro-auth-card::before {
    content: '';
    position: absolute;
    top: 0; left: 10%; right: 10%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--card-top-shine), transparent);
    border-radius: 100%;
  }

  /* ── Card header area ── */
  .niro-card-header {
    margin-bottom: 28px;
  }

  /* Accent pill above the heading */
  .niro-accent-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 4px 8px;
    border-radius: 100px;
    background: var(--pill-bg);
    border: 1px solid var(--pill-border);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--auth-accent);
    margin-bottom: 14px;
  }

  .niro-accent-pill svg { opacity: 0.85; }

  .niro-auth-heading {
    font-size: 1.7rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--auth-heading);
    margin: 0 0 6px;
    line-height: 1.15;
  }

  .niro-auth-subheading {
    font-size: 0.88rem;
    color: var(--auth-sub);
    margin: 0;
    line-height: 1.55;
  }

  /* ── Error banner ── */
  .niro-error {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 11px 14px;
    border-radius: 10px;
    background: var(--danger-bg);
    border: 1px solid var(--danger-border);
    color: var(--danger);
    font-size: 0.84rem;
    line-height: 1.45;
    margin-bottom: 20px;
  }

  /* ── Field ── */
  .niro-field { margin-bottom: 16px; }

  .niro-field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 7px;
  }

  .niro-label {
    display: block;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: var(--auth-label);
    margin-bottom: 7px;
    text-transform: uppercase;
  }

  /* ── Input with icon ── */
  .niro-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .niro-input-icon {
    position: absolute;
    left: 13px;
    color: var(--input-icon);
    display: flex;
    align-items: center;
    pointer-events: none;
    transition: color 0.18s ease;
    z-index: 1;
  }

  .niro-input {
    width: 100%;
    height: 46px;
    padding: 0 14px 0 40px;
    border-radius: 11px;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
    background: var(--input-bg);
    border: 1.5px solid var(--input-border);
    color: var(--auth-heading);
    caret-color: var(--auth-accent);
  }

  .niro-input::placeholder { color: var(--input-placeholder); }
  .niro-input:hover { border-color: var(--input-border-hover); }

  .niro-input:focus {
    border-color: var(--auth-accent);
    box-shadow: 0 0 0 3.5px var(--input-focus-ring);
    background: var(--input-bg-focus);
  }

  .niro-input:focus ~ .niro-input-icon,
  .niro-input-wrap:focus-within .niro-input-icon {
    color: var(--auth-accent);
  }

  .niro-input-pw { padding-right: 46px; }

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
    z-index: 1;
  }
  .niro-pw-toggle:hover { color: var(--auth-sub); }

  .niro-forgot {
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--auth-accent);
    text-decoration: none;
    transition: opacity 0.15s;
  }
  .niro-forgot:hover { opacity: 0.75; text-decoration: underline; }

  /* ── Submit button ── */
  .niro-submit {
    width: 100%;
    height: 48px;
    border-radius: 11px;
    border: none;
    font-size: 0.93rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--btn-bg);
    color: #ffffff;
    position: relative;
    overflow: hidden;
    transition: opacity 0.18s ease, box-shadow 0.18s ease, transform 0.12s ease;
    box-shadow: var(--btn-shadow);
    margin-top: 6px;
  }

  /* Shimmer sweep on the button */
  .niro-submit::after {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 60%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
    transform: skewX(-20deg);
    transition: left 0.55s ease;
  }
  .niro-submit:hover:not(:disabled)::after { left: 160%; }

  .niro-submit:hover:not(:disabled) {
    opacity: 0.93;
    box-shadow: var(--btn-shadow-hover);
    transform: translateY(-1px);
  }
  .niro-submit:active:not(:disabled) { transform: translateY(0); opacity: 1; }
  .niro-submit:disabled { opacity: 0.55; cursor: not-allowed; }

  /* Spinner */
  .niro-spinner {
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: niro-spin 0.7s linear infinite;
  }
  @keyframes niro-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .niro-spinner { animation: none; opacity: 0.7; } }

  /* ── Trust badges ── */
  .niro-trust {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid var(--card-divider);
  }

  .niro-trust-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--auth-sub);
    opacity: 0.75;
  }

  .niro-trust-item svg { opacity: 0.65; flex-shrink: 0; }

  /* ── Auth footer ── */
  .niro-auth-footer {
    margin-top: 20px;
    text-align: center;
    font-size: 0.84rem;
    color: var(--auth-sub);
  }

  .niro-auth-footer a {
    color: var(--auth-accent);
    font-weight: 600;
    text-decoration: none;
    transition: opacity 0.15s;
  }
  .niro-auth-footer a:hover { opacity: 0.75; text-decoration: underline; }

  /* ── Mobile logo ── */
  .niro-mobile-logo {
    display: none;
    align-items: center;
    gap: 10px;
    margin-bottom: 28px;
  }

  .niro-mobile-logo-text {
    font-size: 1.15rem;
    font-weight: 800;
    letter-spacing: 0.18em;
    color: var(--auth-heading);
    user-select: none;
  }

  /* ════════════════════════════════════
     DARK THEME TOKENS
  ════════════════════════════════════ */
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

    --auth-panel-bg:      #f0f1f5;
    --auth-bloom-1:       rgba(133, 136, 230, 0.10);
    --auth-bloom-2:       rgba(94, 91, 193, 0.07);

    --card-bg:            rgba(255, 255, 255, 0.97);
    --card-border:        rgba(94, 91, 193, 0.14);
    --card-shadow:        0 8px 40px rgba(94, 91, 193, 0.13), 0 1px 3px rgba(0,0,0,0.06);
    --card-top-shine:     rgba(140, 138, 230, 0.5);
    --card-divider:       rgba(94, 91, 193, 0.10);

    --pill-bg:            rgba(94, 91, 193, 0.08);
    --pill-border:        rgba(94, 91, 193, 0.18);

    --auth-heading:       #16183a;
    --auth-sub:           rgba(40, 50, 100, 0.55);
    --auth-label:         rgba(30, 35, 90, 0.60);
    --auth-accent:        #5e5bc1;

    --btn-bg:             linear-gradient(135deg, #7375d8 0%, #5048b8 100%);
    --btn-shadow:         0 4px 22px rgba(94, 91, 193, 0.32);
    --btn-shadow-hover:   0 8px 30px rgba(94, 91, 193, 0.42);

    --input-bg:           rgba(248, 248, 255, 0.9);
    --input-bg-focus:     #ffffff;
    --input-border:       rgba(94, 91, 193, 0.18);
    --input-border-hover: rgba(94, 91, 193, 0.38);
    --input-focus-ring:   rgba(94, 91, 193, 0.13);
    --input-placeholder:  rgba(80, 85, 150, 0.36);
    --input-icon:         rgba(94, 91, 193, 0.40);

    --danger:             #e53e5e;
    --danger-bg:          rgba(229, 62, 94, 0.07);
    --danger-border:      rgba(229, 62, 94, 0.22);
  }

  /* ════════════════════════════════════
     LIGHT THEME OVERRIDES
  ════════════════════════════════════ */
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

    --auth-panel-bg:      #edeafc;
    --auth-bloom-1:       rgba(107, 104, 212, 0.14);
    --auth-bloom-2:       rgba(130, 127, 210, 0.09);

    --card-bg:            rgba(255, 255, 255, 0.92);
    --card-border:        rgba(94, 91, 193, 0.13);
    --card-shadow:        0 8px 40px rgba(94, 91, 193, 0.11), 0 1px 3px rgba(0,0,0,0.04);
    --card-top-shine:     rgba(140, 138, 230, 0.45);
    --card-divider:       rgba(94, 91, 193, 0.09);

    --pill-bg:            rgba(94, 91, 193, 0.07);
    --pill-border:        rgba(94, 91, 193, 0.15);

    --auth-heading:       #16183a;
    --auth-sub:           rgba(40, 50, 100, 0.55);
    --auth-label:         rgba(30, 35, 90, 0.60);
    --auth-accent:        #5e5bc1;

    --btn-bg:             linear-gradient(135deg, #6b68d4 0%, #5048b8 100%);
    --btn-shadow:         0 4px 22px rgba(94, 91, 193, 0.30);
    --btn-shadow-hover:   0 8px 30px rgba(94, 91, 193, 0.40);

    --input-bg:           rgba(245, 244, 252, 0.9);
    --input-bg-focus:     #ffffff;
    --input-border:       rgba(94, 91, 193, 0.18);
    --input-border-hover: rgba(94, 91, 193, 0.36);
    --input-focus-ring:   rgba(94, 91, 193, 0.12);
    --input-placeholder:  rgba(80, 85, 150, 0.35);
    --input-icon:         rgba(94, 91, 193, 0.38);

    --danger:             #e53e5e;
    --danger-bg:          rgba(229, 62, 94, 0.06);
    --danger-border:      rgba(229, 62, 94, 0.20);
  }

  /* ════════════════════════════════════
     RESPONSIVE
  ════════════════════════════════════ */
  @media (max-width: 1100px) {
    .niro-hero         { width: 48%; }
    .niro-hero-content { padding: 18px 32px 0; }
    .niro-auth         { padding: 24px 24px; }
    .niro-auth-card    { padding: 28px 28px 22px; }
  }

  @media (max-width: 768px) {
    .niro-login-shell  { flex-direction: column; }
    .niro-hero         { width: 100%; min-height: 260px; }
    .niro-hero-content { padding: 28px 28px 20px; }
    .niro-hero-copy    { margin-top: 24px; }
    .niro-hero-headline{ font-size: 1.7rem; }
    .niro-hero-sub     { display: none; }
    .niro-vis-wrap     { display: none; }
    .niro-divider      { display: none; }
    .niro-auth         { flex: 1; padding: 28px 20px 36px; justify-content: flex-start; }
    .niro-auth-inner   { max-width: 100%; }
    .niro-mobile-logo  { display: flex; }
    .niro-auth-card    { padding: 24px 22px 20px; }
  }

  @media (max-width: 400px) {
    .niro-hero         { min-height: 200px; }
    .niro-auth         { padding: 20px 14px 32px; }
    .niro-input        { height: 44px; }
    .niro-submit       { height: 46px; }
    .niro-auth-card    { padding: 20px 16px 18px; border-radius: 16px; }
  }

  /* ── BACK / SWITCH BUTTONS ── */
  .niro-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px 7px 10px;
    border-radius: 100px;
    background: transparent;
    border: 1.5px solid var(--card-border);
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--auth-sub);
    text-decoration: none;
    cursor: pointer;
    letter-spacing: 0.01em;
    position: relative;
    overflow: hidden;
    transition: all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
    white-space: nowrap;
    margin-bottom: 16px;
  }
  .niro-back-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--pill-bg);
    opacity: 0;
    transition: opacity 0.22s ease;
  }
  .niro-back-btn:hover {
    color: var(--auth-accent);
    border-color: var(--auth-accent);
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 4px 16px rgba(94, 91, 193, 0.18);
  }
  .niro-back-btn:hover::before { opacity: 1; }
  .niro-back-btn:active { transform: translateY(0) scale(0.97); }
  .niro-back-btn:hover .niro-back-arrow { transform: translateX(-3px); }
  .niro-back-arrow {
    display: inline-flex;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .niro-switch-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 7px 16px 7px 14px;
    border-radius: 100px;
    background: var(--pill-bg);
    border: 1.5px solid var(--pill-border);
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--auth-accent);
    text-decoration: none;
    cursor: pointer;
    letter-spacing: 0.01em;
    position: relative;
    overflow: hidden;
    transition: all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
    white-space: nowrap;
  }
  .niro-switch-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    transform: translateX(-120%) skewX(-15deg);
  }
  .niro-switch-btn:hover {
    background: var(--auth-accent);
    border-color: var(--auth-accent);
    color: #fff;
    transform: translateY(-2px) scale(1.04);
    box-shadow: 0 6px 20px rgba(94, 91, 193, 0.35);
  }
  .niro-switch-btn:hover::before { animation: niro-shimmer 0.55s ease forwards; }
  .niro-switch-btn:active { transform: translateY(0) scale(0.97); }
  .niro-switch-btn:hover .niro-switch-arrow { transform: translateX(3px); }
  .niro-switch-arrow {
    display: inline-flex;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes niro-shimmer {
    0%   { transform: translateX(-120%) skewX(-15deg); }
    100% { transform: translateX(220%)  skewX(-15deg); }
  }

  .niro-auth-footer-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-top: 20px;
    flex-wrap: wrap;
  }
  .niro-auth-footer-label {
    font-size: 0.84rem;
    color: var(--auth-sub);
  }
`;

export function Login() {
  const { login }               = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const { resolvedTheme } = useTheme();
  const isDark            = resolvedTheme === 'dark';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ email, password });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid email or password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const logoSrc = isDark ? '/dark-logo.svg' : '/light-logo.svg';

  const testimonials = [
    { initials: 'SK', avatarBg: '#4f46e5', name: 'Sarah K.',  role: 'Head of Risk · Retailio',      quote: 'NIRO helped us catch suspicious activity much earlier without slowing down legitimate customers.' },
    { initials: 'JT', avatarBg: '#5e5bc1', name: 'James T.',  role: 'COO · MarketNest',              quote: 'False positives dropped significantly after we introduced NIRO\'s risk intelligence layer.' },
    { initials: 'PM', avatarBg: '#4338ca', name: 'Priya M.',  role: 'Trust & Safety · Shopwave',    quote: 'The risk signals are clear enough for our team to act on immediately — no guesswork needed.' },
    { initials: 'LB', avatarBg: '#6366f1', name: 'Lucas B.',  role: 'Fraud Analyst · Vendly',       quote: 'Coordinated abuse patterns that used to take days to find now surface in hours.' },
    { initials: 'AN', avatarBg: '#7c3aed', name: 'Aisha N.',  role: 'Risk Manager · Storefront Pro',quote: 'Our team trusts the signals. That confidence alone has changed how we operate.' },
    { initials: 'EV', avatarBg: '#4f46e5', name: 'Elena V.',  role: 'Security Lead · PatchCart',    quote: 'Synthetic account clusters were being flagged within the first week of going live.' },
  ];

  const [tIdx, setTIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTIdx(i => (i + 1) % testimonials.length), 5000);
    return () => clearInterval(id);
  }, [testimonials.length]);

  const Stars = () => (
    <div className="niro-tcard-stars" aria-label="5 out of 5 stars">
      {[0,1,2,3,4].map(i => <span key={i} aria-hidden>★</span>)}
    </div>
  );

  return (
    <>
      <style>{LOGIN_STYLES}</style>

      <div className="niro-login-shell">

        {/* ══ LEFT — Hero panel ══ */}
        <div className="niro-hero">
          <div className="niro-hero-content">

            <div className="niro-hero-logo">
              <img src={logoSrc} alt="NIRO" height={28} draggable={false} style={{ height: 28, width: 'auto' }} />
              <span className="niro-hero-logo-text">NIRO</span>
            </div>

            <div className="niro-hero-copy">
              <h1 className="niro-hero-headline">
                Intelligence that
                <span className="niro-hero-headline-accent">stops abuse.</span>
              </h1>
            </div>

            <div className="niro-vis-wrap">
              <NiroVisualization isDark={isDark} className="w-full h-full" />
            </div>

            <div className="niro-testimonial" aria-label="Customer testimonials">
              <div className="niro-testimonial-track">
                {testimonials.map((t, i) => (
                  <div key={i} className={`niro-tcard${i === tIdx ? ' niro-tcard--active' : ''}`} aria-hidden={i !== tIdx}>
                    <div className="niro-tcard-header">
                      <div className="niro-tcard-avatar" style={{ background: t.avatarBg }}>{t.initials}</div>
                      <div className="niro-tcard-meta">
                        <div className="niro-tcard-name">{t.name}</div>
                        <div className="niro-tcard-role">{t.role}</div>
                      </div>
                      <Stars />
                    </div>
                    <p className="niro-tcard-quote">"{t.quote}"</p>
                  </div>
                ))}
              </div>
              <div className="niro-tcard-dots" role="tablist" aria-label="Testimonial pagination">
                {testimonials.map((_, i) => (
                  <button key={i} role="tab" aria-selected={i === tIdx} aria-label={`Testimonial ${i + 1}`}
                    className={`niro-tcard-dot${i === tIdx ? ' niro-tcard-dot--active' : ''}`}
                    onClick={() => setTIdx(i)} />
                ))}
              </div>
            </div>

          </div>
          <div className="niro-divider" aria-hidden />
        </div>

        {/* ══ RIGHT — Auth panel ══ */}
        <div className="niro-auth">
          <div className="niro-auth-inner">

            {/* Mobile-only logo */}
            <div className="niro-mobile-logo">
              <img src={logoSrc} alt="NIRO" height={32} draggable={false} style={{ height: 32, width: 'auto' }} />
              <span className="niro-mobile-logo-text">NIRO</span>
            </div>

            {/* ← Back to Home */}
            <Link to="/" className="niro-back-btn" aria-label="Back to home">
              <span className="niro-back-arrow" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
              </span>
              Back to home
            </Link>

            {/* Floating card */}
            <div className="niro-auth-card">

              {/* Card header */}
              <div className="niro-card-header">
                <div className="niro-accent-pill">
                  <ShieldCheck size={11} aria-hidden />
                  Secure sign-in
                </div>
                <h2 className="niro-auth-heading">Welcome back</h2>
                <p className="niro-auth-subheading">Sign in to your NIRO workspace</p>
              </div>

              {/* Error */}
              {error && (
                <div className="niro-error" role="alert">
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>

                {/* Email */}
                <div className="niro-field">
                  <label htmlFor="niro-email" className="niro-label">Email address</label>
                  <div className="niro-input-wrap">
                    <span className="niro-input-icon"><Mail size={15} aria-hidden /></span>
                    <input
                      id="niro-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="niro-input"
                      aria-label="Email address"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="niro-field">
                  <div className="niro-field-row">
                    <label htmlFor="niro-password" className="niro-label" style={{ margin: 0 }}>Password</label>
                    <Link to="/forgot-password" className="niro-forgot" tabIndex={0}>Forgot password?</Link>
                  </div>
                  <div className="niro-input-wrap niro-pw-wrap">
                    <span className="niro-input-icon"><Lock size={15} aria-hidden /></span>
                    <input
                      id="niro-password"
                      type={showPw ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="niro-input niro-input-pw"
                      aria-label="Password"
                    />
                    <button type="button" className="niro-pw-toggle" onClick={() => setShowPw(v => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}>
                      {showPw ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button type="submit" disabled={loading} className="niro-submit" aria-label="Sign in">
                  {loading
                    ? <span className="niro-spinner" aria-hidden />
                    : <>Sign in <ArrowRight size={15} aria-hidden /></>
                  }
                </button>

              </form>



            </div>{/* /card */}

            <div className="niro-auth-footer-row">
              <span className="niro-auth-footer-label">Don't have an account?</span>
              <Link to="/register" className="niro-switch-btn">
                Create account
                <span className="niro-switch-arrow" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </span>
              </Link>
            </div>

          </div>
        </div>

      </div>
    </>
  );
}
