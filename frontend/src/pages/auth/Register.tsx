/**
 * Register.tsx — ZENO Create Account Page
 * -----------------------------------------
 * Split-screen layout matching Login.tsx:
 *   Left  (55%) — hero with ZenoVisualization
 *   Right (45%) — polished registration form (floating card design)
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useForceDark } from '@/hooks/useForceDark';
import { ZenoVisualization } from '@/components/brand/ZenoVisualization';
import {
  AlertCircle, CheckCircle, Eye, EyeOff, ArrowRight,
  Mail, Lock, User, Building2, ShieldCheck,
} from 'lucide-react';

const REGISTER_STYLES = `
  .zeno-login-shell {
    height: 100svh;
    max-height: 100svh;
    display: flex;
    overflow: hidden;
    background: var(--login-page-bg);
  }

  /* ── LEFT HERO ── */
  .zeno-hero {
    position: relative;
    width: 55%;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--hero-bg);
  }

  .zeno-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 70% 55% at 62% 72%, var(--hero-bloom-1) 0%, transparent 70%),
      radial-gradient(ellipse 45% 40% at 15% 20%, var(--hero-bloom-2) 0%, transparent 60%);
    pointer-events: none;
    z-index: 0;
  }

  .zeno-hero::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, var(--hero-dot) 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: 0.35;
    pointer-events: none;
    z-index: 0;
  }

  .zeno-hero-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 22px 44px 0;
    overflow: hidden;
  }

  .zeno-hero-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .zeno-hero-logo-text {
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: 0.18em;
    color: var(--hero-logo-text);
    user-select: none;
  }

  .zeno-hero-copy { margin-top: 14px; flex-shrink: 0; }

  .zeno-hero-headline {
    font-size: clamp(1.4rem, 2.2vw, 1.9rem);
    font-weight: 800;
    line-height: 1.12;
    letter-spacing: -0.025em;
    color: var(--hero-headline);
    margin: 0;
  }

  .zeno-hero-headline-accent { color: var(--hero-accent); display: block; }

  .zeno-hero-sub {
    margin-top: 10px;
    font-size: 0.875rem;
    line-height: 1.55;
    color: var(--hero-sub);
    max-width: 360px;
  }

  .zeno-vis-wrap {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: -44px;
    margin-right: -44px;
  }

  /* ── Testimonial carousel ── */
  .zeno-testimonial { flex-shrink: 0; padding: 6px 0 18px; }
  .zeno-testimonial-track { position: relative; width: 100%; }

  .zeno-tcard {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
    background: rgba(255,255,255,0.055);
    border: 1px solid rgba(155,158,245,0.14);
    border-radius: 10px;
    padding: 11px 14px;
    opacity: 0;
    transition: opacity 0.55s ease;
    pointer-events: none;
  }

  .zeno-tcard--active { opacity: 1; pointer-events: auto; position: relative; }

  :root:not(.dark) .zeno-tcard {
    background: rgba(255,255,255,0.70);
    border-color: rgba(94,91,193,0.13);
  }

  .zeno-tcard-header { display: flex; align-items: center; gap: 9px; }

  .zeno-tcard-avatar {
    width: 26px; height: 26px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.62rem; font-weight: 800;
    color: #fff; flex-shrink: 0; letter-spacing: 0.03em;
  }

  .zeno-tcard-meta { flex: 1; min-width: 0; }

  .zeno-tcard-name { font-size: 0.8rem; font-weight: 700; color: var(--hero-headline); line-height: 1.2; }

  .zeno-tcard-role {
    font-size: 0.68rem; color: var(--hero-sub); opacity: 0.75;
    line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .zeno-tcard-stars { display: flex; gap: 2px; flex-shrink: 0; }
  .zeno-tcard-stars span { font-size: 0.65rem; color: #fbbf24; }

  .zeno-tcard-quote {
    font-size: 0.79rem; line-height: 1.5;
    color: var(--hero-headline); opacity: 0.82;
    margin: 0; font-style: italic;
  }

  :root:not(.dark) .zeno-tcard-quote { opacity: 0.78; }

  .zeno-tcard-dots { display: flex; justify-content: center; gap: 6px; padding-top: 9px; }

  .zeno-tcard-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: rgba(155,158,245,0.28);
    border: none; padding: 0; cursor: pointer;
    transition: background 0.25s ease, transform 0.25s ease;
  }

  .zeno-tcard-dot--active { background: var(--hero-accent); transform: scale(1.35); }
  :root:not(.dark) .zeno-tcard-dot { background: rgba(94,91,193,0.22); }
  :root:not(.dark) .zeno-tcard-dot--active { background: var(--hero-accent); }

  @media (prefers-reduced-motion: reduce) { .zeno-tcard { transition: none; } }
  @media (max-width: 768px) { .zeno-testimonial { display: none; } }

  .zeno-divider {
    position: absolute; top: 0; right: 0;
    width: 1px; height: 100%;
    background: linear-gradient(to bottom, transparent 0%, var(--divider-color) 20%, var(--divider-color) 80%, transparent 100%);
    z-index: 2;
  }

  /* ═══════════════════════════════════════════
     RIGHT AUTH PANEL
  ═══════════════════════════════════════════ */
  .zeno-auth {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px 40px;
    background: var(--auth-panel-bg);
    position: relative;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .zeno-auth::-webkit-scrollbar { display: none; }

  .zeno-auth::before {
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

  .zeno-auth::after {
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

  .zeno-auth-inner {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 380px;
    padding: 6px 0;
  }

  /* ── Floating card ── */
  .zeno-auth-card {
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 18px;
    padding: 22px 28px 18px;
    box-shadow: var(--card-shadow);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    position: relative;
    overflow: hidden;
  }

  .zeno-auth-card::before {
    content: '';
    position: absolute;
    top: 0; left: 10%; right: 10%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--card-top-shine), transparent);
    border-radius: 100%;
  }

  /* ── Card header ── */
  .zeno-card-header { margin-bottom: 14px; }

  .zeno-accent-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 9px 3px 7px;
    border-radius: 100px;
    background: var(--pill-bg);
    border: 1px solid var(--pill-border);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--auth-accent);
    margin-bottom: 8px;
  }

  .zeno-accent-pill svg { opacity: 0.85; }

  .zeno-auth-heading {
    font-size: 1.35rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--auth-heading);
    margin: 0 0 3px;
    line-height: 1.15;
  }

  .zeno-auth-subheading {
    font-size: 0.82rem;
    color: var(--auth-sub);
    margin: 0;
    line-height: 1.5;
  }

  /* ── Alerts ── */
  .zeno-error {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 9px;
    background: var(--danger-bg);
    border: 1px solid var(--danger-border);
    color: var(--danger);
    font-size: 0.82rem;
    line-height: 1.45;
    margin-bottom: 12px;
  }

  .zeno-success {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 9px;
    background: var(--success-bg);
    border: 1px solid var(--success-border);
    color: var(--success);
    font-size: 0.82rem;
    line-height: 1.45;
    margin-bottom: 12px;
  }

  /* ── Section divider label ── */
  .zeno-section-label {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--auth-accent);
    margin: 10px 0 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .zeno-section-label::before,
  .zeno-section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--card-divider);
  }

  /* ── Fields ── */
  .zeno-field { margin-bottom: 9px; }

  .zeno-label {
    display: block;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--auth-label);
    margin-bottom: 5px;
  }

  /* ── Input with icon ── */
  .zeno-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .zeno-input-icon {
    position: absolute;
    left: 11px;
    color: var(--input-icon);
    display: flex;
    align-items: center;
    pointer-events: none;
    transition: color 0.18s ease;
    z-index: 1;
  }

  .zeno-input {
    width: 100%;
    height: 38px;
    padding: 0 12px 0 36px;
    border-radius: 9px;
    font-size: 0.85rem;
    outline: none;
    transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
    background: var(--input-bg);
    border: 1.5px solid var(--input-border);
    color: var(--auth-heading);
    caret-color: var(--auth-accent);
  }

  .zeno-input::placeholder { color: var(--input-placeholder); }
  .zeno-input:hover { border-color: var(--input-border-hover); }

  .zeno-input:focus {
    border-color: var(--auth-accent);
    box-shadow: 0 0 0 3px var(--input-focus-ring);
    background: var(--input-bg-focus);
  }

  .zeno-input-wrap:focus-within .zeno-input-icon { color: var(--auth-accent); }

  .zeno-input-pw { padding-right: 38px; }

  .zeno-pw-wrap { position: relative; }

  .zeno-pw-toggle {
    position: absolute;
    right: 11px; top: 50%;
    transform: translateY(-50%);
    background: none; border: none;
    padding: 4px; cursor: pointer;
    color: var(--input-placeholder);
    display: flex; align-items: center;
    transition: color 0.15s;
    z-index: 1;
  }
  .zeno-pw-toggle:hover { color: var(--auth-sub); }

  /* ── Submit ── */
  .zeno-submit {
    width: 100%;
    height: 42px;
    border-radius: 9px;
    border: none;
    font-size: 0.9rem;
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
    margin-top: 4px;
  }

  .zeno-submit::after {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 60%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
    transform: skewX(-20deg);
    transition: left 0.55s ease;
  }
  .zeno-submit:hover:not(:disabled)::after { left: 160%; }
  .zeno-submit:hover:not(:disabled) {
    opacity: 0.93;
    box-shadow: var(--btn-shadow-hover);
    transform: translateY(-1px);
  }
  .zeno-submit:active:not(:disabled) { transform: translateY(0); opacity: 1; }
  .zeno-submit:disabled { opacity: 0.55; cursor: not-allowed; }

  /* Spinner */
  .zeno-spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: zeno-reg-spin 0.7s linear infinite;
  }
  @keyframes zeno-reg-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .zeno-spinner { animation: none; opacity: 0.7; } }

  /* ── Trust badges ── */
  .zeno-trust {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--card-divider);
  }

  .zeno-trust-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--auth-sub);
    opacity: 0.75;
  }

  .zeno-trust-item svg { opacity: 0.65; flex-shrink: 0; }

  /* ── Auth footer ── */
  .zeno-auth-footer {
    margin-top: 18px;
    text-align: center;
    font-size: 0.84rem;
    color: var(--auth-sub);
  }

  .zeno-auth-footer a {
    color: var(--auth-accent);
    font-weight: 600;
    text-decoration: none;
    transition: opacity 0.15s;
  }
  .zeno-auth-footer a:hover { opacity: 0.75; text-decoration: underline; }

  /* ── Mobile logo ── */
  .zeno-mobile-logo {
    display: none;
    align-items: center;
    gap: 10px;
    margin-bottom: 24px;
  }

  .zeno-mobile-logo-text {
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

    --success:            #0d9e6e;
    --success-bg:         rgba(13, 158, 110, 0.07);
    --success-border:     rgba(13, 158, 110, 0.22);
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

    --success:            #0d9e6e;
    --success-bg:         rgba(13, 158, 110, 0.06);
    --success-border:     rgba(13, 158, 110, 0.20);
  }

  /* ════════════════════════════════════
     RESPONSIVE
  ════════════════════════════════════ */
  @media (max-width: 1100px) {
    .zeno-hero         { width: 48%; }
    .zeno-hero-content { padding: 18px 32px 0; }
    .zeno-auth         { padding: 20px 24px; }
    .zeno-auth-card    { padding: 24px 26px 20px; }
  }

  @media (max-width: 768px) {
    .zeno-login-shell  { flex-direction: column; }
    .zeno-hero         { width: 100%; min-height: 260px; }
    .zeno-hero-content { padding: 28px 28px 20px; }
    .zeno-hero-copy    { margin-top: 24px; }
    .zeno-hero-sub     { display: none; }
    .zeno-vis-wrap     { display: none; }
    .zeno-divider      { display: none; }
    .zeno-auth         { flex: 1; padding: 24px 18px 36px; justify-content: flex-start; }
    .zeno-auth-inner   { max-width: 100%; }
    .zeno-mobile-logo  { display: flex; }
    .zeno-auth-card    { padding: 22px 20px 18px; }
  }

  @media (max-width: 400px) {
    .zeno-hero         { min-height: 200px; }
    .zeno-auth         { padding: 18px 12px 30px; }
    .zeno-input        { height: 42px; }
    .zeno-submit       { height: 46px; }
    .zeno-auth-card    { padding: 18px 14px 16px; border-radius: 16px; }
  }

  /* ── BACK / SWITCH BUTTONS ── */
  .zeno-back-btn {
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
  .zeno-back-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: var(--pill-bg);
    opacity: 0;
    transition: opacity 0.22s ease;
  }
  .zeno-back-btn:hover {
    color: var(--auth-accent);
    border-color: var(--auth-accent);
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 4px 16px rgba(94, 91, 193, 0.18);
  }
  .zeno-back-btn:hover::before { opacity: 1; }
  .zeno-back-btn:active { transform: translateY(0) scale(0.97); }
  .zeno-back-btn:hover .zeno-back-arrow { transform: translateX(-3px); }
  .zeno-back-arrow {
    display: inline-flex;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .zeno-switch-btn {
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
  .zeno-switch-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    transform: translateX(-120%) skewX(-15deg);
  }
  .zeno-switch-btn:hover {
    background: var(--auth-accent);
    border-color: var(--auth-accent);
    color: #fff;
    transform: translateY(-2px) scale(1.04);
    box-shadow: 0 6px 20px rgba(94, 91, 193, 0.35);
  }
  .zeno-switch-btn:hover::before { animation: zeno-reg-shimmer 0.55s ease forwards; }
  .zeno-switch-btn:active { transform: translateY(0) scale(0.97); }
  .zeno-switch-btn:hover .zeno-switch-arrow { transform: translateX(3px); }
  .zeno-switch-arrow {
    display: inline-flex;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes zeno-reg-shimmer {
    0%   { transform: translateX(-120%) skewX(-15deg); }
    100% { transform: translateX(220%)  skewX(-15deg); }
  }

  .zeno-auth-footer-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-top: 18px;
    flex-wrap: wrap;
  }
  .zeno-auth-footer-label {
    font-size: 0.84rem;
    color: var(--auth-sub);
  }
`;

export function Register() {
  const { register }                    = useAuth();
  const navigate                        = useNavigate();
  const [name,         setName]         = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [showPw,       setShowPw]       = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState(false);
  const [loading,      setLoading]      = useState(false);
  useForceDark();
  const logoSrc = '/dark-logo.svg';

  const testimonials = [
    { initials: 'SK', avatarBg: '#4f46e5', name: 'Sarah K.',  role: 'Head of Risk · Retailio',      quote: 'ZENO helped us catch suspicious activity much earlier without slowing down legitimate customers.' },
    { initials: 'JT', avatarBg: '#5e5bc1', name: 'James T.',  role: 'COO · MarketNest',              quote: 'False positives dropped significantly after we introduced ZENO\'s risk intelligence layer.' },
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
    <div className="zeno-tcard-stars" aria-label="5 out of 5 stars">
      {[0,1,2,3,4].map(i => <span key={i} aria-hidden>★</span>)}
    </div>
  );

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

      <div className="zeno-login-shell">

        {/* ══ LEFT — Hero panel ══ */}
        <div className="zeno-hero">
          <div className="zeno-hero-content">

            <div className="zeno-hero-logo">
              <img src={logoSrc} alt="ZENO" height={28} draggable={false} style={{ height: 28, width: 'auto' }} />
              <span className="zeno-hero-logo-text">ZENO</span>
            </div>

            <div className="zeno-hero-copy">
              <h1 className="zeno-hero-headline">
                Intelligence that
                <span className="zeno-hero-headline-accent">stops abuse.</span>
              </h1>
            </div>

            <div className="zeno-vis-wrap">
              <ZenoVisualization isDark={true} className="w-full h-full" />
            </div>

            <div className="zeno-testimonial" aria-label="Customer testimonials">
              <div className="zeno-testimonial-track">
                {testimonials.map((t, i) => (
                  <div key={i} className={`zeno-tcard${i === tIdx ? ' zeno-tcard--active' : ''}`} aria-hidden={i !== tIdx}>
                    <div className="zeno-tcard-header">
                      <div className="zeno-tcard-avatar" style={{ background: t.avatarBg }}>{t.initials}</div>
                      <div className="zeno-tcard-meta">
                        <div className="zeno-tcard-name">{t.name}</div>
                        <div className="zeno-tcard-role">{t.role}</div>
                      </div>
                      <Stars />
                    </div>
                    <p className="zeno-tcard-quote">"{t.quote}"</p>
                  </div>
                ))}
              </div>
              <div className="zeno-tcard-dots" role="tablist" aria-label="Testimonial pagination">
                {testimonials.map((_, i) => (
                  <button key={i} role="tab" aria-selected={i === tIdx} aria-label={`Testimonial ${i + 1}`}
                    className={`zeno-tcard-dot${i === tIdx ? ' zeno-tcard-dot--active' : ''}`}
                    onClick={() => setTIdx(i)} />
                ))}
              </div>
            </div>

          </div>
          <div className="zeno-divider" aria-hidden />
        </div>

        {/* ══ RIGHT — Registration form ══ */}
        <div className="zeno-auth">
          <div className="zeno-auth-inner">

            {/* Mobile-only logo */}
            <div className="zeno-mobile-logo">
              <img src={logoSrc} alt="ZENO" height={32} draggable={false} style={{ height: 32, width: 'auto' }} />
              <span className="zeno-mobile-logo-text">ZENO</span>
            </div>

            {/* ← Back to Home */}
            <Link to="/" className="zeno-back-btn" aria-label="Back to home">
              <span className="zeno-back-arrow" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
              </span>
              Back to home
            </Link>

            {/* Floating card */}
            <div className="zeno-auth-card">

              {/* Card header */}
              <div className="zeno-card-header">
                <div className="zeno-accent-pill">
                  <ShieldCheck size={11} aria-hidden />
                  Free to get started
                </div>
                <h2 className="zeno-auth-heading">Create your workspace</h2>
                <p className="zeno-auth-subheading">Register your organisation to get started.</p>
              </div>

              {/* Error */}
              {error && (
                <div className="zeno-error" role="alert">
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              {/* Success */}
              {success && (
                <div className="zeno-success" role="status">
                  <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
                  <span>Workspace created! Redirecting…</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>

                {/* ── Organisation ── */}
                <div className="zeno-section-label">Organisation</div>

                <div className="zeno-field">
                  <label htmlFor="reg-merchant" className="zeno-label">Organisation name</label>
                  <div className="zeno-input-wrap">
                    <span className="zeno-input-icon"><Building2 size={15} aria-hidden /></span>
                    <input
                      id="reg-merchant"
                      type="text"
                      required
                      autoFocus
                      placeholder="Acme Store"
                      value={merchantName}
                      onChange={(e) => setMerchantName(e.target.value)}
                      className="zeno-input"
                      aria-label="Organisation name"
                    />
                  </div>
                </div>

                {/* ── Account details ── */}
                <div className="zeno-section-label">Your account</div>

                <div className="zeno-field">
                  <label htmlFor="reg-name" className="zeno-label">Full name</label>
                  <div className="zeno-input-wrap">
                    <span className="zeno-input-icon"><User size={15} aria-hidden /></span>
                    <input
                      id="reg-name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Jane Smith"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="zeno-input"
                    />
                  </div>
                </div>

                <div className="zeno-field">
                  <label htmlFor="reg-email" className="zeno-label">Work email</label>
                  <div className="zeno-input-wrap">
                    <span className="zeno-input-icon"><Mail size={15} aria-hidden /></span>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="jane@acmestore.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="zeno-input"
                    />
                  </div>
                </div>

                <div className="zeno-field">
                  <label htmlFor="reg-password" className="zeno-label">Password</label>
                  <div className="zeno-input-wrap zeno-pw-wrap">
                    <span className="zeno-input-icon"><Lock size={15} aria-hidden /></span>
                    <input
                      id="reg-password"
                      type={showPw ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="zeno-input zeno-input-pw"
                    />
                    <button type="button" className="zeno-pw-toggle"
                      onClick={() => setShowPw(v => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}>
                      {showPw ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
                    </button>
                  </div>
                </div>

                <div className="zeno-field">
                  <label htmlFor="reg-confirm" className="zeno-label">Confirm password</label>
                  <div className="zeno-input-wrap">
                    <span className="zeno-input-icon"><Lock size={15} aria-hidden /></span>
                    <input
                      id="reg-confirm"
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder="Re-enter password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="zeno-input"
                    />
                  </div>
                </div>

                {/* Submit */}
                <button type="submit" disabled={loading || success} className="zeno-submit" aria-label="Create workspace">
                  {loading
                    ? <span className="zeno-spinner" aria-hidden />
                    : <>Create workspace <ArrowRight size={15} aria-hidden /></>
                  }
                </button>

              </form>



            </div>{/* /card */}

            <div className="zeno-auth-footer-row">
              <span className="zeno-auth-footer-label">Already have a workspace?</span>
              <Link to="/login" className="zeno-switch-btn">
                Sign in
                <span className="zeno-switch-arrow" aria-hidden="true">
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
