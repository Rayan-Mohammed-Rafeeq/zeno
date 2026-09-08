import { Link } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowRight,
  Menu,
  X,
  Check,
  Copy,
  Terminal,
  Play,
  RotateCcw,
  Shield,
  Cpu,
  Layers,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Code2,
  CheckCircle2,
  ShoppingBag,
  Eye,
  Globe
} from 'lucide-react';
import { ZenoLogo } from '@/components/brand/Logo';
import { useForceDark } from '@/hooks/useForceDark';
import { ZenoVisualization } from '@/components/brand/ZenoVisualization';

/* ─────────────────────────────────────────────────────────────────────────────
   LANDING PAGE STYLES
   Deep dark-always identity. The landing page forces dark aesthetics
   regardless of the user's app theme — it is a standalone brand experience.
───────────────────────────────────────────────────────────────────────────── */
const STYLES = `
/* ── RESET & BASE ─────────────────────────────────────────────────────── */
html, body { margin:0; padding:0; }
.lp { min-height:100vh; background:#0c0d14; color:#e8eaf0;
      font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
      overflow-x:hidden; -webkit-font-smoothing:antialiased;
      margin:0; padding:0; position:relative; top:0; }
.lp *, .lp *::before, .lp *::after { box-sizing:border-box; }
.lp a { text-decoration:none; }
.wrap { max-width:1200px; margin:0 auto; padding:0 28px; }
.wrap-wide { max-width:1400px; margin:0 auto; padding:0 28px; }

/* ── SCROLLBAR ────────────────────────────────────────────────────────── */
.lp ::-webkit-scrollbar { width:5px; }
.lp ::-webkit-scrollbar-track { background:transparent; }
.lp ::-webkit-scrollbar-thumb { background:#2e3050; border-radius:3px; }

/* ── BACKGROUND GRID ─────────────────────────────────────────────────── */
.lp-bg-grid {
  position:absolute; inset:0; z-index:0; pointer-events:none;
  background-image:
    linear-gradient(rgba(133,136,230,0.035) 1px,transparent 1px),
    linear-gradient(90deg,rgba(133,136,230,0.035) 1px,transparent 1px);
  background-size:60px 60px;
}
.lp-bg-glow-a {
  position:absolute; top:0; left:10vw; width:600px; height:600px;
  background:radial-gradient(circle,rgba(133,136,230,0.07) 0%,transparent 65%);
  pointer-events:none; z-index:0;
}
.lp-bg-glow-b {
  position:absolute; bottom:10%; right:5vw; width:500px; height:500px;
  background:radial-gradient(circle,rgba(100,180,255,0.04) 0%,transparent 65%);
  pointer-events:none; z-index:0;
}
.lp > *:not(.lp-bg-grid):not(.lp-bg-glow-a):not(.lp-bg-glow-b) { position:relative; z-index:1; }

/* ── NAVIGATION ──────────────────────────────────────────────────────── */
.lp-nav {
  position:fixed; top:0; left:0; right:0; z-index:100;
  background:rgba(12,13,20,0.85); backdrop-filter:blur(20px) saturate(1.4);
  border-bottom:1px solid rgba(133,136,230,0.1);
  padding:0;
}
.lp-nav-inner {
  display:flex; justify-content:space-between; align-items:center;
  height:64px;
}
.lp-brand {
  display:flex; align-items:center; gap:10px;
  font-weight:800; font-size:17px; color:#e8eaf0;
  letter-spacing:3px; user-select:none;
}
.lp-nav-links {
  display:flex; gap:36px; align-items:center;
}
.lp-nav-links a {
  color:rgba(232,234,240,0.55); font-size:14px; font-weight:500;
  letter-spacing:0.3px; transition:color 0.2s;
}
.lp-nav-links a:hover { color:#e8eaf0; }
.lp-nav-actions { display:flex; gap:12px; align-items:center; }

.lp-btn {
  display:inline-flex; align-items:center; gap:7px;
  padding:8px 18px; border-radius:7px;
  font-size:13px; font-weight:600; letter-spacing:0.2px;
  transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1); border:none; cursor:pointer; white-space:nowrap;
  position:relative; overflow:hidden;
}

/* ── shimmer sweep shared keyframe ─ */
@keyframes lp-btn-shimmer {
  0%   { transform:translateX(-120%) skewX(-15deg); }
  100% { transform:translateX(220%)  skewX(-15deg); }
}
@keyframes lp-btn-ripple {
  0%   { transform:scale(0); opacity:0.5; }
  100% { transform:scale(4); opacity:0; }
}
@keyframes lp-btn-glow-pulse {
  0%,100% { box-shadow:0 0 0 0 rgba(133,136,230,0.0), 0 4px 20px rgba(123,127,224,0.45); }
  50%      { box-shadow:0 0 0 6px rgba(133,136,230,0.12), 0 4px 20px rgba(123,127,224,0.45); }
}

/* ── GHOST ─────────────────────────────────────────────────────────── */
.lp-btn-ghost {
  background:transparent; color:rgba(232,234,240,0.65);
  border:1px solid rgba(133,136,230,0.18);
  transition:all 0.25s ease;
}
.lp-btn-ghost::after {
  content:''; position:absolute; inset:0; border-radius:inherit;
  background:rgba(133,136,230,0.08);
  opacity:0; transition:opacity 0.25s;
}
.lp-btn-ghost:hover { color:#e8eaf0; border-color:rgba(133,136,230,0.5); transform:translateY(-2px); }
.lp-btn-ghost:hover::after { opacity:1; }
.lp-btn-ghost:active { transform:translateY(0) scale(0.97); }

/* ── PRIMARY (nav) ─────────────────────────────────────────────────── */
.lp-btn-primary {
  background:linear-gradient(135deg,#7b7fe0 0%,#5e5bc1 100%);
  color:#fff; box-shadow:0 2px 12px rgba(123,127,224,0.3);
  border:1px solid rgba(133,136,230,0.4);
}
.lp-btn-primary::before {
  content:''; position:absolute;
  top:0; left:0; width:45%; height:100%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent);
  transform:translateX(-120%) skewX(-15deg);
  transition:none;
}
.lp-btn-primary:hover {
  background:linear-gradient(135deg,#9195e8 0%,#5e5bc1 100%);
  box-shadow:0 4px 22px rgba(123,127,224,0.55);
  transform:translateY(-2px) scale(1.03);
}
.lp-btn-primary:hover::before { animation:lp-btn-shimmer 0.55s ease forwards; }
.lp-btn-primary:active { transform:translateY(0) scale(0.97); }

/* ── OUTLINE ────────────────────────────────────────────────────────── */
.lp-btn-outline {
  background:transparent; color:#e8eaf0;
  border:1px solid rgba(232,234,240,0.2);
  transition:all 0.25s ease;
}
.lp-btn-outline:hover {
  background:rgba(232,234,240,0.07); border-color:rgba(232,234,240,0.5);
  transform:translateY(-2px); box-shadow:0 4px 16px rgba(0,0,0,0.25);
}
.lp-btn-outline:active { transform:translateY(0) scale(0.97); }

/* ── HERO PRIMARY ───────────────────────────────────────────────────── */
.lp-btn-hero-primary {
  display:inline-flex; align-items:center; gap:8px;
  background:linear-gradient(135deg,#7b7fe0 0%,#5e5bc1 100%);
  color:#fff; box-shadow:0 4px 20px rgba(123,127,224,0.35);
  border:1px solid rgba(133,136,230,0.4);
  padding:11px 26px; font-size:14px; font-weight:600; border-radius:8px;
  cursor:pointer; text-decoration:none; white-space:nowrap;
  position:relative; overflow:hidden;
  transition:all 0.28s cubic-bezier(0.34,1.56,0.64,1);
}
.lp-btn-hero-primary::before {
  content:''; position:absolute;
  top:0; left:0; width:50%; height:100%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent);
  transform:translateX(-120%) skewX(-15deg);
}
.lp-btn-hero-primary::after {
  content:''; position:absolute; inset:0; border-radius:inherit;
  background:radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 70%);
  opacity:0; transition:opacity 0.3s;
}
.lp-btn-hero-primary:hover {
  background:linear-gradient(135deg,#9ea2ef 0%,#7370d8 100%);
  box-shadow:0 8px 32px rgba(123,127,224,0.6), 0 0 0 1px rgba(133,136,230,0.5);
  transform:translateY(-3px) scale(1.04);
}
.lp-btn-hero-primary:hover::before { animation:lp-btn-shimmer 0.6s ease forwards; }
.lp-btn-hero-primary:hover::after { opacity:1; }
.lp-btn-hero-primary:active { transform:translateY(-1px) scale(0.98); box-shadow:0 4px 16px rgba(123,127,224,0.4); }

/* ── HERO SECONDARY ─────────────────────────────────────────────────── */
.lp-btn-hero-secondary {
  display:inline-flex; align-items:center; gap:8px;
  background:transparent; color:rgba(232,234,240,0.65);
  border:1px solid rgba(232,234,240,0.15);
  padding:11px 22px; font-size:14px; font-weight:500; border-radius:8px;
  cursor:pointer; text-decoration:none; white-space:nowrap;
  position:relative; overflow:hidden;
  transition:all 0.28s cubic-bezier(0.34,1.56,0.64,1);
}
.lp-btn-hero-secondary::after {
  content:''; position:absolute; inset:0; border-radius:inherit;
  background:linear-gradient(135deg, rgba(133,136,230,0.08) 0%, rgba(232,234,240,0.04) 100%);
  opacity:0; transition:opacity 0.25s;
}
.lp-btn-hero-secondary:hover {
  color:#e8eaf0; border-color:rgba(133,136,230,0.4);
  transform:translateY(-3px) scale(1.03);
  box-shadow:0 6px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06);
}
.lp-btn-hero-secondary:hover::after { opacity:1; }
.lp-btn-hero-secondary:active { transform:translateY(-1px) scale(0.98); }

.lp-mobile-btn { display:none; background:none; border:none; color:#e8eaf0; cursor:pointer; padding:6px; }
.lp-mobile-menu {
  background:rgba(15,16,24,0.97); border:1px solid rgba(133,136,230,0.15);
  border-radius:14px; padding:20px; margin:0 12px 12px;
  display:flex; flex-direction:column; gap:4px;
  box-shadow:0 20px 60px rgba(0,0,0,0.6);
}
.lp-mobile-menu a, .lp-mobile-menu button {
  display:block; padding:12px 16px; border-radius:8px; color:rgba(232,234,240,0.75);
  font-size:15px; font-weight:500; transition:all 0.15s;
  text-decoration:none; background:none; border:none; cursor:pointer; text-align:left;
}
.lp-mobile-menu a:hover { background:rgba(133,136,230,0.1); color:#e8eaf0; }
.lp-mobile-menu .lp-mm-divider { height:1px; background:rgba(133,136,230,0.12); margin:8px 0; }
.lp-mobile-menu .lp-mm-primary {
  background:linear-gradient(135deg,#7b7fe0,#5e5bc1);
  color:#fff; text-align:center; border-radius:8px;
  padding:12px 16px; font-weight:700;
}

/* ── SECTION LABELS ──────────────────────────────────────────────────── */
.lp-eyebrow {
  display:inline-flex; align-items:center; gap:8px;
  font-size:11px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase;
  color:#8588e6; margin-bottom:20px;
}
.lp-eyebrow::before {
  content:''; display:block; width:20px; height:1px; background:#8588e6;
}

/* ── SECTION REVEAL ──────────────────────────────────────────────────── */
.lp-reveal {
  opacity:0; transform:translateY(32px);
  transition:opacity 0.7s ease, transform 0.7s ease;
}
.lp-reveal.lp-visible { opacity:1; transform:translateY(0); }
.lp-reveal-d1 { transition-delay:0.1s; }
.lp-reveal-d2 { transition-delay:0.2s; }
.lp-reveal-d3 { transition-delay:0.3s; }
.lp-reveal-d4 { transition-delay:0.4s; }

/* ── HERO OFFSET for fixed nav ───────────────────────────────────────── */
.lp-page-body { padding-top:64px; }

/* ══════════════════════════════════════════════════════════════════════
   HERO
══════════════════════════════════════════════════════════════════════ */
.lp-hero {
  display:grid; grid-template-columns:1fr 1fr;
  align-items:center; gap:60px;
  padding:72px 0 80px;
}
.lp-hero-left { padding-right:20px; }
.lp-hero-tag {
  display:inline-flex; align-items:center; gap:8px;
  background:rgba(133,136,230,0.1); border:1px solid rgba(133,136,230,0.25);
  border-radius:100px; padding:6px 14px 6px 8px;
  font-size:12px; font-weight:600; color:#a5a8f4; margin-bottom:32px;
}
.lp-hero-tag-dot {
  width:6px; height:6px; background:#8588e6; border-radius:50%;
  animation:lp-hero-pulse 2s infinite;
}
.lp-hero h1 {
  font-size:clamp(44px,5.5vw,72px); font-weight:800; line-height:1.05;
  letter-spacing:-2px; margin:0 0 28px; color:#f0f1f8;
}
.lp-hero h1 .lp-h1-accent {
  background:linear-gradient(135deg,#a5a8f4 0%,#8588e6 50%,#6366c8 100%);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  background-clip:text;
}
.lp-hero-sub {
  font-size:18px; line-height:1.7; color:rgba(232,234,240,0.6);
  max-width:480px; margin:0 0 40px;
}
.lp-hero-ctas { display:flex; gap:14px; flex-wrap:wrap; margin-bottom:52px; }
.lp-hero-trust {
  display:flex; gap:20px; flex-wrap:wrap;
}
.lp-hero-trust-item {
  display:flex; align-items:center; gap:7px;
  font-size:13px; color:rgba(232,234,240,0.45); font-weight:500;
}
.lp-hero-trust-item svg { color:#4ade80; flex-shrink:0; }

/* ── 3D ORB — proper sphere shading ─────────────────────────────────── */
.lp-orb-scene {
  position:relative; display:flex; justify-content:center; align-items:center;
  height:540px; user-select:none;
}
.lp-orb-stage {
  position:relative; width:320px; height:320px;
  transform-style:preserve-3d;
  transition:transform 0.08s ease-out;
}
/* The sphere itself — multiple stacked gradients for 3D depth */
.lp-orb-core {
  position:absolute; inset:0; border-radius:50%;
  /* Base sphere: dark at bottom-right, light at top-left (light source) */
  background:
    /* specular glint — tiny bright spot */
    radial-gradient(circle at 32% 26%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 18%),
    /* primary lit hemisphere */
    radial-gradient(circle at 38% 34%, rgba(180,183,255,0.45) 0%, rgba(133,136,230,0.28) 25%, rgba(80,84,200,0.15) 50%, transparent 72%),
    /* fill light from opposite side (subtle) */
    radial-gradient(circle at 72% 74%, rgba(60,64,180,0.18) 0%, transparent 45%),
    /* base sphere colour */
    radial-gradient(circle at 50% 50%, #1c1e3e 0%, #0d0e1e 100%);
  border:1px solid rgba(133,136,230,0.3);
  /* Drop shadow below + subtle glow halo */
  box-shadow:
    0 30px 60px rgba(0,0,0,0.55),
    0 8px 24px rgba(0,0,0,0.4),
    0 0 0 1px rgba(133,136,230,0.12),
    0 0 50px rgba(133,136,230,0.14);
  overflow:hidden;
}
/* Rim light — a crescent of pale blue on the lower-left edge */
.lp-orb-core::before {
  content:''; position:absolute; inset:0; border-radius:50%;
  background:radial-gradient(circle at 18% 78%, rgba(120,140,255,0.22) 0%, transparent 38%);
}
/* Atmospheric inner atmosphere tint */
.lp-orb-core::after {
  content:''; position:absolute; inset:0; border-radius:50%;
  background:radial-gradient(circle at 50% 50%, transparent 45%, rgba(8,8,20,0.45) 100%);
}
/* ── ORB EYES ────────────────────────────────────────────────────────── */
.lp-orb-face {
  position:absolute; inset:0; border-radius:50%;
  display:flex; flex-direction:column;
  align-items:center; justify-content:center;
  z-index:3; pointer-events:none; gap:0;
  padding-top:18px; /* push content down so brows have room above */
  transform-style:preserve-3d;
  will-change:transform;
}
.lp-orb-eyes-row {
  display:flex; gap:34px; align-items:center;
  margin-bottom:6px;
}
.lp-orb-eye-wrap {
  position:relative; width:38px; height:38px;
  border-radius:50%;
  background:rgba(8,8,24,0.85);
  border:1.5px solid rgba(133,136,230,0.35);
  overflow:hidden;
  box-shadow:0 0 10px rgba(133,136,230,0.2), inset 0 2px 4px rgba(0,0,0,0.5);
  transition:height 0.25s ease, border-radius 0.25s ease;
}
/* squint — eye becomes shorter vertically */
.lp-orb-eye-wrap.squint { height:22px; border-radius:50%/40%; }
/* wide — eye becomes taller */
.lp-orb-eye-wrap.wide   { height:44px; }
/* sleepy — eye half-closed */
.lp-orb-eye-wrap.sleepy { height:18px; border-radius:50%/35%; }
/* alert — eye stays round but pupil shrinks */
.lp-orb-eye-wrap.alert  { height:42px; }

.lp-orb-pupil {
  position:absolute;
  width:16px; height:16px; border-radius:50%;
  background:#ffffff;
  box-shadow:0 0 8px rgba(255,255,255,0.9), 0 0 16px rgba(255,255,255,0.4);
  transition:transform 0.06s linear;
  /* centre default */
  top:50%; left:50%;
  margin-top:-8px; margin-left:-8px;
}
/* pupil shrinks when alert */
.lp-orb-eye-wrap.alert  .lp-orb-pupil { width:12px; height:12px; margin-top:-6px; margin-left:-6px; }
/* pupil bigger when happy */
.lp-orb-eye-wrap.happy  .lp-orb-pupil { width:18px; height:18px; margin-top:-9px; margin-left:-9px; }

/* eyelid overlay — slides down for sleepy/squint */
.lp-orb-eyelid {
  position:absolute; top:0; left:0; right:0;
  height:0; background:rgba(12,13,26,0.95);
  border-radius:0 0 50% 50%;
  transition:height 0.3s ease;
}
.lp-orb-eye-wrap.sleepy .lp-orb-eyelid { height:55%; }
.lp-orb-eye-wrap.squint .lp-orb-eyelid { height:30%; }

/* eyebrows — absolutely placed above each eye, relative to orb-core */
.lp-orb-brows {
  position:absolute;
  top:calc(50% - 78px);
  left:50%; transform:translateX(-50%);
  width:136px; height:22px;
  overflow:visible; pointer-events:none; z-index:4;
  transform-style:preserve-3d;
  will-change:transform;
}

/* logo mouth area */
.lp-orb-mouth {
  margin-top:4px;
  transition:transform 0.3s ease, opacity 0.3s ease;
}
.lp-orb-mouth.grin   { transform:scale(1.08) translateY(-2px); }
.lp-orb-mouth.flat   { transform:scale(0.95) translateY(2px); opacity:0.8; }
.lp-orb-mouth.open   { transform:scale(1.12) translateY(-3px); }
.lp-orb-mouth.sleepy { transform:scale(0.9) translateY(3px); opacity:0.6; }
.lp-orb-ring {
  position:absolute; border-radius:50%;
  border:1px solid rgba(133,136,230,0.18);
  pointer-events:none;
}
.lp-orb-ring-1 {
  inset:-30px; animation:lp-ring-spin-1 18s linear infinite;
  border-style:dashed; border-color:rgba(133,136,230,0.12);
}
.lp-orb-ring-2 {
  inset:-60px; animation:lp-ring-spin-2 28s linear infinite reverse;
  border-color:rgba(133,136,230,0.08);
}
.lp-orb-ring-3 {
  inset:-95px; animation:lp-ring-spin-3 40s linear infinite;
  border-style:dashed; border-color:rgba(100,140,255,0.06);
}
.lp-orb-dot {
  position:absolute; width:5px; height:5px; border-radius:50%;
  background:#8588e6; box-shadow:0 0 8px rgba(133,136,230,0.8);
}

/* ── EVE-STYLE HANDS ─────────────────────────────────────────────────── */
.lp-orb-hand {
  position:absolute;
  top:calc(50% + 18px);
  pointer-events:none; z-index:5;
  filter:drop-shadow(0 6px 14px rgba(0,0,0,0.65));
  will-change:transform;
}
.lp-orb-hand-left {
  right:calc(100% - 22px);
  transform:translateY(-50%) rotate(-6deg);
  transform-origin:82% 17%;
  transition:transform 0.12s cubic-bezier(0.25,0.46,0.45,0.94);
}
.lp-orb-hand-right {
  left:calc(100% - 22px);
  transform:translateY(-50%) rotate(6deg);
  transform-origin:18% 17%;
  transition:transform 0.12s cubic-bezier(0.25,0.46,0.45,0.94);
}

/* ── SIGNAL NODES around orb ─────────────────────────────────────────── */
.lp-signal {
  position:absolute; display:flex; flex-direction:column; align-items:center; gap:6px;
  animation:lp-float var(--float-dur,5s) ease-in-out infinite;
  animation-delay:var(--float-delay,0s);
}
.lp-signal-chip {
  display:flex; align-items:center; gap:8px;
  background:rgba(18,19,32,0.85);
  border-radius:10px; padding:8px 12px;
  backdrop-filter:blur(12px);
  font-size:11px; font-weight:600; color:rgba(232,234,240,0.7);
  letter-spacing:0.5px; white-space:nowrap;
  box-shadow:0 4px 20px rgba(0,0,0,0.3);
}
.lp-signal-icon {
  width:20px; height:20px; border-radius:5px;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.lp-signal-trail {
  width:1px; height:var(--trail-h,40px);
  background:linear-gradient(to bottom,rgba(133,136,230,0.4),transparent);
}
.lp-signal-trail-up {
  background:linear-gradient(to top,rgba(133,136,230,0.4),transparent);
}

/* signal positions */
.lp-sig-order   { top:4%;  left:12%; --float-dur:5.2s; --float-delay:0s;    --trail-h:50px; }
.lp-sig-customer{ top:18%; right:6%; --float-dur:6.1s; --float-delay:0.7s;  --trail-h:60px; }
.lp-sig-payment { bottom:22%; right:4%; --float-dur:5.5s; --float-delay:1.4s; --trail-h:45px; }
.lp-sig-location{ bottom:8%; left:16%; --float-dur:6.4s; --float-delay:0.4s; --trail-h:55px; }
.lp-sig-history { top:48%;  left:2%;  --float-dur:5.8s; --float-delay:1.1s;  --trail-h:40px; }

/* ── ORDER MICRO CARDS ────────────────────────────────────────────────── */
.lp-order-card {
  position:absolute;
  background:rgba(15,16,26,0.92); border-radius:14px;
  border:1px solid rgba(133,136,230,0.2);
  padding:14px 16px; min-width:190px;
  backdrop-filter:blur(16px);
  box-shadow:0 8px 40px rgba(0,0,0,0.4);
  animation:lp-float var(--oc-dur,7s) ease-in-out infinite;
  animation-delay:var(--oc-delay,0s);
}
.lp-order-card-top {
  display:flex; justify-content:space-between; align-items:flex-start;
  margin-bottom:8px;
}
.lp-order-num { font-size:11px; color:rgba(232,234,240,0.35); font-weight:600; letter-spacing:0.5px; }
.lp-order-amt { font-size:17px; font-weight:800; color:#e8eaf0; }
.lp-order-note { font-size:11px; color:rgba(232,234,240,0.45); margin-bottom:10px; line-height:1.4; }
.lp-badge {
  display:inline-flex; align-items:center; gap:5px;
  font-size:11px; font-weight:700; letter-spacing:0.8px;
  padding:4px 10px; border-radius:6px; text-transform:uppercase;
}
.lp-badge-safe   { background:rgba(74,222,128,0.12); color:#4ade80; border:1px solid rgba(74,222,128,0.25); }
.lp-badge-review { background:rgba(251,191,36,0.12); color:#fbbf24; border:1px solid rgba(251,191,36,0.25); }
.lp-badge-blocked{ background:rgba(248,113,113,0.12); color:#f87171; border:1px solid rgba(248,113,113,0.25); }
.lp-badge-dot { width:5px; height:5px; border-radius:50%; background:currentColor; }

.lp-oc-review { top:8%;   right:-5%; --oc-dur:7.2s; --oc-delay:0.5s; }
.lp-oc-safe   { bottom:5%; right:1%; --oc-dur:8s;   --oc-delay:2s;   }

/* ── TRUST BAR ───────────────────────────────────────────────────────── */
.lp-trust {
  border-top:1px solid rgba(133,136,230,0.08);
  border-bottom:1px solid rgba(0,0,0,0.06);
  background:linear-gradient(180deg, #0c0d14 0%, #11131e 70%, #181b2a 100%);
  padding:28px 0;
}
.lp-trust-inner { display:flex; justify-content:center; gap:60px; flex-wrap:wrap; }
.lp-trust-item {
  display:flex; align-items:center; gap:10px;
  font-size:13px; font-weight:600; color:rgba(232,234,240,0.65);
  letter-spacing:0.3px;
}
.lp-trust-icon {
  width:32px; height:32px; border-radius:8px;
  background:rgba(133,136,230,0.12); border:1px solid rgba(133,136,230,0.22);
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
  color:#a5a8f4;
  box-shadow:0 2px 8px rgba(0,0,0,0.3);
}

/* ══════════════════════════════════════════════════════════════════════
   PROBLEM SECTION (LIGHT SECTION)
══════════════════════════════════════════════════════════════════════ */
.lp-problem {
  padding:120px 0; position:relative;
  background:linear-gradient(180deg, #edf1f7 0%, #f4f6fa 40%, #eef1f7 100%);
  color:#0f172a;
  overflow:hidden;
}
.lp-problem::before {
  content:''; position:absolute; top:5%; right:-8%; width:980px; height:760px;
  background:
    radial-gradient(circle at 60% 45%, rgba(133,136,230,0.16) 0%, rgba(99,102,241,0.07) 35%, rgba(165,168,244,0.03) 60%, transparent 72%),
    radial-gradient(circle at 85% 20%, rgba(165,168,244,0.12) 0%, transparent 55%);
  pointer-events:none; z-index:0;
}
.lp-problem::after {
  content:''; position:absolute; bottom:5%; left:-10%; width:640px; height:640px;
  background:radial-gradient(circle, rgba(165,168,244,0.09) 0%, rgba(133,136,230,0.04) 45%, transparent 68%);
  pointer-events:none; z-index:0;
}
.lp-decor-problem {
  position:absolute; inset:0; pointer-events:none; z-index:0; overflow:hidden;
}
.lp-problem-header { max-width:640px; margin:0 auto 80px; text-align:center; position:relative; z-index:1; }
.lp-problem .lp-eyebrow { color:#4f46e5; }
.lp-problem .lp-eyebrow::before { background:#4f46e5; }
.lp-problem .lp-section-h2 {
  font-size:clamp(32px,3.5vw,50px); font-weight:800; line-height:1.1;
  letter-spacing:-1px; color:#0f172a; margin:0 0 20px;
}
.lp-problem .lp-section-sub {
  font-size:18px; line-height:1.65; color:#475569; margin:0;
}
.lp-problem-layout {
  display:grid; grid-template-columns:1fr 1.1fr; gap:80px; align-items:center;
  position:relative; z-index:1;
}
.lp-problem-items { display:flex; flex-direction:column; gap:36px; }
.lp-problem-item { display:flex; gap:20px; align-items:flex-start; }
.lp-problem-icon-wrap {
  width:44px; height:44px; border-radius:11px; flex-shrink:0; margin-top:2px;
  display:flex; align-items:center; justify-content:center; font-size:19px;
  background:rgba(99,102,241,0.07); border:1px solid rgba(99,102,241,0.2);
  color:#4f46e5;
  box-shadow:0 2px 10px rgba(99,102,241,0.06);
}
.lp-problem-text h3 { font-size:17px; font-weight:700; color:#0f172a; margin:0 0 7px; }
.lp-problem-text p { font-size:14px; line-height:1.65; color:#475569; margin:0; }

/* ── ORDERS FLOW VISUAL (LIGHT EMBED) ────────────────────────────────── */
.lp-orders-flow {
  position:relative; background:#ffffff;
  border:1px solid rgba(133,136,230,0.28); border-radius:22px;
  padding:30px; overflow:hidden;
  box-shadow:
    0 24px 60px -12px rgba(99,102,241,0.12),
    0 4px 16px rgba(15,23,42,0.04),
    inset 0 1px 0 rgba(255,255,255,0.95),
    inset 0 0 24px rgba(133,136,230,0.03);
  transition:all 0.3s cubic-bezier(0.16,1,0.3,1);
}
.lp-orders-flow::before {
  content:''; position:absolute; top:0; left:0; right:0; height:2px;
  background:linear-gradient(90deg,transparent,rgba(133,136,230,0.85),transparent);
}
.lp-orders-flow:hover {
  border-color:rgba(133,136,230,0.45);
  box-shadow:
    0 32px 75px -14px rgba(99,102,241,0.18),
    0 6px 20px rgba(15,23,42,0.05),
    inset 0 1px 0 #ffffff;
}
.lp-flow-label {
  font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase;
  color:#64748b; margin-bottom:20px; display:flex; align-items:center; gap:8px;
}
.lp-flow-label::after {
  content:''; flex:1; height:1px; background:#e2e8f0;
}
.lp-flow-orders { display:flex; flex-direction:column; gap:10px; }
.lp-flow-order {
  display:flex; justify-content:space-between; align-items:center;
  padding:12px 16px; border-radius:10px;
  border:1px solid #e2e8f0;
  background:#f8fafc;
  box-shadow:0 2px 6px rgba(15,23,42,0.03);
  animation:lp-slide-in 0.6s ease both;
  transition:border-color 0.2s, background 0.2s, transform 0.2s, box-shadow 0.2s;
}
.lp-flow-order:hover {
  border-color:rgba(133,136,230,0.4);
  background:#ffffff;
  transform:translateX(2px);
  box-shadow:0 4px 14px rgba(99,102,241,0.08);
}
.lp-flow-order:nth-child(1) { animation-delay:0.1s; }
.lp-flow-order:nth-child(2) { animation-delay:0.3s; }
.lp-flow-order:nth-child(3) { animation-delay:0.5s; }
.lp-flow-order:nth-child(4) { animation-delay:0.7s; }
.lp-flow-order:nth-child(5) { animation-delay:0.9s; }
.lp-flow-left { display:flex; flex-direction:column; gap:3px; }
.lp-flow-order-id { font-size:11px; color:#64748b; font-weight:600; letter-spacing:0.5px; }
.lp-flow-order-amt { font-size:15px; font-weight:700; color:#0f172a; }
.lp-flow-order-hint { font-size:11px; color:#64748b; margin-top:1px; }

/* watching indicator */
.lp-flow-watching {
  margin-top:18px; display:flex; align-items:center; gap:10px;
  padding:10px 16px; border-radius:10px;
  background:rgba(99,102,241,0.05); border:1px solid rgba(99,102,241,0.18);
}
.lp-flow-watching-dot {
  width:8px; height:8px; border-radius:50%; background:#6366f1;
  animation:lp-hero-pulse 2s infinite; flex-shrink:0;
}
.lp-flow-watching span { font-size:12px; color:#475569; font-weight:500; }

/* Light badge overrides */
.lp-problem .lp-badge-safe { background:rgba(22,163,74,0.1); color:#16a34a; border:1px solid rgba(22,163,74,0.25); }
.lp-problem .lp-badge-review { background:rgba(217,119,6,0.1); color:#d97706; border:1px solid rgba(217,119,6,0.25); }
.lp-problem .lp-badge-blocked { background:rgba(220,38,38,0.1); color:#dc2626; border:1px solid rgba(220,38,38,0.25); }

/* ══════════════════════════════════════════════════════════════════════
   HOW IT WORKS (DOCKER-STYLE DEVELOPER WORKFLOW SECTION)
══════════════════════════════════════════════════════════════════════ */
.lp-hiw {
  padding: 120px 0 100px;
  position: relative;
  background: radial-gradient(circle at 50% 15%, rgba(99,102,241,0.08) 0%, transparent 60%),
              linear-gradient(180deg, #080911 0%, #0b0d18 50%, #07080e 100%);
  color: #e8eaf0;
  box-shadow: inset 0 20px 40px -10px rgba(0,0,0,0.6);
  overflow: hidden;
}
.lp-hiw::before {
  content:''; position:absolute; top:20%; left:50%; transform:translateX(-50%);
  width:1000px; height:600px;
  background:radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, rgba(59,130,246,0.04) 40%, transparent 75%);
  pointer-events:none; z-index:0;
}
.lp-hiw-header { max-width:680px; margin:0 auto 44px; text-align:center; position:relative; z-index:1; }
.lp-hiw .lp-eyebrow { color:#818cf8; }
.lp-hiw .lp-eyebrow::before { background:#818cf8; }
.lp-hiw .lp-section-h2 { color:#f0f1f8; font-size:clamp(32px, 3.8vw, 50px); font-weight:800; line-height:1.15; letter-spacing:-1px; margin:0 0 16px; }
.lp-hiw .lp-section-sub { color:rgba(232,234,240,0.6); font-size:17px; line-height:1.6; margin:0; }

/* ── INTERACTIVE PRESENTER DEMO BAR ──────────────────────────────────── */
.lp-presenter-bar {
  background: linear-gradient(135deg, rgba(22,26,50,0.95) 0%, rgba(14,17,34,0.96) 100%);
  border: 1px solid rgba(133,136,230,0.3);
  border-radius: 18px; padding: 14px 20px; margin-bottom: 24px;
  display: flex; justify-content: space-between; align-items: center;
  box-shadow: 0 16px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08);
  position: relative; z-index: 2; flex-wrap: wrap; gap: 14px;
}
.lp-presenter-info {
  display: flex; align-items: center; gap: 14px; flex: 1; min-width: 280px;
}
.lp-presenter-badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: linear-gradient(135deg, rgba(99,102,241,0.28) 0%, rgba(133,136,230,0.18) 100%);
  border: 1px solid rgba(133,136,230,0.4);
  padding: 6px 12px; border-radius: 8px;
  font-size: 11px; font-weight: 800; letter-spacing: 1.5px;
  color: #a5b4fc; text-transform: uppercase; white-space: nowrap; flex-shrink: 0;
}
.lp-presenter-pulse-dot {
  width: 7px; height: 7px; border-radius: 50%; background: #4ade80;
  box-shadow: 0 0 10px #4ade80; animation: lp-hero-pulse 1.8s infinite;
}
.lp-presenter-quote {
  font-size: 13.5px; line-height: 1.5; color: #e2e8f0; font-weight: 500;
  font-style: italic;
}
.lp-presenter-quote span {
  color: #818cf8; font-weight: 700; font-style: normal; margin-right: 6px;
}
.lp-presenter-controls {
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
}
/* Auto-play progress track under the presenter bar */
.lp-auto-progress {
  height: 2px; background: rgba(133,136,230,0.12); border-radius: 0 0 18px 18px;
  overflow: hidden; margin-top: -1px;
}
.lp-auto-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #7b7fe0, #a5a8f4);
  border-radius: inherit;
  animation: lp-auto-fill 4s linear forwards;
  transform-origin: left;
}
@keyframes lp-auto-fill {
  from { width: 0%; }
  to   { width: 100%; }
}
.lp-pres-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 13px; border-radius: 8px; font-size: 12px; font-weight: 700;
  cursor: pointer; transition: all 0.2s; border: none;
}
.lp-pres-btn-play {
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: #ffffff; box-shadow: 0 2px 10px rgba(99,102,241,0.4);
  border: 1px solid rgba(133,136,230,0.35);
}
.lp-pres-btn-play:hover {
  background: linear-gradient(135deg, #7b7fe0, #5e5bc1);
  transform: translateY(-1px);
}
.lp-pres-btn-nav {
  background: rgba(18,22,42,0.8); color: rgba(232,234,240,0.75);
  border: 1px solid rgba(133,136,230,0.22); padding: 7px 10px;
}
.lp-pres-btn-nav:hover:not(:disabled) {
  background: rgba(99,102,241,0.2); color: #ffffff; border-color: rgba(133,136,230,0.4);
}
.lp-pres-btn-nav:disabled { opacity: 0.35; cursor: not-allowed; }
.lp-pres-progress {
  display: flex; align-items: center; gap: 4px; padding: 0 4px;
}
.lp-pres-bar {
  width: 16px; height: 4px; border-radius: 4px; background: rgba(133,136,230,0.2);
  transition: all 0.3s;
}
.lp-pres-bar.active {
  width: 24px; background: #818cf8; box-shadow: 0 0 8px rgba(129,140,248,0.6);
}

/* ── INTERACTIVE DEMO VIEW (RIGHT PANEL) ─────────────────────────────── */
.lp-demo-interactive {
  padding: 22px; min-height: 330px; display: flex; flex-direction: column;
  justify-content: space-between; background: rgba(8,10,20,0.75);
}
.lp-demo-screen-header {
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 12px; border-bottom: 1px solid rgba(133,136,230,0.14);
  margin-bottom: 16px;
}
.lp-demo-order-badge {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px; font-weight: 700; color: #818cf8;
}
.lp-demo-order-amount {
  font-size: 16px; font-weight: 800; color: #f1f5f9;
}

/* Stage 1: Incoming Order Showcase */
.lp-demo-order-box {
  background: rgba(15,19,38,0.9);
  border: 1px solid rgba(133,136,230,0.25);
  border-radius: 14px; padding: 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  margin-bottom: 16px;
}
.lp-demo-order-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 0; border-bottom: 1px solid rgba(133,136,230,0.08);
  font-size: 12.5px;
}
.lp-demo-order-row:last-child { border-bottom: none; }
.lp-demo-order-label { color: rgba(232,234,240,0.5); font-weight: 500; }
.lp-demo-order-val { color: #f1f5f9; font-weight: 600; }

/* Stage 2: Telemetry Radar Scanner */
.lp-demo-telemetry-grid {
  display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 16px;
}
.lp-demo-telemetry-item {
  background: rgba(15,19,38,0.85); border: 1px solid rgba(133,136,230,0.18);
  border-radius: 10px; padding: 9px 12px;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px;
}
.lp-demo-telemetry-left {
  display: flex; align-items: center; gap: 8px; color: #e2e8f0; font-weight: 500;
}
.lp-demo-pill-warn {
  font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px;
  background: rgba(251,191,36,0.15); color: #fbbf24; border: 1px solid rgba(251,191,36,0.3);
}
.lp-demo-pill-block {
  font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px;
  background: rgba(248,113,113,0.15); color: #f87171; border: 1px solid rgba(248,113,113,0.3);
}

/* Stage 3: Explainable Reasons */
.lp-demo-evidence-list {
  display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;
}
.lp-demo-evidence-item {
  background: rgba(18,22,44,0.85); border-left: 3px solid #f59e0b;
  border-radius: 0 10px 10px 0; padding: 9px 12px; font-size: 12px;
  color: rgba(232,234,240,0.88); line-height: 1.5;
}

/* Stage 4: Decision Actions */
.lp-demo-action-prompt {
  text-align: center; margin-bottom: 12px;
}
.lp-demo-action-title {
  font-size: 13.5px; font-weight: 700; color: #f1f5f9; margin-bottom: 3px;
}
.lp-demo-action-sub {
  font-size: 11.5px; color: rgba(232,234,240,0.5);
}
.lp-demo-action-buttons {
  display: flex; gap: 10px; justify-content: center; margin-bottom: 14px;
}
.lp-demo-btn-hold {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #ffffff; border: 1px solid rgba(248,113,113,0.4);
  padding: 9px 16px; border-radius: 8px; font-size: 12.5px; font-weight: 700;
  cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px;
  box-shadow: 0 4px 14px rgba(239,68,68,0.35);
}
.lp-demo-btn-hold:hover {
  background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
  transform: translateY(-2px); box-shadow: 0 6px 20px rgba(239,68,68,0.5);
}
.lp-demo-btn-approve {
  background: transparent; color: rgba(232,234,240,0.7);
  border: 1px solid rgba(133,136,230,0.25);
  padding: 9px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 600;
  cursor: pointer; transition: all 0.2s;
}
.lp-demo-btn-approve:hover {
  background: rgba(133,136,230,0.1); color: #ffffff; border-color: rgba(133,136,230,0.45);
}

/* Success Result banner */
.lp-demo-success-banner {
  background: linear-gradient(135deg, rgba(22,101,52,0.35) 0%, rgba(20,83,45,0.2) 100%);
  border: 1px solid rgba(74,222,128,0.4);
  border-radius: 12px; padding: 14px; text-align: center;
  box-shadow: 0 8px 24px rgba(74,222,128,0.12);
}
.lp-demo-success-title {
  font-size: 13.5px; font-weight: 800; color: #4ade80; margin-bottom: 5px;
  display: flex; align-items: center; justify-content: center; gap: 7px;
}
.lp-demo-success-desc {
  font-size: 11.5px; color: rgba(232,234,240,0.75); line-height: 1.5; margin-bottom: 10px;
}

/* Big primary interactive trigger button inside demo */
.lp-demo-trigger-btn {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: #ffffff; border: 1px solid rgba(133,136,230,0.4);
  padding: 11px 18px; border-radius: 10px; font-size: 13px; font-weight: 700;
  cursor: pointer; transition: all 0.25s;
  box-shadow: 0 4px 16px rgba(99,102,241,0.35);
}
.lp-demo-trigger-btn:hover {
  background: linear-gradient(135deg, #7b7fe0 0%, #5e5bc1 100%);
  transform: translateY(-2px); box-shadow: 0 6px 22px rgba(99,102,241,0.5);
}

/* Presenter Callout Pointer */
.lp-presenter-click-hint {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: rgba(99,102,241,0.18); border: 1px solid rgba(133,136,230,0.38);
  border-radius: 100px; padding: 5px 14px;
  font-size: 11.5px; font-weight: 700; color: #c7d2fe;
  margin: 10px auto 0; width: fit-content;
  animation: lp-pointer-bounce 1.6s ease-in-out infinite;
  cursor: pointer;
}
@keyframes lp-pointer-bounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}

/* ── DOCKER-STYLE SEGMENTED WORKFLOW TABS ────────────────────────────── */
.lp-docker-tabs-wrap {
  display:flex; justify-content:center; margin-bottom:36px; position:relative; z-index:1;
}
.lp-docker-tabs {
  display:inline-flex; align-items:center; gap:6px;
  background:rgba(15,18,34,0.92);
  border:1px solid rgba(133,136,230,0.22);
  border-radius:100px; padding:6px;
  box-shadow:0 8px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
  backdrop-filter:blur(16px);
  max-width:100%; overflow-x:auto; scrollbar-width:none;
}
.lp-docker-tabs::-webkit-scrollbar { display:none; }

.lp-dtab-btn {
  display:inline-flex; align-items:center; gap:9px;
  background:transparent; border:1px solid transparent;
  color:rgba(232,234,240,0.6);
  padding:10px 22px; border-radius:100px;
  font-size:13.5px; font-weight:600; letter-spacing:0.3px;
  cursor:pointer; white-space:nowrap;
  transition:all 0.25s cubic-bezier(0.16,1,0.3,1);
  position:relative;
}
.lp-dtab-btn:hover {
  color:#f0f1f8; background:rgba(133,136,230,0.08);
}
.lp-dtab-btn.active {
  background:linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(133,136,230,0.18) 100%);
  border:1px solid rgba(133,136,230,0.45);
  color:#ffffff;
  box-shadow:0 4px 20px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.12);
}
.lp-dtab-icon {
  width:22px; height:22px; border-radius:6px;
  display:flex; align-items:center; justify-content:center;
  background:rgba(255,255,255,0.06); font-size:12px;
  transition:all 0.2s;
}
.lp-dtab-btn.active .lp-dtab-icon {
  background:linear-gradient(135deg,#6366f1,#818cf8);
  color:#ffffff; box-shadow:0 0 10px rgba(99,102,241,0.4);
}
.lp-dtab-num {
  font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size:11px; opacity:0.75; font-weight:700;
}

/* ── DOCKER-STYLE 2-COLUMN SHOWCASE ──────────────────────────────────── */
.lp-docker-stage {
  display:grid; grid-template-columns:1fr 1.22fr; gap:36px;
  align-items:stretch; position:relative; z-index:1; margin-bottom:52px;
}

/* LEFT PANEL: Story & Capabilities */
.lp-dpanel-left {
  background:linear-gradient(180deg, rgba(14,17,32,0.92) 0%, rgba(10,12,24,0.95) 100%);
  border:1px solid rgba(133,136,230,0.2);
  border-radius:22px; padding:38px 34px;
  display:flex; flex-direction:column; justify-content:space-between;
  box-shadow:0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06);
  backdrop-filter:blur(12px);
}
.lp-dstep-kicker {
  display:inline-flex; align-items:center; gap:8px;
  font-size:11px; font-weight:800; letter-spacing:2px; text-transform:uppercase;
  color:#818cf8; background:rgba(99,102,241,0.12);
  border:1px solid rgba(99,102,241,0.28);
  padding:5px 12px; border-radius:6px; margin-bottom:18px;
  width:fit-content;
}
.lp-dstep-kicker-dot {
  width:6px; height:6px; border-radius:50%; background:#818cf8;
  animation:lp-hero-pulse 2s infinite;
}
.lp-dstep-title {
  font-size:clamp(23px, 2.3vw, 30px); font-weight:800; color:#f1f5f9;
  line-height:1.22; letter-spacing:-0.5px; margin:0 0 14px;
}
.lp-dstep-desc {
  font-size:15px; line-height:1.65; color:rgba(232,234,240,0.65);
  margin:0 0 28px;
}
.lp-dfeature-list {
  display:flex; flex-direction:column; gap:16px; margin-bottom:32px;
}
.lp-dfeature-item {
  display:flex; gap:14px; align-items:flex-start;
}
.lp-dfeature-icon {
  width:24px; height:24px; border-radius:7px;
  background:rgba(74,222,128,0.12); border:1px solid rgba(74,222,128,0.28);
  color:#4ade80; display:flex; align-items:center; justify-content:center;
  font-size:12px; flex-shrink:0; margin-top:2px;
}
.lp-dfeature-body h4 {
  font-size:14px; font-weight:700; color:#e2e8f0; margin:0 0 3px;
}
.lp-dfeature-body p {
  font-size:13px; line-height:1.55; color:rgba(232,234,240,0.5); margin:0;
}
.lp-dpanel-footer {
  display:flex; justify-content:space-between; align-items:center;
  padding-top:22px; border-top:1px solid rgba(133,136,230,0.12);
  flex-wrap:wrap; gap:14px;
}
.lp-dstep-cta {
  display:inline-flex; align-items:center; gap:8px;
  background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);
  color:#ffffff; font-size:13px; font-weight:600;
  padding:10px 20px; border-radius:8px; text-decoration:none;
  box-shadow:0 4px 16px rgba(99,102,241,0.35);
  border:1px solid rgba(133,136,230,0.3);
  transition:all 0.25s cubic-bezier(0.16,1,0.3,1);
}
.lp-dstep-cta:hover {
  background:linear-gradient(135deg,#7b7fe0 0%,#5e5bc1 100%);
  box-shadow:0 6px 24px rgba(99,102,241,0.5);
  transform:translateY(-2px);
}
.lp-dstep-nav {
  display:flex; align-items:center; gap:12px;
}
.lp-dstep-btn {
  width:34px; height:34px; border-radius:8px;
  background:rgba(18,22,40,0.8); border:1px solid rgba(133,136,230,0.22);
  color:rgba(232,234,240,0.7); display:flex; align-items:center; justify-content:center;
  cursor:pointer; transition:all 0.2s;
}
.lp-dstep-btn:hover:not(:disabled) {
  background:rgba(99,102,241,0.2); border-color:rgba(133,136,230,0.45);
  color:#ffffff;
}
.lp-dstep-btn:disabled { opacity:0.35; cursor:not-allowed; }
.lp-dstep-dots { display:flex; gap:6px; }
.lp-dstep-dot {
  width:7px; height:7px; border-radius:50%; background:rgba(133,136,230,0.25);
  cursor:pointer; transition:all 0.2s;
}
.lp-dstep-dot.active {
  width:20px; border-radius:10px; background:#818cf8;
}

/* RIGHT PANEL: Docker-style Terminal & Code Sandbox */
.lp-dpanel-right {
  background:linear-gradient(180deg, #0a0c16 0%, #060810 100%);
  border:1px solid rgba(133,136,230,0.24);
  border-radius:22px; overflow:hidden;
  box-shadow:0 30px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.08);
  display:flex; flex-direction:column; position:relative; min-height:450px;
}
.lp-dterm-topbar {
  display:flex; justify-content:space-between; align-items:center;
  padding:12px 18px;
  background:rgba(15,18,34,0.92); border-bottom:1px solid rgba(133,136,230,0.14);
  flex-wrap:wrap; gap:10px;
}
.lp-dterm-left {
  display:flex; align-items:center; gap:16px;
}
.lp-dterm-dots {
  display:flex; gap:6px;
}
.lp-dterm-dot {
  width:10px; height:10px; border-radius:50%;
}
.lp-dterm-dot.red { background:#ef4444; }
.lp-dterm-dot.yellow { background:#f59e0b; }
.lp-dterm-dot.green { background:#10b981; }

.lp-dterm-views {
  display:flex; gap:4px;
}
.lp-dterm-view-btn {
  background:transparent; border:none;
  padding:5px 12px; border-radius:6px;
  font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size:12px; color:rgba(232,234,240,0.55);
  cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px;
}
.lp-dterm-view-btn:hover {
  color:#f0f1f8; background:rgba(255,255,255,0.04);
}
.lp-dterm-view-btn.active {
  background:rgba(99,102,241,0.18); border:1px solid rgba(99,102,241,0.32);
  color:#e0e7ff; font-weight:600;
}

.lp-dterm-actions {
  display:flex; align-items:center; gap:8px;
}
.lp-dterm-run-btn {
  display:inline-flex; align-items:center; gap:6px;
  background:rgba(74,222,128,0.12); border:1px solid rgba(74,222,128,0.3);
  color:#4ade80; font-size:11.5px; font-weight:700;
  padding:5px 12px; border-radius:6px; cursor:pointer;
  transition:all 0.2s;
}
.lp-dterm-run-btn:hover {
  background:rgba(74,222,128,0.22); border-color:#4ade80;
  box-shadow:0 0 14px rgba(74,222,128,0.25);
  transform:translateY(-1px);
}
.lp-dterm-copy-btn {
  display:inline-flex; align-items:center; gap:6px;
  background:rgba(133,136,230,0.08); border:1px solid rgba(133,136,230,0.2);
  color:rgba(232,234,240,0.7); font-size:11.5px; font-weight:600;
  padding:5px 10px; border-radius:6px; cursor:pointer;
  transition:all 0.2s;
}
.lp-dterm-copy-btn:hover {
  color:#ffffff; background:rgba(133,136,230,0.18); border-color:rgba(133,136,230,0.4);
}

.lp-dterm-body {
  padding:20px 22px; flex:1; min-height:320px; max-height:430px; overflow-y:auto;
  font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size:12.5px; line-height:1.7; color:#e2e8f0;
  background:rgba(6,8,16,0.65);
}
.lp-dterm-code-pre {
  margin:0; padding:0; white-space:pre-wrap; word-break:break-word;
}
.lp-code-line { display:block; }
.lp-code-num {
  display:inline-block; width:28px; color:rgba(232,234,240,0.22);
  user-select:none; text-align:right; margin-right:16px;
}
/* Syntax Highlighting */
.lp-kw   { color:#818cf8; font-weight:700; }
.lp-fn   { color:#38bdf8; }
.lp-str  { color:#4ade80; }
.lp-num  { color:#fbbf24; }
.lp-cmt  { color:#64748b; font-style:italic; }
.lp-prop { color:#c084fc; }
.lp-cmd  { color:#38bdf8; font-weight:700; }

/* Simulation console log streams */
.lp-sim-logs {
  display:flex; flex-direction:column; gap:8px;
}
.lp-sim-line {
  display:flex; align-items:flex-start; gap:10px;
  animation:lp-sim-fade 0.3s ease-out both;
}
.lp-sim-time { color:rgba(232,234,240,0.35); font-size:11px; flex-shrink:0; }
.lp-sim-tag {
  font-size:10px; font-weight:800; letter-spacing:0.5px; padding:2px 6px;
  border-radius:4px; text-transform:uppercase; flex-shrink:0;
}
.lp-sim-tag-info   { background:rgba(99,102,241,0.15); color:#818cf8; border:1px solid rgba(99,102,241,0.3); }
.lp-sim-tag-ok     { background:rgba(74,222,128,0.15); color:#4ade80; border:1px solid rgba(74,222,128,0.3); }
.lp-sim-tag-warn   { background:rgba(251,191,36,0.15); color:#fbbf24; border:1px solid rgba(251,191,36,0.3); }
.lp-sim-tag-block  { background:rgba(248,113,113,0.15); color:#f87171; border:1px solid rgba(248,113,113,0.3); }
.lp-sim-msg { color:rgba(232,234,240,0.88); font-size:12.5px; }

@keyframes lp-sim-fade {
  from { opacity:0; transform:translateY(6px); }
  to   { opacity:1; transform:translateY(0); }
}

.lp-dterm-cursor {
  display:inline-block; width:8px; height:15px; background:#818cf8;
  vertical-align:middle; margin-left:4px;
  animation:lp-cursor-blink 1s step-end infinite;
}
@keyframes lp-cursor-blink { 50% { opacity:0; } }

.lp-dterm-footer {
  display:flex; justify-content:space-between; align-items:center;
  padding:10px 18px;
  background:rgba(12,15,28,0.95); border-top:1px solid rgba(133,136,230,0.12);
  font-size:11.5px; color:rgba(232,234,240,0.5); flex-wrap:wrap; gap:10px;
}
.lp-dterm-status {
  display:flex; align-items:center; gap:8px; font-weight:600;
}
.lp-dterm-status-dot {
  width:7px; height:7px; border-radius:50%; background:#4ade80;
  box-shadow:0 0 8px rgba(74,222,128,0.6);
}
.lp-dterm-meta {
  display:flex; align-items:center; gap:16px;
}

/* ── DOCKER-STYLE BOTTOM PERFORMANCE METRICS ─────────────────────────── */
.lp-docker-metrics {
  display:grid; grid-template-columns:repeat(4,1fr); gap:18px;
  margin-bottom:60px; position:relative; z-index:1;
}
.lp-dmetric-card {
  background:rgba(14,17,32,0.8);
  border:1px solid rgba(133,136,230,0.18);
  border-radius:16px; padding:22px 20px;
  box-shadow:0 10px 30px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04);
  transition:all 0.25s;
}
.lp-dmetric-card:hover {
  border-color:rgba(133,136,230,0.4);
  background:rgba(18,22,42,0.92);
  transform:translateY(-2px);
}
.lp-dmetric-val {
  font-size:27px; font-weight:800; color:#f1f5f9; letter-spacing:-0.5px;
  margin-bottom:6px; display:flex; align-items:center; gap:6px;
}
.lp-dmetric-val .accent {
  background:linear-gradient(135deg,#818cf8,#a5b4fc);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent;
}
.lp-dmetric-label {
  font-size:13px; font-weight:700; color:#e2e8f0; margin-bottom:4px;
}
.lp-dmetric-desc {
  font-size:12px; line-height:1.5; color:rgba(232,234,240,0.5); margin:0;
}

/* ── ORDER JOURNEY PIPELINE (UPGRADED) ───────────────────────────────── */
.lp-journey { position:relative; z-index:1; }
.lp-journey-header {
  text-align:center; margin-bottom:28px;
}
.lp-journey-label {
  display:inline-flex; align-items:center; gap:8px;
  font-size:11px; font-weight:800; letter-spacing:2px; text-transform:uppercase;
  color:#818cf8; background:rgba(99,102,241,0.1);
  border:1px solid rgba(99,102,241,0.22);
  padding:4px 12px; border-radius:100px;
}
.lp-journey-track {
  position:relative; display:grid; grid-template-columns:repeat(4,1fr); gap:16px;
}
.lp-journey-stage {
  background:rgba(13,16,30,0.85);
  border:1px solid rgba(99,102,241,0.16);
  border-radius:16px; padding:22px 18px; position:relative;
  box-shadow:0 12px 36px rgba(0,0,0,0.35);
  transition:border-color 0.25s, background 0.25s;
}
.lp-journey-stage:hover {
  border-color:rgba(133,136,230,0.35);
  background:rgba(16,20,38,0.92);
}
.lp-journey-stage-top {
  display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;
}
.lp-journey-stage-label {
  font-size:11px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase;
  color:rgba(232,234,240,0.45);
}
.lp-journey-stage-badge {
  font-size:10px; font-weight:700; color:#818cf8;
  background:rgba(99,102,241,0.12); padding:2px 6px; border-radius:4px;
}
.lp-journey-card {
  background:rgba(18,22,40,0.92); border:1px solid rgba(99,102,241,0.16);
  border-radius:10px; padding:12px 14px; margin-bottom:8px;
  box-shadow:0 4px 14px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04);
  transition:all 0.2s;
}
.lp-journey-card:hover {
  border-color:rgba(99,102,241,0.35);
  background:rgba(24,29,54,0.98);
  transform:translateY(-1px);
}
.lp-journey-card-amt { font-size:15px; font-weight:700; color:#e8eaf0; }
.lp-journey-card-hint { font-size:11.5px; color:rgba(232,234,240,0.5); margin-top:3px; }
.lp-journey-card-result { margin-top:8px; }

/* Responsive adjustments */
@media (max-width: 960px) {
  .lp-docker-stage { grid-template-columns:1fr; }
  .lp-docker-metrics { grid-template-columns:repeat(2,1fr); }
  .lp-journey-track { grid-template-columns:repeat(2,1fr); }
}
@media (max-width: 640px) {
  .lp-docker-tabs { width:100%; border-radius:14px; }
  .lp-dtab-btn { padding:8px 14px; font-size:12px; }
  .lp-docker-metrics { grid-template-columns:1fr; }
  .lp-journey-track { grid-template-columns:1fr; }
  .lp-dpanel-left { padding:24px 20px; }
}

/* ══════════════════════════════════════════════════════════════════════
   PRODUCT SHOWCASE (DARK CONSOLE)
══════════════════════════════════════════════════════════════════════ */
.lp-product {
  padding:120px 0; position:relative;
  background:#090b14;
}
.lp-product-layout { display:grid; grid-template-columns:1fr 1.15fr; gap:80px; align-items:start; }
.lp-product-copy { padding-top:20px; }
.lp-product .lp-eyebrow { color:#818cf8; }
.lp-product .lp-eyebrow::before { background:#818cf8; }
.lp-product-copy h2 { font-size:clamp(28px,3vw,44px); font-weight:800; letter-spacing:-0.8px; color:#f0f1f8; margin:0 0 18px; line-height:1.1; }
.lp-product-copy p { font-size:17px; line-height:1.7; color:rgba(232,234,240,0.52); margin:0 0 36px; }
.lp-product-checks { display:flex; flex-direction:column; gap:14px; }
.lp-product-check { display:flex; align-items:center; gap:12px; font-size:14px; color:rgba(232,234,240,0.65); }
.lp-product-check-icon { width:20px; height:20px; border-radius:50%; background:rgba(74,222,128,0.15); border:1px solid rgba(74,222,128,0.3); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#4ade80; font-size:10px; font-weight:800; }

/* ── DASHBOARD MOCKUP ────────────────────────────────────────────────── */
.lp-dash {
  background:linear-gradient(180deg, rgba(14,16,28,0.98) 0%, rgba(10,12,22,0.96) 100%);
  border:1px solid rgba(99,102,241,0.22);
  border-radius:18px; overflow:hidden;
  box-shadow:0 30px 90px rgba(0,0,0,0.65), 0 0 0 1px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.08);
  position:relative;
}
.lp-dash::before {
  content:''; position:absolute; top:0; left:15%; right:15%; height:1px;
  background:linear-gradient(90deg,transparent,rgba(129,140,248,0.45),transparent);
}
.lp-dash-topbar {
  display:flex; gap:6px; padding:14px 18px;
  background:rgba(99,102,241,0.05); border-bottom:1px solid rgba(99,102,241,0.12);
}
.lp-dash-dot { width:10px; height:10px; border-radius:50%; }
.lp-dash-title { margin-left:auto; font-size:12px; color:rgba(232,234,240,0.3); font-weight:500; }
.lp-dash-body { padding:20px; }
.lp-dash-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:18px; }
.lp-dash-stat {
  background:rgba(18,21,38,0.72); border:1px solid rgba(99,102,241,0.14);
  border-radius:10px; padding:14px 16px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);
}
.lp-dash-stat-label { font-size:10px; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:rgba(232,234,240,0.35); margin-bottom:6px; }
.lp-dash-stat-val { font-size:20px; font-weight:800; }
.lp-dash-stat-val.green { color:#4ade80; }
.lp-dash-stat-val.amber { color:#fbbf24; }
.lp-dash-stat-val.red   { color:#f87171; }
.lp-dash-orders-label { font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:rgba(232,234,240,0.3); margin-bottom:10px; }
.lp-dash-order-row {
  display:flex; justify-content:space-between; align-items:center;
  padding:11px 14px; border-radius:8px; margin-bottom:6px;
  background:rgba(18,20,34,0.78); border:1px solid rgba(99,102,241,0.1);
  box-shadow:0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.02);
  transition:all 0.2s;
}
.lp-dash-order-row:hover { border-color:rgba(99,102,241,0.3); transform:translateX(2px); background:rgba(22,25,44,0.88); }
.lp-dash-order-info { display:flex; flex-direction:column; gap:2px; }
.lp-dash-order-id { font-size:12px; font-weight:600; color:#e8eaf0; }
.lp-dash-order-meta { font-size:11px; color:rgba(232,234,240,0.4); }
.lp-dash-order-right { display:flex; flex-direction:column; align-items:flex-end; gap:4px; }
.lp-dash-order-amt { font-size:13px; font-weight:700; color:#e8eaf0; }

/* ══════════════════════════════════════════════════════════════════════
   EXPLAINABLE DECISIONS (DARK CONSOLE)
══════════════════════════════════════════════════════════════════════ */
.lp-explain {
  padding:120px 0; position:relative;
  background:linear-gradient(180deg, #090b14 0%, #0d1020 100%);
}
.lp-explain .lp-eyebrow { color:#818cf8; }
.lp-explain .lp-eyebrow::before { background:#818cf8; }
.lp-explain-layout { display:grid; grid-template-columns:1.1fr 1fr; gap:80px; align-items:center; }
.lp-explain-copy h2 { font-size:clamp(28px,3vw,46px); font-weight:800; letter-spacing:-0.8px; color:#f0f1f8; margin:0 0 18px; line-height:1.1; }
.lp-explain-copy p { font-size:17px; line-height:1.7; color:rgba(232,234,240,0.52); margin:0 0 32px; }
.lp-explain-tagline {
  font-size:14px; color:rgba(232,234,240,0.6); line-height:1.6;
  padding:16px 20px; border-radius:10px;
  border-left:2px solid #818cf8;
  background:rgba(99,102,241,0.06);
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);
}

/* ── REASON CARD ──────────────────────────────────────────────────────── */
.lp-reason-card {
  background:linear-gradient(180deg, rgba(14,16,28,0.98) 0%, rgba(10,12,22,0.96) 100%);
  border:1px solid rgba(99,102,241,0.22);
  border-radius:18px; overflow:hidden;
  box-shadow:0 26px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1), inset 0 1px 0 rgba(255,255,255,0.08);
  position:relative;
}
.lp-reason-card::before {
  content:''; position:absolute; top:0; left:15%; right:15%; height:1px;
  background:linear-gradient(90deg,transparent,rgba(129,140,248,0.45),transparent);
}
.lp-reason-top {
  padding:20px 22px;
  background:rgba(99,102,241,0.05); border-bottom:1px solid rgba(99,102,241,0.12);
  display:flex; justify-content:space-between; align-items:center;
}
.lp-reason-order { display:flex; flex-direction:column; gap:3px; }
.lp-reason-order-num { font-size:11px; color:rgba(232,234,240,0.38); font-weight:600; letter-spacing:0.5px; }
.lp-reason-order-amt { font-size:22px; font-weight:800; color:#f0f1f8; }
.lp-reason-body { padding:22px; }
.lp-reason-why-label {
  font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase;
  color:rgba(232,234,240,0.3); margin-bottom:16px;
}
.lp-reason-items { display:flex; flex-direction:column; gap:10px; margin-bottom:20px; }
.lp-reason-item {
  display:flex; align-items:center; gap:12px; padding:12px 14px;
  border-radius:8px; background:rgba(251,191,36,0.07); border:1px solid rgba(251,191,36,0.16);
  box-shadow:0 2px 8px rgba(0,0,0,0.2);
}
.lp-reason-item-dot { width:6px; height:6px; border-radius:50%; background:#fbbf24; flex-shrink:0; }
.lp-reason-item span { font-size:13px; color:rgba(232,234,240,0.68); }
.lp-reason-action {
  display:flex; align-items:center; gap:8px; padding:12px 14px;
  border-radius:8px; background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.22);
  font-size:13px; color:#a5b4fc; font-weight:600;
  box-shadow:0 2px 8px rgba(0,0,0,0.2);
}

/* ══════════════════════════════════════════════════════════════════════
   BENTO FEATURES (LIGHT SECTION)
══════════════════════════════════════════════════════════════════════ */
.lp-features {
  padding:120px 0; position:relative;
  background:linear-gradient(180deg, #eef2f7 0%, #f5f6fb 50%, #ebf0f6 100%);
  color:#0f172a;
  overflow:hidden;
}
.lp-features::before {
  content:''; position:absolute; top:8%; left:25%; width:1100px; height:740px;
  background:
    radial-gradient(ellipse at 45% 35%, rgba(133,136,230,0.16) 0%, rgba(99,102,241,0.07) 35%, rgba(165,168,244,0.03) 60%, transparent 75%),
    radial-gradient(circle at 20% 60%, rgba(165,168,244,0.09) 0%, transparent 50%);
  pointer-events:none; z-index:0;
}
.lp-features::after {
  content:''; position:absolute; bottom:5%; right:-5%; width:680px; height:680px;
  background:radial-gradient(circle, rgba(139,92,246,0.09) 0%, rgba(99,102,241,0.03) 45%, transparent 68%);
  pointer-events:none; z-index:0;
}
.lp-decor-features {
  position:absolute; inset:0; pointer-events:none; z-index:0; overflow:hidden;
}
.lp-features-header { max-width:560px; margin:0 auto 64px; text-align:center; position:relative; z-index:1; }
.lp-features .lp-eyebrow { color:#4f46e5; justify-content:center; }
.lp-features .lp-eyebrow::before { background:#4f46e5; }
.lp-features .lp-section-h2 { color:#0f172a; }
.lp-bento {
  display:grid;
  grid-template-columns:repeat(12,1fr);
  grid-template-rows:auto auto;
  gap:16px; position:relative; z-index:1;
}
.lp-bento-cell {
  background:#ffffff; border:1px solid #e2e8f0;
  border-radius:18px; padding:30px; position:relative; overflow:hidden;
  box-shadow:
    0 6px 24px -2px rgba(15,23,42,0.05),
    0 2px 8px -1px rgba(99,102,241,0.03),
    inset 0 1px 0 #ffffff;
  transition:all 0.35s cubic-bezier(0.16,1,0.3,1);
}
.lp-bento-cell:hover {
  border-color:#cbd5e1; transform:translateY(-4px);
  box-shadow:
    0 18px 40px -4px rgba(15,23,42,0.1),
    0 4px 12px -1px rgba(99,102,241,0.06),
    inset 0 1px 0 #ffffff;
}
.lp-bento-cell::before {
  content:''; position:absolute; top:0; left:0; right:0; height:2px;
  background:linear-gradient(90deg,transparent,rgba(99,102,241,0.45),transparent);
  opacity:0; transition:opacity 0.3s;
}
.lp-bento-cell:hover::before { opacity:1; }
.lp-bento-icon {
  width:44px; height:44px; border-radius:11px;
  display:flex; align-items:center; justify-content:center;
  font-size:20px; margin-bottom:18px;
}
.lp-bento-cell h3 { font-size:16px; font-weight:700; color:#0f172a; margin:0 0 8px; }
.lp-bento-cell p { font-size:14px; line-height:1.65; color:#475569; margin:0; }

/* Bento light surface variations — Cell A is flagship focal point */
.lp-bento-a {
  grid-column:span 5;
  background:linear-gradient(160deg, #ffffff 0%, #fafaff 55%, #f3f5fd 100%);
  border:1px solid rgba(133,136,230,0.48);
  box-shadow:
    0 12px 38px -4px rgba(99,102,241,0.13),
    0 2px 8px -1px rgba(15,23,42,0.03),
    inset 0 1px 0 #ffffff,
    inset 0 0 28px rgba(133,136,230,0.06);
}
.lp-bento-a::before {
  opacity:0.9;
  background:linear-gradient(90deg,transparent,rgba(133,136,230,0.9),transparent);
}
.lp-bento-a:hover {
  border-color:rgba(133,136,230,0.75); transform:translateY(-5px);
  box-shadow:
    0 24px 55px -6px rgba(99,102,241,0.22),
    0 6px 16px rgba(15,23,42,0.04),
    inset 0 1px 0 #ffffff,
    inset 0 0 36px rgba(133,136,230,0.09);
}
.lp-bento-a .lp-bento-icon {
  background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.28);
}
.lp-bento-a .lp-bento-icon svg { stroke:#4f46e5; }

.lp-bento-b {
  grid-column:span 4;
}
.lp-bento-b .lp-bento-icon {
  background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2);
}
.lp-bento-b .lp-bento-icon svg { stroke:#2563eb; }

.lp-bento-c {
  grid-column:span 3;
}
.lp-bento-c .lp-bento-icon {
  background:rgba(14,165,233,0.08); border:1px solid rgba(14,165,233,0.2);
}
.lp-bento-c .lp-bento-icon svg { stroke:#0284c7; }

.lp-bento-d {
  grid-column:span 4;
}
.lp-bento-d .lp-bento-icon {
  background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2);
}
.lp-bento-d .lp-bento-icon svg { stroke:#d97706; }

.lp-bento-e {
  grid-column:span 4;
  border-color:rgba(168,85,247,0.22);
  box-shadow:0 4px 20px -2px rgba(168,85,247,0.05), 0 2px 6px -1px rgba(15,23,42,0.03);
}
.lp-bento-e:hover {
  border-color:rgba(168,85,247,0.45);
}
.lp-bento-e .lp-bento-icon {
  background:rgba(139,92,246,0.08); border:1px solid rgba(139,92,246,0.2);
}
.lp-bento-e .lp-bento-icon svg { stroke:#7c3aed; }

.lp-bento-f {
  grid-column:span 4;
}
.lp-bento-f .lp-bento-icon {
  background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2);
}
.lp-bento-f .lp-bento-icon svg { stroke:#059669; }

/* ── bento accent visuals (light) ─────────────────────────────────────── */
.lp-mini-order-list { margin-top:20px; display:flex; flex-direction:column; gap:7px; }
.lp-mini-order-row { display:flex; justify-content:space-between; align-items:center;
  padding:8px 12px; border-radius:7px; background:rgba(255,255,255,0.85); border:1px solid rgba(133,136,230,0.16); }
.lp-mini-order-row span { font-size:12px; color:#334155; font-weight:500; }

.lp-features .lp-badge-safe { background:rgba(22,163,74,0.1); color:#16a34a; border:1px solid rgba(22,163,74,0.25); }
.lp-features .lp-badge-review { background:rgba(217,119,6,0.1); color:#d97706; border:1px solid rgba(217,119,6,0.25); }

.lp-memory-dots { margin-top:20px; display:flex; gap:8px; flex-wrap:wrap; }
.lp-memory-dot { width:9px; height:9px; border-radius:50%; }

/* ══════════════════════════════════════════════════════════════════════
   SECURITY
══════════════════════════════════════════════════════════════════════ */
.lp-security { padding:120px 0; }
.lp-security-inner { display:grid; grid-template-columns:1fr 1.5fr; gap:40px; align-items:start; }
.lp-security-copy h2 { font-size:clamp(28px,3vw,46px); font-weight:800; letter-spacing:-0.8px; color:#f0f1f8; margin:0 0 18px; line-height:1.1; }
.lp-security-copy p { font-size:17px; line-height:1.7; color:rgba(232,234,240,0.5); margin:0 0 40px; }
.lp-sec-items { display:flex; flex-direction:column; gap:20px; }
.lp-sec-item { display:flex; gap:16px; align-items:flex-start; }
.lp-sec-item-icon { width:36px; height:36px; border-radius:9px; background:rgba(74,222,128,0.1); border:1px solid rgba(74,222,128,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:15px; }
.lp-sec-item-text h4 { font-size:15px; font-weight:700; color:#e8eaf0; margin:0 0 5px; }
.lp-sec-item-text p { font-size:13px; color:rgba(232,234,240,0.45); margin:0; line-height:1.5; }

/* ── 3D SECURITY ORB ──────────────────────────────────────────────────── */
.lp-sec-viz-wrap {
  position:relative; width:100%; height:900px;
  display:flex; justify-content:center; align-items:center;
  margin:-60px 0;
}
.lp-sec-viz {
  width:100%; height:100%; max-width:960px;
  overflow:visible;
}

/* ══════════════════════════════════════════════════════════════════════
   BEFORE / AFTER (COMPARISON - DARK)
══════════════════════════════════════════════════════════════════════ */
.lp-results {
  padding:120px 0; position:relative;
  background:linear-gradient(180deg, #0b0d18 0%, #0e1122 50%, #0b0d18 100%);
  border-top:1px solid rgba(255,255,255,0.06);
}
.lp-results::before {
  content:''; position:absolute; inset:0; pointer-events:none;
  background:
    radial-gradient(circle at 25% 50%, rgba(248,113,113,0.035) 0%, transparent 60%),
    radial-gradient(circle at 75% 50%, rgba(74,222,128,0.045) 0%, transparent 60%);
}
.lp-results-header { max-width:580px; margin:0 auto 64px; text-align:center; position:relative; z-index:1; }
.lp-results .lp-eyebrow { color:#4ade80; justify-content:center; }
.lp-results .lp-eyebrow::before { background:#4ade80; }
.lp-results .lp-section-h2 { color:#f0f1f8; }
.lp-ba-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; max-width:880px; margin:0 auto; position:relative; z-index:1; }
.lp-ba-card {
  border-radius:18px; padding:36px;
  transition:all 0.3s cubic-bezier(0.16,1,0.3,1);
}
.lp-ba-before {
  background:linear-gradient(165deg, rgba(26,17,22,0.85) 0%, rgba(18,15,22,0.95) 100%);
  border:1px solid rgba(248,113,113,0.22);
  box-shadow:0 14px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(248,113,113,0.12);
}
.lp-ba-before:hover {
  border-color:rgba(248,113,113,0.35); transform:translateY(-2px);
}
.lp-ba-after {
  background:linear-gradient(165deg, rgba(16,28,22,0.85) 0%, rgba(14,22,19,0.96) 100%);
  border:1px solid rgba(74,222,128,0.28);
  box-shadow:0 18px 48px rgba(0,0,0,0.45), 0 0 32px rgba(74,222,128,0.06), inset 0 1px 0 rgba(74,222,128,0.25);
  position:relative;
}
.lp-ba-after::before {
  content:''; position:absolute; top:0; left:15%; right:15%; height:1px;
  background:linear-gradient(90deg,transparent,rgba(74,222,128,0.5),transparent);
}
.lp-ba-after:hover {
  border-color:rgba(74,222,128,0.45); transform:translateY(-3px);
  box-shadow:0 22px 56px rgba(0,0,0,0.5), 0 0 40px rgba(74,222,128,0.1), inset 0 1px 0 rgba(74,222,128,0.35);
}
.lp-ba-header { font-size:11px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; margin-bottom:24px; display:flex; align-items:center; gap:8px; }
.lp-ba-before .lp-ba-header { color:#f87171; }
.lp-ba-after  .lp-ba-header { color:#4ade80; }
.lp-ba-list { display:flex; flex-direction:column; gap:14px; }
.lp-ba-item { display:flex; align-items:flex-start; gap:12px; font-size:14px; line-height:1.5; color:rgba(232,234,240,0.7); }
.lp-ba-before .lp-ba-item-icon { color:#f87171; font-size:13px; margin-top:1px; flex-shrink:0; }
.lp-ba-after  .lp-ba-item-icon { color:#4ade80; font-size:13px; margin-top:1px; flex-shrink:0; }

/* ══════════════════════════════════════════════════════════════════════
   TESTIMONIALS (LIGHT)
══════════════════════════════════════════════════════════════════════ */
.lp-testi {
  padding:120px 0; position:relative;
  background:linear-gradient(180deg, #f0f3f8 0%, #f6f7fb 45%, #edf0f6 100%);
  color:#0f172a;
  border-top:1px solid #e2e8f0;
  border-bottom:1px solid #e2e8f0;
  overflow:hidden;
}
.lp-testi::before {
  content:''; position:absolute; top:18%; left:50%; transform:translateX(-50%);
  width:980px; height:560px;
  background:
    radial-gradient(ellipse at center, rgba(133,136,230,0.14) 0%, rgba(99,102,241,0.05) 45%, transparent 72%),
    radial-gradient(circle at 75% 25%, rgba(165,168,244,0.08) 0%, transparent 55%);
  pointer-events:none; z-index:0;
}
.lp-testi::after {
  content:''; position:absolute; bottom:5%; left:5%; width:550px; height:550px;
  background:radial-gradient(circle, rgba(165,168,244,0.06) 0%, transparent 60%);
  pointer-events:none; z-index:0;
}
.lp-decor-testi {
  position:absolute; inset:0; pointer-events:none; z-index:0; overflow:hidden;
}
.lp-testi-header { max-width:560px; margin:0 auto 64px; text-align:center; position:relative; z-index:1; }
.lp-testi .lp-eyebrow { color:#4f46e5; justify-content:center; }
.lp-testi .lp-eyebrow::before { background:#4f46e5; }
.lp-testi .lp-section-h2 { color:#0f172a; }
.lp-testi .lp-section-sub { color:#64748b; }
.lp-testi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; position:relative; z-index:1; }
.lp-testi-card {
  background:#ffffff; border:1px solid #e2e8f0;
  border-radius:20px; padding:36px 32px;
  display:flex; flex-direction:column;
  box-shadow:
    0 8px 30px -4px rgba(15,23,42,0.06),
    0 2px 8px rgba(99,102,241,0.03),
    inset 0 1px 0 #ffffff;
  transition:all 0.35s cubic-bezier(0.16,1,0.3,1);
  position:relative; overflow:hidden;
}
.lp-testi-card::before {
  content:''; position:absolute; top:0; left:15%; right:15%; height:1px;
  background:linear-gradient(90deg,transparent,rgba(133,136,230,0.5),transparent);
  opacity:0.85;
}
.lp-testi-card:hover {
  border-color:rgba(133,136,230,0.45); transform:translateY(-6px);
  box-shadow:
    0 22px 50px -8px rgba(99,102,241,0.13),
    0 4px 14px rgba(15,23,42,0.04),
    inset 0 1px 0 #ffffff;
}
.lp-testi-quote {
  font-size:38px; line-height:1; color:rgba(133,136,230,0.32); margin-bottom:16px;
  font-family:Georgia,serif;
}
.lp-testi-text {
  font-size:15px; line-height:1.7; color:#334155;
  flex:1; margin-bottom:28px;
}
.lp-testi-author { display:flex; align-items:center; gap:12px; }
.lp-testi-avatar {
  width:40px; height:40px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-size:15px; font-weight:800; color:#fff; flex-shrink:0;
  box-shadow:0 2px 8px rgba(0,0,0,0.12);
}
.lp-testi-name { font-size:14px; font-weight:700; color:#0f172a; display:block; margin-bottom:2px; }
.lp-testi-store { font-size:12px; color:#64748b; }

/* ══════════════════════════════════════════════════════════════════════
   FINAL CTA
══════════════════════════════════════════════════════════════════════ */
.lp-cta {
  padding:120px 0; position:relative;
  background:linear-gradient(180deg, rgba(11,13,22,0.85) 0%, rgba(14,18,36,0.96) 50%, rgba(10,11,18,1) 100%);
}
.lp-cta .lp-eyebrow { color:#a5b4fc; }
.lp-cta .lp-eyebrow::before { background:#a5b4fc; }
.lp-cta-inner {
  position:relative; border-radius:24px; padding:80px 60px;
  background:linear-gradient(145deg, rgba(18,22,46,0.96) 0%, rgba(14,16,32,0.98) 100%);
  border:1px solid rgba(129,140,248,0.28);
  box-shadow:0 32px 90px rgba(0,0,0,0.65), 0 0 50px rgba(99,102,241,0.1), inset 0 1px 0 rgba(255,255,255,0.1);
  text-align:center; overflow:hidden;
}
.lp-cta-inner::before {
  content:''; position:absolute; top:-50%; left:50%; transform:translateX(-50%);
  width:720px; height:720px;
  background:radial-gradient(circle, rgba(99,102,241,0.14) 0%, rgba(59,130,246,0.05) 45%, transparent 70%);
  pointer-events:none;
}
.lp-cta-inner::after {
  content:''; position:absolute; top:0; left:10%; right:10%; height:1px;
  background:linear-gradient(90deg,transparent,rgba(165,180,252,0.6),transparent);
}
.lp-cta-orb-wrap {
  position:absolute; inset:0; display:flex; justify-content:center; align-items:center;
  pointer-events:none; opacity:0.6;
}
.lp-cta-orb {
  width:320px; height:320px; border-radius:50%;
  background:radial-gradient(circle,rgba(99,102,241,0.12) 0%,rgba(59,130,246,0.04) 50%,transparent 70%);
  border:1px solid rgba(129,140,248,0.16);
  animation:lp-orb-breathe 6s ease-in-out infinite;
}
.lp-cta-content { position:relative; z-index:2; }
.lp-cta-content h2 { font-size:clamp(32px,4vw,54px); font-weight:800; letter-spacing:-1px; color:#f0f1f8; margin:0 0 20px; line-height:1.1; }
.lp-cta-content p { font-size:18px; color:rgba(232,234,240,0.55); margin:0 auto 40px; max-width:500px; line-height:1.6; }
.lp-cta-actions { display:flex; justify-content:center; gap:16px; flex-wrap:wrap; margin-bottom:24px; }
.lp-cta-reassurance { font-size:13px; color:rgba(232,234,240,0.35); }

/* ══════════════════════════════════════════════════════════════════════
   FOOTER
══════════════════════════════════════════════════════════════════════ */
.lp-footer {
  border-top:1px solid rgba(133,136,230,0.1);
  background:#0a0b12;
  padding:48px 0 32px;
}
.lp-footer-inner {
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:40px; flex-wrap:wrap;
}
.lp-footer-left { display:flex; flex-direction:column; align-items:center; gap:24px; flex:1; min-width:260px; }
.lp-footer-brand { display:flex; align-items:center; gap:10px; font-weight:800; font-size:16px; color:#e8eaf0; letter-spacing:2.5px; }
.lp-footer-nav { display:flex; flex-wrap:wrap; gap:6px 28px; justify-content:center; }
.lp-footer-nav a { font-size:13px; color:rgba(232,234,240,0.35); transition:color 0.2s; }
.lp-footer-nav a:hover { color:rgba(232,234,240,0.7); }
.lp-footer-legal { display:flex; flex-wrap:wrap; gap:6px 16px; justify-content:center; }
.lp-footer-legal a { font-size:12px; color:rgba(232,234,240,0.2); transition:color 0.2s; }
.lp-footer-legal a:hover { color:rgba(232,234,240,0.45); }
.lp-footer-copy { font-size:12px; color:rgba(232,234,240,0.2); text-align:center; }
.lp-footer-dot { color:rgba(133,136,230,0.3); margin:0 4px; }

/* ── CONNECT CARD (footer right) ──────────────────────────────────── */
.lp-footer-connect { display:flex; flex-direction:column; gap:14px; min-width:220px; }
.lp-footer-connect-title {
  font-size:13px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase;
  color:#e8eaf0; display:flex; align-items:center; gap:6px;
}
.lp-footer-connect-title::after {
  content:''; display:inline-block; width:6px; height:6px; border-radius:50%;
  background:#8588e6; box-shadow:0 0 8px rgba(133,136,230,0.8);
  animation:lp-hero-pulse 2s infinite;
}
.lp-footer-social-row { display:flex; gap:10px; }
.lp-footer-social-btn {
  display:inline-flex; align-items:center; gap:8px;
  padding:8px 14px; border-radius:8px;
  background:rgba(133,136,230,0.08); border:1px solid rgba(133,136,230,0.18);
  font-size:13px; font-weight:600; color:rgba(232,234,240,0.7);
  text-decoration:none; transition:all 0.25s cubic-bezier(0.34,1.56,0.64,1);
  white-space:nowrap; position:relative; overflow:hidden;
}
.lp-footer-social-btn svg { flex-shrink:0; }
.lp-footer-social-btn:hover {
  background:rgba(133,136,230,0.16); border-color:rgba(133,136,230,0.45);
  color:#e8eaf0; transform:translateY(-2px) scale(1.04);
  box-shadow:0 6px 20px rgba(0,0,0,0.3);
}
.lp-footer-social-btn:active { transform:translateY(0) scale(0.97); }

.lp-footer-profile {
  display:flex; align-items:center; gap:12px;
  padding:11px 14px; border-radius:12px;
  background:rgba(133,136,230,0.06); border:1px solid rgba(133,136,230,0.15);
  transition:border-color 0.25s, background 0.25s;
}
.lp-footer-profile:hover { border-color:rgba(133,136,230,0.35); background:rgba(133,136,230,0.1); }
.lp-footer-avatar {
  width:40px; height:40px; border-radius:50%; object-fit:cover; flex-shrink:0;
  border:2px solid rgba(133,136,230,0.35);
  box-shadow:0 0 0 3px rgba(133,136,230,0.1);
}
.lp-footer-profile-info { display:flex; flex-direction:column; gap:2px; }
.lp-footer-profile-name { font-size:14px; font-weight:700; color:#e8eaf0; }
.lp-footer-profile-role { font-size:11px; color:rgba(232,234,240,0.4); font-weight:500; }

@media (max-width:768px) {
  .lp-footer-inner { flex-direction:column; align-items:center; }
  .lp-footer-left { width:100%; }
  .lp-footer-connect { align-items:center; width:100%; }
  .lp-footer-social-row { justify-content:center; }
  .lp-footer-profile { width:100%; max-width:300px; }
}

/* ══════════════════════════════════════════════════════════════════════
   KEYFRAMES
══════════════════════════════════════════════════════════════════════ */
@keyframes lp-hero-pulse {
  0%,100% { opacity:1; transform:scale(1); }
  50% { opacity:0.4; transform:scale(0.75); }
}
@keyframes lp-orb-breathe {
  0%,100% {
    transform:scale(1);
    box-shadow:0 30px 60px rgba(0,0,0,0.55),0 8px 24px rgba(0,0,0,0.4),0 0 0 1px rgba(133,136,230,0.12),0 0 50px rgba(133,136,230,0.14);
  }
  50% {
    transform:scale(1.025);
    box-shadow:0 36px 70px rgba(0,0,0,0.5),0 10px 28px rgba(0,0,0,0.35),0 0 0 1px rgba(133,136,230,0.18),0 0 70px rgba(133,136,230,0.2);
  }
}
@keyframes lp-ring-spin-1 { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
@keyframes lp-ring-spin-2 { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
@keyframes lp-ring-spin-3 { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
@keyframes lp-hand-left-float {
  0%,100% { transform:translateY(-50%) rotate(-6deg); }
  50%      { transform:translateY(calc(-50% - 8px)) rotate(-11deg); }
}
@keyframes lp-hand-right-float {
  0%,100% { transform:translateY(-50%) rotate(6deg); }
  50%      { transform:translateY(calc(-50% - 8px)) rotate(11deg); }
}
@keyframes lp-float {
  0%,100% { transform:translateY(0); }
  50% { transform:translateY(-10px); }
}
@keyframes lp-slide-in {
  from { opacity:0; transform:translateX(-12px); }
  to   { opacity:1; transform:translateX(0); }
}
@keyframes lp-particle-drift {
  0%   { transform:translate(0,0); opacity:0.6; }
  33%  { transform:translate(8px,-14px); opacity:0.3; }
  66%  { transform:translate(-6px,-22px); opacity:0.5; }
  100% { transform:translate(4px,-36px); opacity:0; }
}
@keyframes lp-node-glow {
  0%, 100% { opacity:0.3; transform:scale(1); }
  50% { opacity:0.85; transform:scale(1.3); }
}
@keyframes lp-stream-flow {
  0%   { stroke-dashoffset: 600; }
  100% { stroke-dashoffset: 0; }
}
@keyframes lp-stream-flow-rev {
  0%   { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: 600; }
}
@keyframes lp-beam-breathe {
  0%, 100% { opacity: 0.65; }
  50%      { opacity: 0.95; }
}
@keyframes lp-detection-ping {
  0%   { r: 3px; opacity: 0.9; }
  70%  { r: 16px; opacity: 0; }
  100% { r: 16px; opacity: 0; }
}
@keyframes lp-orbit-spin-slow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes lp-orbit-spin-rev {
  from { transform: rotate(360deg); }
  to   { transform: rotate(0deg); }
}

.lp-stream-pulse {
  stroke-dasharray: 20 160;
  animation: lp-stream-flow 12s linear infinite;
}
.lp-stream-pulse-fast {
  stroke-dasharray: 24 200;
  animation: lp-stream-flow 8s linear infinite;
}
.lp-stream-pulse-rev {
  stroke-dasharray: 18 180;
  animation: lp-stream-flow-rev 14s linear infinite;
}
.lp-beam-anim {
  animation: lp-beam-breathe 7s ease-in-out infinite;
}
.lp-detection-ping-circle {
  animation: lp-detection-ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;
  transform-origin: center;
}
.lp-orbit-slow-1 {
  animation: lp-orbit-spin-slow 65s linear infinite;
}
.lp-orbit-slow-2 {
  animation: lp-orbit-spin-rev 85s linear infinite;
}

/* ── PARTICLES ────────────────────────────────────────────────────────── */
.lp-particle {
  position:absolute; border-radius:50%;
  background:rgba(133,136,230,0.5);
  animation:lp-particle-drift var(--pd,8s) linear var(--pda,0s) infinite;
  pointer-events:none;
}

/* ══════════════════════════════════════════════════════════════════════
   REDUCED MOTION
══════════════════════════════════════════════════════════════════════ */
@media (prefers-reduced-motion:reduce) {
  .lp-reveal, .lp-orb-core, .lp-orb-ring, .lp-orb-ring-1, .lp-orb-ring-2,
  .lp-orb-ring-3, .lp-signal, .lp-order-card, .lp-particle,
  .lp-flow-order, .lp-sec-orb-core, .lp-sec-orb-ring, .lp-sec-node,
  .lp-hero-tag-dot, .lp-flow-watching-dot, .lp-orb-hand {
    animation:none !important;
    transition:opacity 0.2s, color 0.2s, border-color 0.2s, background 0.2s !important;
    opacity:1 !important; transform:none !important;
  }
}

/* ══════════════════════════════════════════════════════════════════════
   RESPONSIVE
══════════════════════════════════════════════════════════════════════ */
@media (max-width:1024px) {
  .lp-hero { grid-template-columns:1fr; padding:52px 0 60px; }
  .lp-hero-left { padding-right:0; }
  .lp-orb-scene { height:420px; }
  .lp-product-layout, .lp-explain-layout, .lp-security-inner { grid-template-columns:1fr; gap:52px; }
  .lp-problem-layout { grid-template-columns:1fr; gap:52px; }
  .lp-hiw-steps { grid-template-columns:1fr 1fr; }
  .lp-hiw-connector { display:none; }
  .lp-ba-grid { grid-template-columns:1fr; max-width:480px; }
  .lp-testi-grid { grid-template-columns:1fr; }
}
@media (max-width:768px) {
  .wrap, .wrap-wide { padding:0 20px; }
  .lp-nav-links, .lp-nav-actions .lp-btn-ghost { display:none; }
  .lp-mobile-btn { display:flex; align-items:center; }
  .lp-orb-scene { height:340px; }
  .lp-orb-stage { width:240px; height:240px; }
  .lp-sig-customer, .lp-sig-history { display:none; }
  .lp-trust-inner { gap:24px; }
  .lp-hiw-steps { grid-template-columns:1fr; }
  .lp-journey-track { flex-direction:column; }
  .lp-journey-arrow { display:none; }
  .lp-bento { grid-template-columns:1fr; }
  .lp-bento-a, .lp-bento-b, .lp-bento-c, .lp-bento-d, .lp-bento-e, .lp-bento-f { grid-column:span 1; }
  .lp-testi-grid { grid-template-columns:1fr; }
  .lp-cta-inner { padding:52px 28px; }
  .lp-hero-ctas { flex-direction:column; }
  .lp-hero-ctas .lp-btn-hero-primary, .lp-hero-ctas .lp-btn-hero-secondary { width:100%; justify-content:center; }
}
@media (max-width:480px) {
  .lp-hero h1 { letter-spacing:-1.5px; }
  .lp-hero-trust { flex-direction:column; gap:10px; }
  .lp-orb-scene { height:280px; }
  .lp-orb-stage { width:190px; height:190px; }
  .lp-oc-review, .lp-oc-safe { display:none; }
  .lp-sig-order, .lp-sig-payment, .lp-sig-location { display:none; }
}
`;

/* ─────────────────────────────────────────────────────────────────────────────
   HOOKS
───────────────────────────────────────────────────────────────────────────── */
function useRevealOnScroll() {
  useEffect(() => {
    const els = document.querySelectorAll('.lp-reveal');
    const io = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('lp-visible'); io.unobserve(e.target); }
      }),
      { threshold: 0.12 }
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ─────────────────────────────────────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────────────────────────────────────── */

/* ── ZENO ORB (hero 3D centerpiece) ─────────────────────────────────────── */
function ZenoOrb({ logoVariant }: { logoVariant: 'dark' | 'light' }) {
  const stageRef   = useRef<HTMLDivElement>(null);
  const sceneRef   = useRef<HTMLDivElement>(null);

  // Eye tracking state
  const [eyeOffset, setEyeOffset]   = useState({ x: 0, y: 0 });
  const [expression, setExpression] = useState<'idle'|'happy'|'squint'|'alert'|'sleepy'|'wide'>('idle');

  // Arm tracking refs
  // Arm and face tracking refs
  const leftArmRef    = useRef<SVGSVGElement>(null);
  const rightArmRef   = useRef<SVGSVGElement>(null);
  const faceRef       = useRef<HTMLDivElement>(null);
  const browsRef      = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const mm = window.matchMedia('(prefers-reduced-motion:reduce)');
    if (mm.matches) return;

    let rafId = 0;
    let mouseX = window.innerWidth * 0.5;
    let mouseY = window.innerHeight * 0.5;
    let hasMoved = false;
    let lastMoveTime = Date.now();

    // Smooth lerp state for 3D physical movement & spherical projection
    let currentShiftX = 0;
    let currentShiftY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;
    let currentFaceX = 0;
    let currentFaceY = 0;
    let currentFaceRotY = 0;
    let currentFaceRotX = 0;
    let currentEyeX = 0;
    let currentEyeY = 0;
    let currentLeftAngle: number | null = null;
    let currentRightAngle: number | null = null;
    let currentLeftReachX = 0;
    let currentLeftReachY = 0;
    let currentRightReachX = 0;
    let currentRightReachY = 0;
    let currentLeftScale = 1;
    let currentRightScale = 1;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      hasMoved = true;
      lastMoveTime = Date.now();
    };

    const lerpAngle = (current: number, target: number, speed: number) => {
      let diff = (target - current) % 360;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      return current + diff * speed;
    };

    const tick = () => {
      const now = Date.now();
      const isIdle = !hasMoved || (now - lastMoveTime > 2800);
      const scene = sceneRef.current;
      const stage = stageRef.current;

      if (scene && stage) {
        const rect = scene.getBoundingClientRect();
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.48;

        if (hasMoved && !isIdle) {
          // Normalize cursor delta relative to viewport dimensions
          const normX = Math.max(-1, Math.min(1, (mouseX - cx) / (window.innerWidth * 0.45)));
          const normY = Math.max(-1, Math.min(1, (mouseY - cy) / (window.innerHeight * 0.45)));

          // 3D body shift & tilt towards pointing target
          const targetShiftX = normX * 18;
          const targetShiftY = normY * 14;
          const targetTiltX = normX * 5.0;
          const targetTiltY = normY * 3.5;

          currentShiftX += (targetShiftX - currentShiftX) * 0.12;
          currentShiftY += (targetShiftY - currentShiftY) * 0.12;
          currentTiltX += (targetTiltX - currentTiltX) * 0.12;
          currentTiltY += (targetTiltY - currentTiltY) * 0.12;

          stage.style.transform = `perspective(1000px) translate3d(${currentShiftX.toFixed(2)}px, ${currentShiftY.toFixed(2)}px, 0) rotateY(${currentTiltX.toFixed(2)}deg) rotateX(${-currentTiltY.toFixed(2)}deg)`;

          // 3D Spherical Face & Brow curvature parallax
          const targetFaceX = normX * 18;
          const targetFaceY = normY * 14;
          const targetFaceRotY = normX * 12;
          const targetFaceRotX = -normY * 9;

          currentFaceX += (targetFaceX - currentFaceX) * 0.16;
          currentFaceY += (targetFaceY - currentFaceY) * 0.16;
          currentFaceRotY += (targetFaceRotY - currentFaceRotY) * 0.16;
          currentFaceRotX += (targetFaceRotX - currentFaceRotX) * 0.16;

          if (faceRef.current) {
            faceRef.current.style.transform = `translate3d(${currentFaceX.toFixed(2)}px, ${currentFaceY.toFixed(2)}px, 16px) rotateY(${currentFaceRotY.toFixed(2)}deg) rotateX(${currentFaceRotX.toFixed(2)}deg)`;
          }
          if (browsRef.current) {
            browsRef.current.style.transform = `translateX(-50%) translate3d(${currentFaceX.toFixed(2)}px, ${currentFaceY.toFixed(2)}px, 20px) rotateY(${currentFaceRotY.toFixed(2)}deg) rotateX(${currentFaceRotX.toFixed(2)}deg)`;
          }

          // Pupil position
          const maxR = rect.width * 0.38;
          const dist = Math.sqrt((mouseX - cx) ** 2 + (mouseY - cy) ** 2);
          const travel = 8;
          const targetEyeX = Math.max(-travel, Math.min(travel, ((mouseX - cx) / maxR) * travel));
          const targetEyeY = Math.max(-travel, Math.min(travel, ((mouseY - cy) / maxR) * travel));
          currentEyeX += (targetEyeX - currentEyeX) * 0.18;
          currentEyeY += (targetEyeY - currentEyeY) * 0.18;
          setEyeOffset({ x: currentEyeX, y: currentEyeY });

          // 3D Arm tracking — point, extend & depth-scale
          const targetLScale = normX < 0 ? 1 + Math.abs(normX) * 0.08 : 1 - normX * 0.05;
          const targetRScale = normX > 0 ? 1 + normX * 0.08 : 1 - Math.abs(normX) * 0.05;
          currentLeftScale += (targetLScale - currentLeftScale) * 0.16;
          currentRightScale += (targetRScale - currentRightScale) * 0.16;

          const updateArm = (
            svgEl: SVGSVGElement | null,
            shoulderFracX: number,
            shoulderFracY: number,
            naturalAngle: number,
            scale3d: number,
            isLeft: boolean
          ) => {
            if (!svgEl) return;
            const r = svgEl.getBoundingClientRect();
            const sx = r.left + r.width * shoulderFracX;
            const sy = r.top + r.height * shoulderFracY;
            const dx = mouseX - sx;
            const dy = mouseY - sy;

            // Point directly at cursor — no deadzones, no clamping
            const cursorAngle = Math.atan2(dy, dx) * (180 / Math.PI);
            const targetRot = cursorAngle - naturalAngle;

            // Cap how many degrees the arm can rotate per frame (max 8°).
            // This is the only smoothing — it prevents atan2 snap near the pivot
            // without adding any positional deadzone or angle limit.
            const MAX_DEG_PER_FRAME = 8;

            if (isLeft) {
              if (currentLeftAngle === null) currentLeftAngle = targetRot;
              else {
                let delta = ((targetRot - currentLeftAngle) % 360 + 540) % 360 - 180;
                delta = Math.max(-MAX_DEG_PER_FRAME, Math.min(MAX_DEG_PER_FRAME, delta));
                currentLeftAngle += delta;
              }
              svgEl.style.animation = 'none';
              svgEl.style.transform = `translateY(-50%) rotate(${currentLeftAngle.toFixed(2)}deg)`;
            } else {
              if (currentRightAngle === null) currentRightAngle = targetRot;
              else {
                let delta = ((targetRot - currentRightAngle) % 360 + 540) % 360 - 180;
                delta = Math.max(-MAX_DEG_PER_FRAME, Math.min(MAX_DEG_PER_FRAME, delta));
                currentRightAngle += delta;
              }
              svgEl.style.animation = 'none';
              svgEl.style.transform = `translateY(-50%) rotate(${currentRightAngle.toFixed(2)}deg)`;
            }
          };

          updateArm(leftArmRef.current, 82 / 100, 22 / 130, 118, currentLeftScale, true);
          updateArm(rightArmRef.current, 18 / 100, 22 / 130, 62, currentRightScale, false);

          // Expressions
          const normDist = dist / maxR;
          const aboveRatio = -(mouseY - cy) / (rect.height * 0.4);
          const sideRatio = Math.abs(mouseX - cx) / (rect.width * 0.4);

          if (normDist < 0.3) {
            setExpression('wide');
          } else if (normDist < 0.65) {
            setExpression('happy');
          } else if (aboveRatio > 0.6) {
            setExpression('alert');
          } else if (sideRatio > 0.85) {
            setExpression('squint');
          } else {
            setExpression('idle');
          }
        } else {
          // Smoothly return body, face and arms to neutral resting 3D state
          currentShiftX += (0 - currentShiftX) * 0.08;
          currentShiftY += (0 - currentShiftY) * 0.08;
          currentTiltX += (0 - currentTiltX) * 0.08;
          currentTiltY += (0 - currentTiltY) * 0.08;
          currentFaceX += (0 - currentFaceX) * 0.08;
          currentFaceY += (0 - currentFaceY) * 0.08;
          currentFaceRotY += (0 - currentFaceRotY) * 0.08;
          currentFaceRotX += (0 - currentFaceRotX) * 0.08;
          currentLeftReachX += (0 - currentLeftReachX) * 0.08;
          currentLeftReachY += (0 - currentLeftReachY) * 0.08;
          currentRightReachX += (0 - currentRightReachX) * 0.08;
          currentRightReachY += (0 - currentRightReachY) * 0.08;
          currentLeftScale += (1 - currentLeftScale) * 0.08;
          currentRightScale += (1 - currentRightScale) * 0.08;

          stage.style.transform = `perspective(1000px) translate3d(${currentShiftX.toFixed(2)}px, ${currentShiftY.toFixed(2)}px, 0) rotateY(${currentTiltX.toFixed(2)}deg) rotateX(${-currentTiltY.toFixed(2)}deg)`;

          if (faceRef.current) {
            faceRef.current.style.transform = `translate3d(${currentFaceX.toFixed(2)}px, ${currentFaceY.toFixed(2)}px, 0) rotateY(${currentFaceRotY.toFixed(2)}deg) rotateX(${currentFaceRotX.toFixed(2)}deg)`;
          }
          if (browsRef.current) {
            browsRef.current.style.transform = `translateX(-50%) translate3d(${currentFaceX.toFixed(2)}px, ${currentFaceY.toFixed(2)}px, 0) rotateY(${currentFaceRotY.toFixed(2)}deg) rotateX(${currentFaceRotX.toFixed(2)}deg)`;
          }

          if (currentLeftAngle !== null || currentRightAngle !== null) {
            if (leftArmRef.current) {
              leftArmRef.current.style.animation = '';
              leftArmRef.current.style.transform = '';
            }
            if (rightArmRef.current) {
              rightArmRef.current.style.animation = '';
              rightArmRef.current.style.transform = '';
            }
            currentLeftAngle = null;
            currentRightAngle = null;
          }

          if (now - lastMoveTime >= 2800) {
            setExpression('sleepy');
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMouseMove);
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Eyebrow SVG paths per expression
  // ViewBox is 136w. Left eye centre ~x=33, right eye centre ~x=103
  // Each brow spans ~28px wide, 12px tall arc above eye
  const browPaths = {
    idle:   { L: 'M 14,16 Q 33,6  52,16',  R: 'M 84,16 Q 103,6  122,16' },
    happy:  { L: 'M 14,18 Q 33,4  52,16',  R: 'M 84,16 Q 103,4  122,18' },
    squint: { L: 'M 14,12 Q 33,18 52,14',  R: 'M 84,14 Q 103,18 122,12' },
    alert:  { L: 'M 14,20 Q 33,2  52,14',  R: 'M 84,14 Q 103,2  122,20' },
    sleepy: { L: 'M 14,14 Q 33,14 52,18',  R: 'M 84,18 Q 103,14 122,14' },
    wide:   { L: 'M 14,20 Q 33,2  52,12',  R: 'M 84,12 Q 103,2  122,20' },
  };
  const brows = browPaths[expression] ?? browPaths.idle;

  // Eye class per expression
  const eyeClass = (expression === 'idle') ? '' : expression;

  // Mouth class
  const mouthClass =
    expression === 'happy' || expression === 'wide'  ? 'grin'  :
    expression === 'squint'                           ? 'flat'  :
    expression === 'alert'                            ? 'open'  :
    expression === 'sleepy'                           ? 'sleepy': '';

  const dots: Array<{ style: React.CSSProperties }> = [
    { style: { top: '-3px', left: '50%', transform: 'translateX(-50%)' } },
    { style: { bottom: '-3px', right: '20%' } },
  ];

  return (
    <div className="lp-orb-scene" ref={sceneRef}>
      {/* Background particles */}
      {[
        { size:3,  top:'15%', left:'18%', pd:'9s',  pda:'0s' },
        { size:2,  top:'72%', left:'25%', pd:'11s', pda:'1.2s' },
        { size:2.5,top:'30%', right:'14%',pd:'8s',  pda:'2.5s' },
        { size:2,  top:'60%', right:'20%',pd:'12s', pda:'0.7s' },
        { size:1.5,top:'88%', right:'35%',pd:'10s', pda:'3.1s' },
        { size:2,  top:'8%',  right:'30%',pd:'7s',  pda:'1.8s' },
      ].map((p, i) => (
        <div key={i} className="lp-particle" style={{
          width:p.size, height:p.size,
          top:p.top, left:p.left, right:(p as {right?:string}).right,
          ['--pd' as string]:p.pd, ['--pda' as string]:p.pda,
        }} />
      ))}

      {/* Signal chips */}
      <div className="lp-signal lp-sig-order">
        <div className="lp-signal-chip">
          <div className="lp-signal-icon">
            <img src="/orders.svg" width={18} height={18} alt="" style={{opacity:0.7}} />
          </div>
          ORDER
        </div>
        <div className="lp-signal-trail" />
      </div>
      <div className="lp-signal lp-sig-customer" style={{flexDirection:'column-reverse'}}>
        <div className="lp-signal-trail lp-signal-trail-up" />
        <div className="lp-signal-chip">
          <div className="lp-signal-icon">
            <img src="/profile-users.svg" width={18} height={18} alt="" style={{opacity:0.7}} />
          </div>
          CUSTOMER
        </div>
      </div>
      <div className="lp-signal lp-sig-payment" style={{flexDirection:'column-reverse'}}>
        <div className="lp-signal-trail lp-signal-trail-up" />
        <div className="lp-signal-chip">
          <div className="lp-signal-icon">
            <img src="/wallet.svg" width={18} height={18} alt="" style={{opacity:0.7}} />
          </div>
          PAYMENT
        </div>
      </div>
      <div className="lp-signal lp-sig-location">
        <div className="lp-signal-chip">
          <div className="lp-signal-icon">
            <img src="/store.svg" width={18} height={18} alt="" style={{opacity:0.7}} />
          </div>
          LOCATION
        </div>
        <div className="lp-signal-trail" />
      </div>
      <div className="lp-signal lp-sig-history">
        <div className="lp-signal-chip">
          <div className="lp-signal-icon">
            <img src="/network.svg" width={18} height={18} alt="" style={{opacity:0.7}} />
          </div>
          PAST PURCHASE
        </div>
        <div className="lp-signal-trail" />
      </div>

      {/* Orb stage — mouse tilt */}
      <div className="lp-orb-stage" ref={stageRef}>

        {/* ── Left arm (EVE-style: shoulder stub + tapered arm + flat paddle) ── */}
        <svg
          ref={leftArmRef}
          className="lp-orb-hand lp-orb-hand-left"
          width="120" height="156"
          viewBox="0 0 100 130"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            {/* Dark navy base matching the orb */}
            <linearGradient id="arm-l-grad" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="#2a2d52" />
              <stop offset="50%"  stopColor="#1a1c3a" />
              <stop offset="100%" stopColor="#0f1024" />
            </linearGradient>
            {/* Top-left specular matching orb light source */}
            <radialGradient id="arm-l-spec" cx="30%" cy="20%" r="45%">
              <stop offset="0%"  stopColor="rgba(180,184,255,0.28)" />
              <stop offset="100%" stopColor="rgba(180,184,255,0)" />
            </radialGradient>
            {/* Rim light bottom-right edge */}
            <radialGradient id="arm-l-rim" cx="75%" cy="80%" r="40%">
              <stop offset="0%"  stopColor="rgba(100,108,220,0.22)" />
              <stop offset="100%" stopColor="rgba(100,108,220,0)" />
            </radialGradient>
            <filter id="arm-l-drop" x="-30%" y="-15%" width="160%" height="140%">
              <feDropShadow dx="2" dy="8" stdDeviation="7" floodColor="#000" floodOpacity="0.55" />
            </filter>
          </defs>
          {/*
            Arm shape: shoulder ball top-right, tapers into a wide flat paddle pointing down-left.
            The arm attaches to the orb on the right side; paddle is the wide flat end bottom-left.
            Path: start at shoulder, taper down-left, flare into paddle, round bottom, back up.
          */}
          {/* Shoulder joint — small circle where it connects to orb */}
          <circle cx="82" cy="22" r="14" fill="url(#arm-l-grad)" filter="url(#arm-l-drop)" />
          <circle cx="82" cy="22" r="14" fill="url(#arm-l-spec)" />
          <circle cx="82" cy="22" r="14" fill="url(#arm-l-rim)" />
          <circle cx="82" cy="22" r="14" stroke="rgba(133,136,230,0.22)" strokeWidth="1" fill="none" />

          {/* Arm body — tapered rectangle angled down-left */}
          <path
            d="
              M 76 32
              C 68 44, 46 66, 30 88
              C 22 100, 14 112, 18 120
              C 22 128, 40 130, 58 124
              C 74 118, 84 106, 88 92
              C 92 76, 90 56, 86 40
              Z
            "
            fill="url(#arm-l-grad)"
            filter="url(#arm-l-drop)"
          />
          <path
            d="
              M 76 32
              C 68 44, 46 66, 30 88
              C 22 100, 14 112, 18 120
              C 22 128, 40 130, 58 124
              C 74 118, 84 106, 88 92
              C 92 76, 90 56, 86 40
              Z
            "
            fill="url(#arm-l-spec)"
          />
          <path
            d="
              M 76 32
              C 68 44, 46 66, 30 88
              C 22 100, 14 112, 18 120
              C 22 128, 40 130, 58 124
              C 74 118, 84 106, 88 92
              C 92 76, 90 56, 86 40
              Z
            "
            fill="url(#arm-l-rim)"
          />
          {/* Edge outline */}
          <path
            d="
              M 76 32
              C 68 44, 46 66, 30 88
              C 22 100, 14 112, 18 120
              C 22 128, 40 130, 58 124
              C 74 118, 84 106, 88 92
              C 92 76, 90 56, 86 40
              Z
            "
            stroke="rgba(133,136,230,0.2)" strokeWidth="1" fill="none"
          />
          {/* Subtle centre-line crease for depth */}
          <path d="M 78 38 C 64 60, 44 82, 36 108"
            stroke="rgba(255,255,255,0.07)" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>

        {/* ── Right arm (EVE-style: mirror of left) ── */}
        <svg
          ref={rightArmRef}
          className="lp-orb-hand lp-orb-hand-right"
          width="120" height="156"
          viewBox="0 0 100 130"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="arm-r-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#2a2d52" />
              <stop offset="50%"  stopColor="#1a1c3a" />
              <stop offset="100%" stopColor="#0f1024" />
            </linearGradient>
            <radialGradient id="arm-r-spec" cx="70%" cy="20%" r="45%">
              <stop offset="0%"  stopColor="rgba(180,184,255,0.28)" />
              <stop offset="100%" stopColor="rgba(180,184,255,0)" />
            </radialGradient>
            <radialGradient id="arm-r-rim" cx="25%" cy="80%" r="40%">
              <stop offset="0%"  stopColor="rgba(100,108,220,0.22)" />
              <stop offset="100%" stopColor="rgba(100,108,220,0)" />
            </radialGradient>
            <filter id="arm-r-drop" x="-30%" y="-15%" width="160%" height="140%">
              <feDropShadow dx="-2" dy="8" stdDeviation="7" floodColor="#000" floodOpacity="0.55" />
            </filter>
          </defs>
          {/* Shoulder joint */}
          <circle cx="18" cy="22" r="14" fill="url(#arm-r-grad)" filter="url(#arm-r-drop)" />
          <circle cx="18" cy="22" r="14" fill="url(#arm-r-spec)" />
          <circle cx="18" cy="22" r="14" fill="url(#arm-r-rim)" />
          <circle cx="18" cy="22" r="14" stroke="rgba(133,136,230,0.22)" strokeWidth="1" fill="none" />

          {/* Arm body — mirrored */}
          <path
            d="
              M 24 32
              C 32 44, 54 66, 70 88
              C 78 100, 86 112, 82 120
              C 78 128, 60 130, 42 124
              C 26 118, 16 106, 12 92
              C 8 76, 10 56, 14 40
              Z
            "
            fill="url(#arm-r-grad)"
            filter="url(#arm-r-drop)"
          />
          <path
            d="
              M 24 32
              C 32 44, 54 66, 70 88
              C 78 100, 86 112, 82 120
              C 78 128, 60 130, 42 124
              C 26 118, 16 106, 12 92
              C 8 76, 10 56, 14 40
              Z
            "
            fill="url(#arm-r-spec)"
          />
          <path
            d="
              M 24 32
              C 32 44, 54 66, 70 88
              C 78 100, 86 112, 82 120
              C 78 128, 60 130, 42 124
              C 26 118, 16 106, 12 92
              C 8 76, 10 56, 14 40
              Z
            "
            fill="url(#arm-r-rim)"
          />
          <path
            d="
              M 24 32
              C 32 44, 54 66, 70 88
              C 78 100, 86 112, 82 120
              C 78 128, 60 130, 42 124
              C 26 118, 16 106, 12 92
              C 8 76, 10 56, 14 40
              Z
            "
            stroke="rgba(133,136,230,0.2)" strokeWidth="1" fill="none"
          />
          <path d="M 22 38 C 36 60, 56 82, 64 108"
            stroke="rgba(255,255,255,0.07)" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>

        <div className="lp-orb-ring lp-orb-ring-1">
          {dots.map((d, i) => (
            <div key={i} className="lp-orb-dot" style={d.style} />
          ))}
        </div>
        <div className="lp-orb-ring lp-orb-ring-2" />
        <div className="lp-orb-ring lp-orb-ring-3" />
        <div className="lp-orb-core">
          {/* Eyebrows — absolute, above the eyes, outside face flex flow */}
          <svg
            ref={browsRef}
            className="lp-orb-brows"
            viewBox="0 0 136 22"
            fill="none"
            aria-hidden="true"
            style={{overflow:'visible'}}
          >
            {/* Left brow — arcs over left eye (centred ~x=33) */}
            <path
              d={brows.L}
              stroke="rgba(165,168,244,0.8)"
              strokeWidth="2.2"
              strokeLinecap="round"
              style={{transition:'d 0.35s ease'}}
            />
            {/* Right brow — arcs over right eye (centred ~x=103) */}
            <path
              d={brows.R}
              stroke="rgba(165,168,244,0.8)"
              strokeWidth="2.2"
              strokeLinecap="round"
              style={{transition:'d 0.35s ease'}}
            />
          </svg>

          {/* ── FACE ── */}
          <div className="lp-orb-face" ref={faceRef}>

            {/* Eyes row */}
            <div className="lp-orb-eyes-row">
              {/* Left eye */}
              <div className={`lp-orb-eye-wrap ${eyeClass}`}>
                <div className="lp-orb-eyelid" />
                <div
                  className="lp-orb-pupil"
                  style={{ transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)` }}
                />
              </div>
              {/* Right eye */}
              <div className={`lp-orb-eye-wrap ${eyeClass}`}>
                <div className="lp-orb-eyelid" />
                <div
                  className="lp-orb-pupil"
                  style={{ transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)` }}
                />
              </div>
            </div>

            {/* Logo as mouth */}
            <div className={`lp-orb-mouth ${mouthClass}`}>
              <ZenoLogo height={72} forceVariant={logoVariant} />
            </div>

          </div>
        </div>
      </div>

      {/* Order micro-story cards */}
      <div className="lp-order-card lp-oc-review">
        <div className="lp-order-card-top">
          <span className="lp-order-num">ORDER #1042</span>
        </div>
        <div className="lp-order-amt">$1,499</div>
        <div className="lp-order-note">"Something looks unusual."</div>
        <div className="lp-badge lp-badge-review">
          <span className="lp-badge-dot" />
          REVIEW
        </div>
      </div>

      <div className="lp-order-card lp-oc-safe">
        <div className="lp-order-card-top">
          <span className="lp-order-num">ORDER #1043</span>
        </div>
        <div className="lp-order-amt">$129</div>
        <div className="lp-order-note">"Looks good."</div>
        <div className="lp-badge lp-badge-safe">
          <span className="lp-badge-dot" />
          SAFE ✓
        </div>
      </div>
    </div>
  );
}

/* ── DOCKER-STYLE "HOW IT WORKS" WORKFLOW COMPONENT ──────────────────────── */
interface WorkflowFeature {
  title: string;
  desc: string;
}

interface CodeView {
  label: string;
  filename: string;
  lang: string;
  code: string;
}

interface SimLine {
  time: string;
  tag: string;
  tagType: 'info' | 'ok' | 'warn' | 'block';
  msg: string;
}

interface WorkflowStep {
  id: string;
  num: string;
  tabLabel: string;
  kicker: string;
  title: string;
  desc: string;
  features: WorkflowFeature[];
  ctaText: string;
  ctaHref: string;
  views: CodeView[];
  simLogs: SimLine[];
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'connect',
    num: '01',
    tabLabel: '01. Ingest & Connect',
    kicker: 'STAGE 01 // STORE INTEGRATION',
    title: 'Connect your storefront in 60 seconds with zero code',
    desc: 'Seamlessly integrate Zeno with your existing store. Pre-built webhooks and SDKs listen for order events instantly with zero performance impact on checkout.',
    features: [
      {
        title: 'Plug & Play Integration',
        desc: 'Ready-to-use connectors for Shopify, WooCommerce, Stripe, and custom APIs.',
      },
      {
        title: 'HMAC-SHA256 Signed',
        desc: 'End-to-end cryptographic verification prevents spoofed or manipulated payloads.',
      },
      {
        title: 'Zero Checkout Latency',
        desc: 'Asynchronous event streaming ensures buyer checkout speed is completely unaffected.',
      },
    ],
    ctaText: 'Connect Store Free',
    ctaHref: '/register',
    views: [
      {
        label: 'cURL / Webhook',
        filename: 'webhook.sh',
        lang: 'bash',
        code: `# Ingest live storefront order via signed webhook
$ curl -X POST https://api.zeno.protect/v1/webhooks/orders \\
  -H "X-Zeno-Signature: sha256=d3b07384d113edec49eaa6238ad5ff00" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "order.created",
    "store_id": "sto_nordic_apparel",
    "order": { "id": "#1048", "amount": 1249.00, "currency": "USD" }
  }'

✓ 200 OK — Ingested in 14ms · Streaming to Zeno AI Risk Mesh`,
      },
      {
        label: 'zeno.config.ts',
        filename: 'zeno.config.ts',
        lang: 'typescript',
        code: `import { createZenoClient } from '@zeno/sdk';

export const zeno = createZenoClient({
  apiKey: process.env.ZENO_API_KEY!,
  storeId: 'sto_nordic_apparel',
  webhookSecret: process.env.ZENO_WEBHOOK_SECRET!,
  mode: 'protect', // 'audit' | 'protect'
  thresholds: {
    autoHoldScore: 0.65,
    autoBlockScore: 0.92
  }
});`,
      },
      {
        label: 'payload.json',
        filename: 'order-payload.json',
        lang: 'json',
        code: `{
  "event": "orders/create",
  "store_id": "sto_nordic_apparel",
  "order_id": "#1048",
  "timestamp": "2026-09-05T12:44:01Z",
  "amount": 1249.00,
  "currency": "USD",
  "customer": {
    "email": "j.doe@unknown-mail.org",
    "ip": "185.220.101.5",
    "first_order": true
  }
}`,
      },
    ],
    simLogs: [
      { time: '12:44:01.012', tag: 'INFO', tagType: 'info', msg: 'Inbound webhook received from Shopify (Order #1048)' },
      { time: '12:44:01.025', tag: 'VERIFY', tagType: 'ok', msg: 'Cryptographic signature verified (SHA-256 match)' },
      { time: '12:44:01.036', tag: 'PARSER', tagType: 'ok', msg: 'Normalized schema: amount=$1,249.00, currency=USD' },
      { time: '12:44:01.048', tag: 'STREAM', tagType: 'info', msg: 'Dispatched to Zeno Risk Mesh in 14ms' },
    ],
  },
  {
    id: 'watch',
    num: '02',
    tabLabel: '02. Stream & Detect',
    kicker: 'STAGE 02 // REAL-TIME DETECTION',
    title: 'Continuous behavioral telemetry & cluster matching',
    desc: 'As orders flow in, Zeno instantly maps customer fingerprints across identity clusters, shared shipping vectors, disposable domains, and abnormal velocity.',
    features: [
      {
        title: 'Identity Graph Clustering',
        desc: 'Links IP, card hash, device fingerprint, and shipping geolocations across store network.',
      },
      {
        title: 'Velocity & Bot Pattern Scanning',
        desc: 'Detects rapid-fire card testing scripts and distributed synthetic buyer rings.',
      },
      {
        title: 'Continuous Baseline Calibration',
        desc: 'Automatically adapts to your store\'s normal seasonal traffic and buyer habits.',
      },
    ],
    ctaText: 'Explore Risk Clusters',
    ctaHref: '#features',
    views: [
      {
        label: 'zeno watch --live',
        filename: 'terminal: stream',
        lang: 'bash',
        code: `# Streaming live risk telemetry across incoming storefront traffic
$ zeno stream --store=sto_nordic_apparel --format=json

[12:44:01.082] ⚡ Event received: order.created (id: #1048)
[12:44:01.094] 🌐 Geolocation: Bucharest, RO (Proxy/Tor Exit detected)
[12:44:01.108] 🔗 Cluster Match: Card hash linked to 3 prior chargebacks
[12:44:01.121] ⚠️ Velocity Alert: 4 orders submitted across 2 emails in 45s
[12:44:01.134] 📊 Anomaly Vector Score: 0.94 (HIGH RISK)`,
      },
      {
        label: 'cluster-graph.json',
        filename: 'cluster-graph.json',
        lang: 'json',
        code: `{
  "order_id": "#1048",
  "cluster_id": "cls_8f912c",
  "threat_level": "HIGH",
  "shared_nodes": {
    "disposable_email_domain": true,
    "ip_vpn_flag": true,
    "distance_billing_shipping_km": 4210,
    "linked_cards_count": 3
  },
  "network_chargeback_frequency": 0.88
}`,
      },
      {
        label: 'telemetry.sh',
        filename: 'telemetry.sh',
        lang: 'bash',
        code: `$ zeno-cli inspect-cluster --id=cls_8f912c --depth=2
CLUSTER: cls_8f912c (Risk Level: CRITICAL)
├── IP: 185.220.101.5 (Known datacenter proxy)
├── Device Fingerprint: dfp_77a01e (Used in 12 failed checkouts)
└── Drop Address: Str. Industriei 4, Bucharest, RO
RESULT: Pattern matches coordinated card-testing ring`,
      },
    ],
    simLogs: [
      { time: '12:44:01.070', tag: 'STREAM', tagType: 'info', msg: 'Real-time event ingested: Order #1048 ($1,249.00)' },
      { time: '12:44:01.085', tag: 'GEO', tagType: 'warn', msg: 'IP resolved: Bucharest, RO (Datacenter VPN detected)' },
      { time: '12:44:01.104', tag: 'GRAPH', tagType: 'block', msg: 'Cluster match: Card hash linked to 3 prior chargebacks' },
      { time: '12:44:01.122', tag: 'VELOCITY', tagType: 'warn', msg: 'High velocity: 4 orders in 45s across synthetic emails' },
      { time: '12:44:01.138', tag: 'ANOMALY', tagType: 'block', msg: 'Risk Confidence: 94.2% · Flagged for review' },
    ],
  },
  {
    id: 'understand',
    num: '03',
    tabLabel: '03. AI Reason & Explain',
    kicker: 'STAGE 03 // EXPLAINABLE AI',
    title: 'Plain-language reasons instead of mysterious black-box scores',
    desc: 'Zeno evaluates multidimensional risk signals and converts raw probabilities into clear, human-readable bullet points so merchants immediately understand what is happening.',
    features: [
      {
        title: 'Explainable Evidence Cards',
        desc: 'Know in seconds whether an address mismatch is a benign gift or stolen card.',
      },
      {
        title: 'Transparent Confidence Vectors',
        desc: 'Scoring breakdown shows account age, velocity weight, and reputation.',
      },
      {
        title: 'Context-Aware Action Guides',
        desc: 'Specific recommendations tell you whether to hold, ask for ID, or ship safely.',
      },
    ],
    ctaText: 'Explore Reason Engine',
    ctaHref: '#features',
    views: [
      {
        label: 'risk-evaluation.json',
        filename: 'risk-evaluation.json',
        lang: 'json',
        code: `{
  "order_id": "#1048",
  "decision": "REVIEW",
  "confidence_score": 0.942,
  "plain_reasons": [
    "New customer — first order placed on this account ($1,249.00)",
    "Shipping address is 4,200 km from billing credit card origin",
    "Device fingerprint linked to coordinated reshipping drop address"
  ],
  "recommended_action": "HOLD_FULFILLMENT_REQUEST_ID",
  "evaluated_at": "2026-09-05T12:44:01.162Z"
}`,
      },
      {
        label: 'zeno explain',
        filename: 'terminal: explain',
        lang: 'bash',
        code: `$ zeno explain --order=1048
--------------------------------------------------------------
ORDER #1048 | CUSTOMER: Sarah K. (Unknown) | AMOUNT: $1,249.00
--------------------------------------------------------------
DECISION: REVIEW REQUIRED (Confidence: 94%)

EVIDENCE SUMMARY:
  1. [FIRST ORDER]    New account with unusually high cart value.
  2. [GEO MISMATCH]   Card issued in US, shipping to Romania.
  3. [DEVICE MATCH]   Device fingerprint flagged in chargeback cluster.

RECOMMENDATION: Do not ship yet. Verify billing identity.`,
      },
      {
        label: 'merchant-alert.md',
        filename: 'merchant-alert.md',
        lang: 'markdown',
        code: `### Zeno Risk Brief: Order #1048
- **Order Total**: $1,249.00 (Median store cart: $118.00)
- **Customer Email**: j.doe@unknown-mail.org (New buyer)
- **Primary Flag**: Shipping address doesn't match cardholder
- **Zeno Advice**: Hold fulfillment before dispatch.`,
      },
    ],
    simLogs: [
      { time: '12:44:01.150', tag: 'REASON', tagType: 'info', msg: 'Synthesizing explainable decision vectors...' },
      { time: '12:44:01.166', tag: 'SIGNAL', tagType: 'warn', msg: 'Fact 1: Account age 0 days, order value 10x store median' },
      { time: '12:44:01.182', tag: 'SIGNAL', tagType: 'block', msg: 'Fact 2: Card country US != Shipping country RO (4,200 km)' },
      { time: '12:44:01.198', tag: 'SIGNAL', tagType: 'block', msg: 'Fact 3: Device fingerprint matches known reshipping drop' },
      { time: '12:44:01.214', tag: 'DECISION', tagType: 'warn', msg: 'Verdict: REVIEW (Plain explanation generated)' },
    ],
  },
  {
    id: 'decide',
    num: '04',
    tabLabel: '04. Automate & Protect',
    kicker: 'STAGE 04 // AUTOMATED DEFENSE',
    title: 'Instant protection with merchant in total command',
    desc: 'Configure automated holds for high-confidence threats while greenlighting trusted buyers with zero friction. You always maintain full control to approve, cancel, or refund in one click.',
    features: [
      {
        title: 'Automated Fulfillment Gate',
        desc: 'Hold high-risk orders automatically in Shopify/WooCommerce in < 50ms.',
      },
      {
        title: '1-Click Merchant Resolution',
        desc: 'Approve safe orders or cancel and restock fraudulent items with one click.',
      },
      {
        title: 'Closed-Loop Model Feedback',
        desc: 'Every decision you make refines Zeno’s cluster models for your store.',
      },
    ],
    ctaText: 'Protect Your Store',
    ctaHref: '/register',
    views: [
      {
        label: 'action-dispatcher.ts',
        filename: 'action-dispatcher.ts',
        lang: 'typescript',
        code: `// Automated policy execution on rendered decision
zeno.on('decision.rendered', async ({ orderId, decision, reasons }) => {
  if (decision === 'SAFE') {
    await shopify.fulfillment.release(orderId);
  } else if (decision === 'REVIEW') {
    await shopify.orders.addTags(orderId, ['zeno-hold', 'needs-review']);
    await notifyTeam({ orderId, reasons, priority: 'HIGH' });
  } else if (decision === 'BLOCKED') {
    await shopify.orders.cancel(orderId, { reason: 'fraud' });
  }
});`,
      },
      {
        label: 'zeno-policy.yml',
        filename: 'zeno-policy.yml',
        lang: 'yaml',
        code: `version: "2.0"
policies:
  auto_hold:
    enabled: true
    min_confidence: 0.85
    action: "HOLD_FULFILLMENT"
    tags: ["zeno-hold", "review-required"]
  notifications:
    slack_channel: "#store-fraud-alerts"
    sms_on_critical: true
  merchant_override:
    allow_instant_approve: true
    retrain_on_override: true`,
      },
      {
        label: 'audit.log',
        filename: 'audit.log',
        lang: 'bash',
        code: `[12:44:01.220] POLICY_TRIGGER: Rule 'auto_hold_high_risk' matched
[12:44:01.238] SHOPIFY_API: Tag 'zeno-hold' added to Order #1048 (18ms)
[12:44:01.254] SLACK_ALERT: Push sent to #store-fraud-alerts
[12:44:01.272] INVENTORY_SAVED: $1,249 protected from chargeback
[12:44:01.285] AUDIT_STATE: Order paused awaiting merchant review`,
      },
    ],
    simLogs: [
      { time: '12:44:01.218', tag: 'POLICY', tagType: 'info', msg: 'Evaluation score 0.94 triggers policy: auto_hold' },
      { time: '12:44:01.234', tag: 'API', tagType: 'ok', msg: 'Shopify fulfillment hold applied in 16ms' },
      { time: '12:44:01.252', tag: 'ALERT', tagType: 'warn', msg: 'Instant alert pushed to Slack & dashboard' },
      { time: '12:44:01.268', tag: 'SAVED', tagType: 'ok', msg: 'Inventory retained · $1,249 chargeback prevented' },
      { time: '12:44:01.280', tag: 'ACTION', tagType: 'info', msg: 'Merchant action available: [APPROVE] or [BLOCK]' },
    ],
  },
];

function highlightSyntax(line: string) {
  if (line.trim().startsWith('#') || line.trim().startsWith('//')) {
    return <span className="lp-cmt">{line}</span>;
  }
  if (line.trim().startsWith('$')) {
    const spaceIdx = line.indexOf(' ');
    const cmd = spaceIdx !== -1 ? line.slice(0, spaceIdx + 1) : line;
    const rest = spaceIdx !== -1 ? line.slice(spaceIdx + 1) : '';
    return (
      <>
        <span className="lp-cmd">{cmd}</span>
        <span>{rest}</span>
      </>
    );
  }
  if (line.includes('✓ 200 OK') || line.includes('RESULT:') || line.includes('DECISION:')) {
    return <span className="lp-str" style={{ fontWeight: 600 }}>{line}</span>;
  }
  const parts = line.split(/(\b(?:import|from|export|const|async|await|return|if|else|version|policies|auto_hold|enabled|action|tags|true|false)\b|"[^"]*"|'[^']*'|\b\d+\.?\d*\b)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^(?:import|from|export|const|async|await|return|if|else|version|policies|auto_hold|enabled|action|tags)$/.test(part)) {
          return <span key={i} className="lp-kw">{part}</span>;
        }
        if (/^(?:true|false)$/.test(part)) {
          return <span key={i} className="lp-num">{part}</span>;
        }
        if (/^"[^"]*"$|^'[^']*'$/.test(part)) {
          return <span key={i} className="lp-str">{part}</span>;
        }
        if (/^\d+\.?\d*$/.test(part)) {
          return <span key={i} className="lp-num">{part}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

const PRESENTER_SCRIPTS = [
  {
    step: 0,
    speaker: "Presenter",
    text: "Let's see what happens when a customer places an order. Here's incoming Order #1048 for $1,249.00 on your storefront. Click Inspect to see what Zeno does.",
  },
  {
    step: 1,
    speaker: "Presenter",
    text: "In 18 milliseconds, Zeno streams and inspects 40+ telemetry signals — spotting a Bucharest datacenter proxy and velocity bursts across synthetic emails.",
  },
  {
    step: 2,
    speaker: "Presenter",
    text: "Instead of an obscure score like '87', Zeno's AI translates everything into 3 plain-English reasons with clear recommendations for your team.",
  },
  {
    step: 3,
    speaker: "Presenter",
    text: "Total control: You can hold fulfillment or let it ship. Notice how Zeno instantly tags Shopify and saves $1,249 in chargebacks.",
  },
];

function DockerHowItWorks() {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'demo' | 'code'>('demo');
  const [activeViewIndex, setActiveViewIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simStep, setSimStep] = useState<number | null>(null);
  const [demoDecision, setDemoDecision] = useState<'idle' | 'holding' | 'held' | 'approved'>('idle');
  const [autoKey, setAutoKey] = useState(0); // incremented each auto-advance to restart CSS animation

  // Auto-play: refs for the section container, running timer, and user-interaction tracking
  const containerRef     = useRef<HTMLDivElement>(null);
  const autoTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef     = useRef(false);
  const userInteractRef  = useRef(false);
  const resumeTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIndexRef   = useRef(0); // mirror of activeStepIndex for use inside interval

  // Keep the ref in sync with state so the interval always reads the latest value
  activeIndexRef.current = activeStepIndex;

  const step = WORKFLOW_STEPS[activeStepIndex];
  const view = step.views[activeViewIndex] || step.views[0];

  const stopAutoPlay = useCallback(() => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  }, []);

  const startAutoPlay = useCallback(() => {
    stopAutoPlay();
    // Advance one step every 4 seconds; loop back to 0 after the last step
    autoTimerRef.current = setInterval(() => {
      if (!isVisibleRef.current || userInteractRef.current) return;
      setActiveStepIndex(prev => {
        const next = (prev + 1) % WORKFLOW_STEPS.length;
        if (next === 0) setDemoDecision('idle');
        return next;
      });
      setActiveViewIndex(0);
      setSimulating(false);
      setSimStep(null);
      setViewMode('demo');
      setAutoKey(k => k + 1);
    }, 4000);
  }, [stopAutoPlay]);

  // Pause auto-play on user interaction; resume after 8 s of inactivity
  const onUserInteract = useCallback(() => {
    userInteractRef.current = true;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      userInteractRef.current = false;
    }, 8000);
  }, []);

  // IntersectionObserver: start auto-play when the section is visible, stop when not
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          startAutoPlay();
        } else {
          stopAutoPlay();
        }
      },
      { threshold: 0.25 } // at least 25% visible before starting
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      stopAutoPlay();
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [startAutoPlay, stopAutoPlay]);

  const handleTabChange = useCallback((index: number) => {
    onUserInteract();
    setActiveStepIndex(index);
    setActiveViewIndex(0);
    setSimulating(false);
    setSimStep(null);
    if (index === 0) {
      setDemoDecision('idle');
    }
  }, [onUserInteract]);

  const handleCopy = () => {
    onUserInteract();
    try {
      navigator.clipboard.writeText(view.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleRunSimulation = () => {
    onUserInteract();
    if (simulating) return;
    setViewMode('code');
    if (simStep !== null) {
      setSimStep(null);
      return;
    }
    setSimulating(true);
    setSimStep(1);
    const total = step.simLogs.length;
    let curr = 1;
    const interval = setInterval(() => {
      curr += 1;
      setSimStep(curr);
      if (curr >= total) {
        clearInterval(interval);
        setSimulating(false);
      }
    }, 280);
  };

  const codeLines = view.code.split('\n');

  return (
    <div className="lp-hiw-container" ref={containerRef}>
      {/* Interactive Presenter Bar */}
      <div className="lp-presenter-bar lp-reveal">
        <div className="lp-presenter-info">
          <div className="lp-presenter-badge">
            <span className="lp-presenter-pulse-dot" />
            Interactive Walkthrough
          </div>
          <div className="lp-presenter-quote">
            <span>{PRESENTER_SCRIPTS[activeStepIndex].speaker}:</span>
            &ldquo;{PRESENTER_SCRIPTS[activeStepIndex].text}&rdquo;
          </div>
        </div>
        <div className="lp-presenter-controls">
          <button
            className="lp-pres-btn lp-pres-btn-nav"
            disabled={activeStepIndex === 0}
            onClick={() => handleTabChange(Math.max(0, activeStepIndex - 1))}
            title="Previous step"
            aria-label="Previous step"
          >
            <ChevronLeft size={14} />
          </button>

          <div className="lp-pres-progress" role="tablist" aria-label="Walkthrough progress">
            {WORKFLOW_STEPS.map((_, i) => (
              <span
                key={i}
                className={`lp-pres-bar ${i === activeStepIndex ? 'active' : ''}`}
                onClick={() => handleTabChange(i)}
                style={{ cursor: 'pointer' }}
                title={`Jump to Step 0${i + 1}`}
              />
            ))}
          </div>

          <button
            className="lp-pres-btn lp-pres-btn-nav"
            disabled={activeStepIndex === WORKFLOW_STEPS.length - 1}
            onClick={() => handleTabChange(Math.min(WORKFLOW_STEPS.length - 1, activeStepIndex + 1))}
            title="Next step"
            aria-label="Next step"
          >
            <ChevronRight size={14} />
          </button>

          <button
            className="lp-pres-btn lp-pres-btn-nav"
            onClick={() => {
              handleTabChange(0);
              setDemoDecision('idle');
            }}
            title="Restart walkthrough demo"
            aria-label="Restart demo"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* Auto-play progress bar — shows time remaining until next step */}
      {!userInteractRef.current && (
        <div className="lp-auto-progress">
          <div className="lp-auto-progress-bar" key={autoKey} />
        </div>
      )}

      {/* Docker-Style Segmented Navigation Tabs */}
      <div className="lp-docker-tabs-wrap lp-reveal">
        <div className="lp-docker-tabs" role="tablist" aria-label="Zeno workflow stages">
          {WORKFLOW_STEPS.map((s, idx) => {
            const isActive = idx === activeStepIndex;
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={isActive}
                className={`lp-dtab-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleTabChange(idx)}
              >
                <span className="lp-dtab-icon" aria-hidden="true">
                  {idx === 0 && <Layers size={13} />}
                  {idx === 1 && <Terminal size={13} />}
                  {idx === 2 && <Cpu size={13} />}
                  {idx === 3 && <Shield size={13} />}
                </span>
                <span>{s.tabLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2-Column Showcase */}
      <div className="lp-docker-stage lp-reveal lp-reveal-d1">
        {/* Left Column: Story & Key Specs */}
        <div className="lp-dpanel-left">
          <div>
            <div className="lp-dstep-kicker">
              <span className="lp-dstep-kicker-dot" />
              {step.kicker}
            </div>
            <h3 className="lp-dstep-title">{step.title}</h3>
            <p className="lp-dstep-desc">{step.desc}</p>

            <div className="lp-dfeature-list">
              {step.features.map((feat, i) => (
                <div className="lp-dfeature-item" key={i}>
                  <div className="lp-dfeature-icon" aria-hidden="true">
                    <Check size={13} />
                  </div>
                  <div className="lp-dfeature-body">
                    <h4>{feat.title}</h4>
                    <p>{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-dpanel-footer">
            <Link to={step.ctaHref} className="lp-dstep-cta">
              {step.ctaText} <ArrowRight size={14} />
            </Link>

            <div className="lp-dstep-nav">
              <button
                className="lp-dstep-btn"
                disabled={activeStepIndex === 0}
                onClick={() => handleTabChange(Math.max(0, activeStepIndex - 1))}
                aria-label="Previous stage"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="lp-dstep-dots">
                {WORKFLOW_STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`lp-dstep-dot ${i === activeStepIndex ? 'active' : ''}`}
                    onClick={() => handleTabChange(i)}
                  />
                ))}
              </div>

              <button
                className="lp-dstep-btn"
                disabled={activeStepIndex === WORKFLOW_STEPS.length - 1}
                onClick={() => handleTabChange(Math.min(WORKFLOW_STEPS.length - 1, activeStepIndex + 1))}
                aria-label="Next stage"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Docker-style Terminal Sandbox */}
        <div className="lp-dpanel-right">
          {/* Terminal Window Header Bar */}
          <div className="lp-dterm-topbar">
            <div className="lp-dterm-left">
              <div className="lp-dterm-dots" aria-hidden="true">
                <span className="lp-dterm-dot red" />
                <span className="lp-dterm-dot yellow" />
                <span className="lp-dterm-dot green" />
              </div>

              {/* Sub-view switcher tabs */}
              <div className="lp-dterm-views">
                <button
                  className={`lp-dterm-view-btn ${viewMode === 'demo' && simStep === null ? 'active' : ''}`}
                  onClick={() => {
                    onUserInteract();
                    setViewMode('demo');
                    setSimStep(null);
                  }}
                  title="Interactive Storefront Order Demo"
                >
                  <Sparkles size={12} color="#818cf8" />
                  Interactive Demo
                </button>
                {step.views.map((v, idx) => (
                  <button
                    key={v.filename}
                    className={`lp-dterm-view-btn ${viewMode === 'code' && idx === activeViewIndex && simStep === null ? 'active' : ''}`}
                    onClick={() => {
                      onUserInteract();
                      setViewMode('code');
                      setActiveViewIndex(idx);
                      setSimStep(null);
                    }}
                  >
                    <Code2 size={12} />
                    {v.filename}
                  </button>
                ))}
              </div>
            </div>

            <div className="lp-dterm-actions">
              <button
                className="lp-dterm-run-btn"
                onClick={handleRunSimulation}
                title="Run real-time order detection simulation"
              >
                {simulating ? (
                  <>
                    <RotateCcw size={12} className="animate-spin" />
                    Streaming...
                  </>
                ) : simStep !== null ? (
                  <>
                    <RotateCcw size={12} />
                    View Code
                  </>
                ) : (
                  <>
                    <Play size={12} fill="currentColor" />
                    Simulate Log
                  </>
                )}
              </button>

              <button
                className="lp-dterm-copy-btn"
                onClick={handleCopy}
                title="Copy snippet"
              >
                {copied ? (
                  <>
                    <Check size={12} color="#4ade80" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Code Body / Simulated Logs / Interactive Demo */}
          <div className="lp-dterm-body">
            {simStep !== null ? (
              <div className="lp-sim-logs">
                {step.simLogs.slice(0, simStep).map((log, i) => (
                  <div className="lp-sim-line" key={i}>
                    <span className="lp-sim-time">{log.time}</span>
                    <span className={`lp-sim-tag lp-sim-tag-${log.tagType}`}>{log.tag}</span>
                    <span className="lp-sim-msg">{log.msg}</span>
                  </div>
                ))}
                {simulating && (
                  <div className="lp-sim-line">
                    <span className="lp-sim-time">...</span>
                    <span className="lp-dterm-cursor" />
                  </div>
                )}
              </div>
            ) : viewMode === 'demo' ? (
              <div className="lp-demo-interactive">
                {activeStepIndex === 0 && (
                  <>
                    <div>
                      <div className="lp-demo-screen-header">
                        <div className="lp-demo-order-badge">
                          <ShoppingBag size={14} color="#818cf8" />
                          <span>STAGE 01 // INBOUND STORE ORDER</span>
                        </div>
                        <div className="lp-demo-order-amount">$1,249.00</div>
                      </div>

                      <div className="lp-demo-order-box">
                        <div className="lp-demo-order-row">
                          <span className="lp-demo-order-label">Order Number</span>
                          <span className="lp-demo-order-val">#1048 &bull; Shopify Plus Store</span>
                        </div>
                        <div className="lp-demo-order-row">
                          <span className="lp-demo-order-label">Customer Profile</span>
                          <span className="lp-demo-order-val">Sarah K. (New Buyer &bull; s.k***@relay-mail.com)</span>
                        </div>
                        <div className="lp-demo-order-row">
                          <span className="lp-demo-order-label">Shipping Destination</span>
                          <span className="lp-demo-order-val">Strada Industriei 4, Bucharest, RO</span>
                        </div>
                        <div className="lp-demo-order-row">
                          <span className="lp-demo-order-label">Line Items</span>
                          <span className="lp-demo-order-val">2x Arc&apos;teryx Alpha SV Jacket ($1,249.00)</span>
                        </div>
                        <div className="lp-demo-order-row">
                          <span className="lp-demo-order-label">Card Origin</span>
                          <span className="lp-demo-order-val">Visa •••• 4242 &bull; Issued in Ohio, USA</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <button
                        className="lp-demo-trigger-btn"
                        onClick={() => handleTabChange(1)}
                      >
                        <Eye size={15} />
                        <span>Inspect Order Signals with Zeno &rarr;</span>
                      </button>
                      <div className="lp-presenter-click-hint" onClick={() => handleTabChange(1)}>
                        👉 Click to inspect live telemetry &amp; signals
                      </div>
                    </div>
                  </>
                )}

                {activeStepIndex === 1 && (
                  <>
                    <div>
                      <div className="lp-demo-screen-header">
                        <div className="lp-demo-order-badge">
                          <Terminal size={14} color="#38bdf8" />
                          <span>STAGE 02 // REAL-TIME TELEMETRY (18ms)</span>
                        </div>
                        <div className="lp-demo-pill-block">CONFIDENCE: 94.2%</div>
                      </div>

                      <div className="lp-demo-telemetry-grid">
                        <div className="lp-demo-telemetry-item">
                          <div className="lp-demo-telemetry-left">
                            <Globe size={14} color="#f87171" />
                            <span>IP Geolocation: Bucharest, RO (Datacenter Proxy/Tor exit)</span>
                          </div>
                          <span className="lp-demo-pill-block">PROXY DETECTED</span>
                        </div>
                        <div className="lp-demo-telemetry-item">
                          <div className="lp-demo-telemetry-left">
                            <Layers size={14} color="#fbbf24" />
                            <span>Cluster Graph: Card hash linked to 3 prior chargebacks</span>
                          </div>
                          <span className="lp-demo-pill-warn">FRAUD CLUSTER</span>
                        </div>
                        <div className="lp-demo-telemetry-item">
                          <div className="lp-demo-telemetry-left">
                            <Cpu size={14} color="#fbbf24" />
                            <span>Velocity Radar: 4 orders submitted across 2 emails in 45s</span>
                          </div>
                          <span className="lp-demo-pill-warn">HIGH VELOCITY</span>
                        </div>
                        <div className="lp-demo-telemetry-item">
                          <div className="lp-demo-telemetry-left">
                            <Shield size={14} color="#f87171" />
                            <span>Distance Matrix: 4,200 km billing vs shipping discrepancy</span>
                          </div>
                          <span className="lp-demo-pill-block">GEO MISMATCH</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <button
                        className="lp-demo-trigger-btn"
                        onClick={() => handleTabChange(2)}
                      >
                        <Sparkles size={15} />
                        <span>Generate Plain-Language Reasons &rarr;</span>
                      </button>
                      <div className="lp-presenter-click-hint" onClick={() => handleTabChange(2)}>
                        👉 Click to view explainable AI decision
                      </div>
                    </div>
                  </>
                )}

                {activeStepIndex === 2 && (
                  <>
                    <div>
                      <div className="lp-demo-screen-header">
                        <div className="lp-demo-order-badge">
                          <Cpu size={14} color="#a855f7" />
                          <span>STAGE 03 // EXPLAINABLE RISK BRIEF</span>
                        </div>
                        <div className="lp-demo-pill-warn" style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.15)' }}>
                          RECOMMENDATION: HOLD FULFILLMENT
                        </div>
                      </div>

                      <div className="lp-demo-evidence-list">
                        <div className="lp-demo-evidence-item">
                          <strong>1. High-Value First-Time Buyer:</strong> Account created 3 minutes before checkout. Cart value ($1,249.00) is 10.5&times; higher than store average cart size ($118.00).
                        </div>
                        <div className="lp-demo-evidence-item">
                          <strong>2. Severe Geographic Discrepancy:</strong> Card origin is Ohio, USA, but destination drop address is 4,200 km away in Bucharest, Romania through a known proxy.
                        </div>
                        <div className="lp-demo-evidence-item">
                          <strong>3. Network Cluster Reputation:</strong> Device fingerprint matches a known automated card-testing cluster with 3 recent chargebacks in partner stores.
                        </div>
                      </div>
                    </div>

                    <div>
                      <button
                        className="lp-demo-trigger-btn"
                        onClick={() => handleTabChange(3)}
                      >
                        <Shield size={15} />
                        <span>Execute Automated Defense &rarr;</span>
                      </button>
                      <div className="lp-presenter-click-hint" onClick={() => handleTabChange(3)}>
                        👉 Click to test merchant defense controls
                      </div>
                    </div>
                  </>
                )}

                {activeStepIndex === 3 && (
                  <>
                    <div>
                      <div className="lp-demo-screen-header">
                        <div className="lp-demo-order-badge">
                          <Shield size={14} color="#4ade80" />
                          <span>STAGE 04 // MERCHANT DEFENSE GATE</span>
                        </div>
                        <div className="lp-demo-pill-block">RISK CONFIRMED</div>
                      </div>

                      {demoDecision === 'idle' && (
                        <div>
                          <div className="lp-demo-action-prompt">
                            <div className="lp-demo-action-title">Zeno flagged Order #1048 for immediate action</div>
                            <div className="lp-demo-action-sub">Choose a response to see live protection or automated policy in action:</div>
                          </div>

                          <div className="lp-demo-action-buttons">
                            <button
                              className="lp-demo-btn-hold"
                              onClick={() => { onUserInteract(); setDemoDecision('held'); }}
                            >
                              <Shield size={14} />
                              <span>🛑 Hold Fulfillment (Shopify Tag)</span>
                            </button>
                            <button
                              className="lp-demo-btn-approve"
                              onClick={() => { onUserInteract(); setDemoDecision('approved'); }}
                            >
                              <span>✅ Approve &amp; Release</span>
                            </button>
                          </div>

                          <div className="lp-presenter-click-hint" onClick={() => setDemoDecision('held')}>
                            👉 Click &ldquo;Hold Fulfillment&rdquo; to simulate live defense
                          </div>
                        </div>
                      )}

                      {demoDecision === 'held' && (
                        <div className="lp-demo-success-banner">
                          <div className="lp-demo-success-title">
                            <CheckCircle2 size={18} color="#4ade80" />
                            <span>THREAT INTERCEPTED &bull; ORDER PUT ON HOLD</span>
                          </div>
                          <div className="lp-demo-success-desc">
                            Tag <code>zeno-hold</code> automatically attached to Shopify Order #1048 in <strong>18ms</strong>. Warehouse dispatch paused.
                            <br />
                            <strong style={{ color: '#4ade80' }}>$1,249.00 in chargeback loss and lost inventory protected!</strong>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px' }}>
                            <button
                              className="lp-pres-btn lp-pres-btn-play"
                              onClick={() => {
                                setDemoDecision('idle');
                                handleTabChange(0);
                              }}
                            >
                              <RotateCcw size={13} />
                              <span>Restart Walkthrough</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {demoDecision === 'approved' && (
                        <div className="lp-demo-success-banner" style={{ borderColor: 'rgba(56,189,248,0.4)', background: 'rgba(14,165,233,0.15)' }}>
                          <div className="lp-demo-success-title" style={{ color: '#38bdf8' }}>
                            <Check size={18} color="#38bdf8" />
                            <span>ORDER APPROVED &bull; FULFILLMENT RELEASED</span>
                          </div>
                          <div className="lp-demo-success-desc">
                            Order #1048 approved by merchant. Zeno will continue tracking delivery confirmation telemetry.
                          </div>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px' }}>
                            <button
                              className="lp-pres-btn lp-pres-btn-play"
                              onClick={() => {
                                setDemoDecision('idle');
                                handleTabChange(0);
                              }}
                            >
                              <RotateCcw size={13} />
                              <span>Restart Walkthrough</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <pre className="lp-dterm-code-pre">
                <code>
                  {codeLines.map((line, lineIdx) => (
                    <span className="lp-code-line" key={lineIdx}>
                      <span className="lp-code-num">{lineIdx + 1}</span>
                      {highlightSyntax(line)}
                    </span>
                  ))}
                </code>
              </pre>
            )}
          </div>

          {/* Terminal Window Footer */}
          <div className="lp-dterm-footer">
            <div className="lp-dterm-status">
              <span
                className="lp-dterm-status-dot"
                style={{
                  background: simStep !== null && !simulating ? '#38bdf8' : simulating ? '#f59e0b' : '#4ade80',
                  boxShadow: `0 0 8px ${simStep !== null && !simulating ? 'rgba(56,189,248,0.6)' : simulating ? 'rgba(245,158,11,0.6)' : 'rgba(74,222,128,0.6)'}`
                }}
              />
              <span>
                {simulating
                  ? 'SIMULATING EVENT INGESTION...'
                  : simStep !== null
                  ? 'SIMULATION COMPLETE'
                  : viewMode === 'demo'
                  ? 'INTERACTIVE ORDER DEMO ACTIVE'
                  : 'ZENO ENGINE ONLINE'}
              </span>
            </div>
            <div className="lp-dterm-meta">
              <span>⚡ Latency: 18ms</span>
              <span>🔒 HMAC-SHA256</span>
            </div>
          </div>
        </div>
      </div>

      {/* Docker-Style Bottom Performance Metrics */}
      <div className="lp-docker-metrics lp-reveal lp-reveal-d2">
        <div className="lp-dmetric-card">
          <div className="lp-dmetric-val"><span className="accent">&lt; 45ms</span></div>
          <div className="lp-dmetric-label">Sub-Second Latency</div>
          <p className="lp-dmetric-desc">Evaluated instantaneously before customer checkout completes.</p>
        </div>
        <div className="lp-dmetric-card">
          <div className="lp-dmetric-val"><span className="accent">99.8%</span></div>
          <div className="lp-dmetric-label">Threat Interception</div>
          <p className="lp-dmetric-desc">Pinpoints card testing, synthetic buyers, and coordinated rings.</p>
        </div>
        <div className="lp-dmetric-card">
          <div className="lp-dmetric-val"><span className="accent">0 Code</span></div>
          <div className="lp-dmetric-label">Frictionless Setup</div>
          <p className="lp-dmetric-desc">Native 1-click Shopify &amp; WooCommerce apps plus universal webhooks.</p>
        </div>
        <div className="lp-dmetric-card">
          <div className="lp-dmetric-val"><span className="accent">100%</span></div>
          <div className="lp-dmetric-label">Explainable Evidence</div>
          <p className="lp-dmetric-desc">Every flag provides plain-language reasons, not cryptic scores.</p>
        </div>
      </div>

      {/* Upgraded Transaction Lifecycle Pipeline */}
      <div className="lp-journey lp-reveal lp-reveal-d3">
        <div className="lp-journey-header">
          <div className="lp-journey-label">
            <Sparkles size={13} />
            Watch an order move through Zeno
          </div>
        </div>

        <div className="lp-journey-track">
          {/* Stage 1: Ingest */}
          <div className="lp-journey-stage">
            <div className="lp-journey-stage-top">
              <span className="lp-journey-stage-label">01 // Ingest</span>
              <span className="lp-journey-stage-badge">Webhook</span>
            </div>
            <div className="lp-journey-card">
              <div className="lp-journey-card-amt">$129.00</div>
              <div className="lp-journey-card-hint">Sarah M. · returning buyer</div>
            </div>
            <div className="lp-journey-card">
              <div className="lp-journey-card-amt">$890.00</div>
              <div className="lp-journey-card-hint">New account · first order</div>
            </div>
            <div className="lp-journey-card">
              <div className="lp-journey-card-amt">$1,499.00</div>
              <div className="lp-journey-card-hint">Unknown · unusual shipping</div>
            </div>
          </div>

          {/* Stage 2: Inspect */}
          <div className="lp-journey-stage">
            <div className="lp-journey-stage-top">
              <span className="lp-journey-stage-label">02 // Inspect</span>
              <span className="lp-journey-stage-badge">Telemetry</span>
            </div>
            <div className="lp-journey-card">
              <div className="lp-journey-card-amt">$129.00</div>
              <div className="lp-journey-card-hint">Order history ✓ · Matching card ✓</div>
            </div>
            <div className="lp-journey-card">
              <div className="lp-journey-card-amt">$890.00</div>
              <div className="lp-journey-card-hint">New customer · High value basket</div>
            </div>
            <div className="lp-journey-card">
              <div className="lp-journey-card-amt">$1,499.00</div>
              <div className="lp-journey-card-hint">No history · 4,200 km geo mismatch</div>
            </div>
          </div>

          {/* Stage 3: Reason */}
          <div className="lp-journey-stage">
            <div className="lp-journey-stage-top">
              <span className="lp-journey-stage-label">03 // Reason</span>
              <span className="lp-journey-stage-badge">Explainable</span>
            </div>
            <div className="lp-journey-card">
              <div className="lp-journey-card-amt">$129.00</div>
              <div className="lp-journey-card-hint">"Trusted buyer, zero anomalies."</div>
            </div>
            <div className="lp-journey-card">
              <div className="lp-journey-card-amt">$890.00</div>
              <div className="lp-journey-card-hint">"Large first cart — check before ship."</div>
            </div>
            <div className="lp-journey-card">
              <div className="lp-journey-card-amt">$1,499.00</div>
              <div className="lp-journey-card-hint">"VPN proxy &amp; cluster flag. Hold order."</div>
            </div>
          </div>

          {/* Stage 4: Resolve */}
          <div className="lp-journey-stage">
            <div className="lp-journey-stage-top">
              <span className="lp-journey-stage-label">04 // Resolve</span>
              <span className="lp-journey-stage-badge">Decision</span>
            </div>
            <div className="lp-journey-card">
              <div className="lp-journey-card-result">
                <div className="lp-badge lp-badge-safe"><span className="lp-badge-dot"/>SAFE ✓</div>
              </div>
            </div>
            <div className="lp-journey-card">
              <div className="lp-journey-card-result">
                <div className="lp-badge lp-badge-review"><span className="lp-badge-dot"/>REVIEW</div>
              </div>
            </div>
            <div className="lp-journey-card">
              <div className="lp-journey-card-result">
                <div className="lp-badge lp-badge-blocked"><span className="lp-badge-dot"/>BLOCKED ✗</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ORDERS FLOW VISUAL (problem section) ────────────────────────────────── */
function OrdersFlowVisual() {
  const orders = [
    { id:'#2041', amt:'$129',    hint:'Returning customer',      badge:'safe'    },
    { id:'#2042', amt:'$1,499',  hint:'New account, high value', badge:'review'  },
    { id:'#2043', amt:'$89',     hint:'Trusted buyer',           badge:'safe'    },
    { id:'#2044', amt:'$3,200',  hint:'Unusual shipping',        badge:'blocked' },
    { id:'#2045', amt:'$245',    hint:'Regular order',           badge:'safe'    },
  ];

  return (
    <div className="lp-orders-flow">
      <div className="lp-flow-label">Incoming orders</div>
      <div className="lp-flow-orders">
        {orders.map(o => (
          <div className="lp-flow-order" key={o.id}>
            <div className="lp-flow-left">
              <span className="lp-flow-order-id">{o.id}</span>
              <span className="lp-flow-order-amt">{o.amt}</span>
              <span className="lp-flow-order-hint">{o.hint}</span>
            </div>
            <div className={`lp-badge lp-badge-${o.badge}`}>
              <span className="lp-badge-dot" />
              {o.badge === 'safe' ? 'SAFE ✓' : o.badge === 'review' ? 'REVIEW' : 'BLOCKED ✗'}
            </div>
          </div>
        ))}
      </div>
      <div className="lp-flow-watching">
        <div className="lp-flow-watching-dot" />
        <span>Zeno is watching every order</span>
      </div>
    </div>
  );
}

/* ── DASHBOARD MOCKUP ─────────────────────────────────────────────────────── */
function DashboardMockup() {
  const rows = [
    { id:'#1048', name:'Sarah K.',  hint:'2 orders before',   amt:'$149', badge:'safe' },
    { id:'#1049', name:'Unknown',   hint:'Unusual activity',  amt:'$1,249', badge:'review' },
    { id:'#1050', name:'Tom R.',    hint:'Loyal customer',    amt:'$89',  badge:'safe' },
    { id:'#1051', name:'M. Garcia', hint:'Flagged address',   amt:'$2,100', badge:'blocked' },
    { id:'#1052', name:'Anna W.',   hint:'First order',       amt:'$320', badge:'review' },
  ];
  return (
    <div className="lp-dash">
      <div className="lp-dash-topbar">
        <div className="lp-dash-dot" style={{background:'#f87171'}} />
        <div className="lp-dash-dot" style={{background:'#fbbf24'}} />
        <div className="lp-dash-dot" style={{background:'#4ade80'}} />
        <span className="lp-dash-title">Zeno — Today's Orders</span>
      </div>
      <div className="lp-dash-body">
        <div className="lp-dash-stats">
          <div className="lp-dash-stat">
            <div className="lp-dash-stat-label">Safe</div>
            <div className="lp-dash-stat-val green">47</div>
          </div>
          <div className="lp-dash-stat">
            <div className="lp-dash-stat-label">Review</div>
            <div className="lp-dash-stat-val amber">3</div>
          </div>
          <div className="lp-dash-stat">
            <div className="lp-dash-stat-label">Blocked</div>
            <div className="lp-dash-stat-val red">2</div>
          </div>
        </div>
        <div className="lp-dash-orders-label">Recent orders</div>
        {rows.map(r => (
          <div className="lp-dash-order-row" key={r.id}>
            <div className="lp-dash-order-info">
              <span className="lp-dash-order-id">{r.id} · {r.name}</span>
              <span className="lp-dash-order-meta">{r.hint}</span>
            </div>
            <div className="lp-dash-order-right">
              <span className="lp-dash-order-amt">{r.amt}</span>
              <div className={`lp-badge lp-badge-${r.badge}`} style={{fontSize:'10px',padding:'3px 8px'}}>
                {r.badge === 'safe' ? 'SAFE ✓' : r.badge === 'review' ? 'REVIEW' : 'BLOCKED'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── REASON CARD ──────────────────────────────────────────────────────────── */
function ReasonCard() {
  return (
    <div className="lp-reason-card">
      <div className="lp-reason-top">
        <div className="lp-reason-order">
          <span className="lp-reason-order-num">ORDER #1048</span>
          <span className="lp-reason-order-amt">$1,249</span>
        </div>
        <div className="lp-badge lp-badge-review" style={{fontSize:'12px'}}>
          <span className="lp-badge-dot" />
          REVIEW
        </div>
      </div>
      <div className="lp-reason-body">
        <div className="lp-reason-why-label">Why Zeno flagged this</div>
        <div className="lp-reason-items">
          <div className="lp-reason-item">
            <div className="lp-reason-item-dot" />
            <span>New customer — first order on this account</span>
          </div>
          <div className="lp-reason-item">
            <div className="lp-reason-item-dot" />
            <span>Unusually large order for this product category</span>
          </div>
          <div className="lp-reason-item">
            <div className="lp-reason-item-dot" />
            <span>Shipping address doesn't match billing details</span>
          </div>
        </div>
        <div className="lp-reason-action">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a5a8f4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Now you know what to check before you ship.
        </div>
      </div>
    </div>
  );
}

/* ── SECURITY ORB (3D CSS) ────────────────────────────────────────────────── */
/* ── SECURITY ORB — uses the same ZenoVisualization from login/register ─────── */
function SecurityOrb() {
  return (
    <div className="lp-sec-viz-wrap">
      <ZenoVisualization
        isDark={true}
        className="lp-sec-viz"
      />
    </div>
  );
}

/* ── NAV ──────────────────────────────────────────────────────────────────── */
function Nav({ logoVariant }: { logoVariant: 'dark' | 'light' }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const links = [
    { href:'#how-it-works',  label:'How It Works' },
    { href:'#features',      label:'Features' },
    { href:'#testimonials',  label:'Testimonials' },
    { href:'#security',      label:'Security' },
  ];

  return (
    <nav className="lp-nav">
      <div className="wrap lp-nav-inner">
        <Link to="/" className="lp-brand" onClick={close}>
          <ZenoLogo height={28} forceVariant={logoVariant} />
          ZENO
        </Link>

        <div className="lp-nav-links">
          {links.map(l => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </div>

        <div className="lp-nav-actions">
          <Link to="/login" className="lp-btn lp-btn-ghost">Log In</Link>
          <Link to="/register" className="lp-btn lp-btn-primary">Get Started</Link>
        </div>

        <button
          className="lp-mobile-btn"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="lp-mobile-menu">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={close}>{l.label}</a>
          ))}
          <div className="lp-mm-divider" />
          <Link to="/login" onClick={close}>Log In</Link>
          <Link to="/register" onClick={close} className="lp-mm-primary">Get Started →</Link>
        </div>
      )}
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN LANDING PAGE EXPORT
───────────────────────────────────────────────────────────────────────────── */
export function Landing() {
  useForceDark();
  useRevealOnScroll();

  // Force body to match the landing dark background — prevents any gap or flash
  useEffect(() => {
    const prev = document.body.style.cssText;
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.background = '#0c0d14';
    document.body.style.overflow = 'auto';
    return () => { document.body.style.cssText = prev; };
  }, []);

  const logoVariant = 'dark'; // landing is always dark

  return (
    <>
      <style>{STYLES}</style>
      <div className="lp">

        {/* ── subtle background grid + glows ─────────────────────────── */}
        <div className="lp-bg-grid" aria-hidden="true" />
        <div className="lp-bg-glow-a" aria-hidden="true" />
        <div className="lp-bg-glow-b" aria-hidden="true" />

        {/* ══════════════════════════════════════════════════════════════
            NAV
        ══════════════════════════════════════════════════════════════ */}
        <Nav logoVariant={logoVariant} />

        {/* All page content below the fixed nav */}
        <div className="lp-page-body">

        {/* ══════════════════════════════════════════════════════════════
            HERO
        ══════════════════════════════════════════════════════════════ */}
        <section aria-label="Hero">
          <div className="wrap">
            <div className="lp-hero">

              {/* LEFT — copy */}
              <div className="lp-hero-left">


                <h1>
                  Stop bad orders<br />
                  <span className="lp-h1-accent">before they cost you.</span>
                </h1>

                <p className="lp-hero-sub">
                  Zeno watches your store around the clock, spots suspicious
                  orders, and tells you what to do — before you lose money.
                </p>

                <div className="lp-hero-ctas">
                  <Link to="/register" className="lp-btn-hero-primary">
                    Protect My Store <ArrowRight size={16} />
                  </Link>
                  <a href="#how-it-works" className="lp-btn-hero-secondary">
                    See How It Works
                  </a>
                </div>

                <div className="lp-hero-trust">
                  {[
                    'No technical skills needed',
                    'Quick setup',
                    'You always decide',
                  ].map(t => (
                    <div className="lp-hero-trust-item" key={t}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <circle cx="7" cy="7" r="7" fill="rgba(74,222,128,0.15)" />
                        <path d="M4 7l2 2 4-4" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT — 3D orb */}
              <ZenoOrb logoVariant={logoVariant} />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            TRUST BAR
        ══════════════════════════════════════════════════════════════ */}
        <div className="lp-trust" aria-label="Trust signals">
          <div className="wrap lp-trust-inner">
            {[
              { icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ), label: '24/7 Protection' },
              { icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              ), label: 'Fast Decisions' },
              { icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              ), label: 'Simple to Use' },
              { icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
              ), label: 'Built for Growing Stores' },
            ].map(item => (
              <div className="lp-trust-item" key={item.label}>
                <div className="lp-trust-icon" aria-hidden="true">{item.icon}</div>
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            PROBLEM SECTION (LIGHT SECTION)
        ══════════════════════════════════════════════════════════════ */}
        <section className="lp-problem" id="problem" aria-label="The problem">
          {/* Futuristic risk intelligence & detection background */}
          <div className="lp-decor-problem" aria-hidden="true">
            <svg width="100%" height="100%" viewBox="0 0 1200 680" fill="none" preserveAspectRatio="xMidYMid slice">
              <defs>
                <filter id="lp-prob-beam-blur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="22" />
                </filter>
                <filter id="lp-prob-sphere-blur" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="30" />
                </filter>
                <linearGradient id="lp-prob-beam-grad" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8588e6" stopOpacity="0" />
                  <stop offset="30%" stopColor="#8588e6" stopOpacity="0.3" />
                  <stop offset="55%" stopColor="#6366f1" stopOpacity="0.45" />
                  <stop offset="75%" stopColor="#a5b4fc" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
                <radialGradient id="lp-prob-sphere-grad" cx="40%" cy="35%" r="60%">
                  <stop offset="0%" stopColor="#a5a8f4" stopOpacity="0.22" />
                  <stop offset="45%" stopColor="#8588e6" stopOpacity="0.1" />
                  <stop offset="80%" stopColor="#6366f1" stopOpacity="0.02" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Luminous purple light beam curving through background */}
              <path
                d="M 1180 20 Q 860 220 720 380 T 320 660"
                stroke="url(#lp-prob-beam-grad)"
                strokeWidth="60"
                fill="none"
                filter="url(#lp-prob-beam-blur)"
                className="lp-beam-anim"
              />
              <path
                d="M 1180 20 Q 860 220 720 380 T 320 660"
                stroke="rgba(133,136,230,0.3)"
                strokeWidth="1.5"
                fill="none"
              />

              {/* Translucent 3D radar sphere behind orders visual */}
              <circle cx="890" cy="340" r="140" fill="url(#lp-prob-sphere-grad)" filter="url(#lp-prob-sphere-blur)" />

              {/* Orbital Risk Radar rings */}
              <g className="lp-orbit-slow-1" style={{ transformOrigin: '890px 340px' }}>
                <ellipse cx="890" cy="340" rx="380" ry="260" stroke="rgba(133,136,230,0.18)" strokeWidth="1" strokeDasharray="4 12" />
                <circle cx="1270" cy="340" r="3" fill="#8588e6" className="lp-node-glow" />
                <circle cx="510" cy="340" r="2.5" fill="#a5a8f4" className="lp-node-glow-alt" />
              </g>
              <g className="lp-orbit-slow-2" style={{ transformOrigin: '890px 340px' }}>
                <ellipse cx="890" cy="340" rx="270" ry="185" stroke="rgba(99,102,241,0.14)" strokeWidth="1" strokeDasharray="8 16" />
                <circle cx="890" cy="155" r="3" fill="#6366f1" className="lp-node-glow" />
                <circle cx="890" cy="525" r="2.5" fill="#8588e6" className="lp-node-glow-alt" />
              </g>
              <ellipse cx="890" cy="340" rx="160" ry="110" stroke="rgba(133,136,230,0.22)" strokeWidth="1" />
              <ellipse cx="890" cy="340" rx="70" ry="50" stroke="rgba(133,136,230,0.15)" strokeWidth="0.8" strokeDasharray="2 4" />

              {/* Animated flowing data streams */}
              <path
                d="M 60 380 C 300 320, 520 440, 780 340 C 960 270, 1080 330, 1180 280"
                stroke="rgba(133,136,230,0.2)"
                strokeWidth="1.2"
                fill="none"
              />
              <path
                d="M 60 380 C 300 320, 520 440, 780 340 C 960 270, 1080 330, 1180 280"
                stroke="#6366f1"
                strokeWidth="2"
                fill="none"
                className="lp-stream-pulse"
              />
              <path
                d="M 120 490 Q 420 400 680 430 T 1140 370"
                stroke="#8588e6"
                strokeWidth="1.5"
                fill="none"
                className="lp-stream-pulse-rev"
              />

              {/* Risk Anomaly Detection Nodes */}
              <g transform="translate(680, 430)">
                <circle cx="0" cy="0" r="4" fill="#f59e0b" />
                <circle cx="0" cy="0" r="10" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.4" className="lp-detection-ping-circle" />
              </g>
              <g transform="translate(980, 245)">
                <circle cx="0" cy="0" r="4.5" fill="#ef4444" />
                <circle cx="0" cy="0" r="14" stroke="#ef4444" strokeWidth="1.2" strokeOpacity="0.6" className="lp-detection-ping-circle" />
                <circle cx="0" cy="0" r="22" stroke="#ef4444" strokeWidth="0.8" strokeOpacity="0.3" className="lp-detection-ping-circle" style={{ animationDelay: '0.8s' }} />
              </g>

              {/* Purple Intelligence Nodes */}
              <circle cx="340" cy="355" r="3.5" fill="#8588e6" className="lp-node-glow" />
              <circle cx="520" cy="425" r="3" fill="#6366f1" className="lp-node-glow-alt" />
              <circle cx="780" cy="340" r="4" fill="#8588e6" className="lp-node-glow" />

              {/* Minimal Coordinate Crosshairs */}
              <g stroke="rgba(133,136,230,0.3)" strokeWidth="0.8">
                <path d="M 772 340 h 16 M 780 332 v 16" />
                <path d="M 332 355 h 16 M 340 347 v 16" />
                <path d="M 972 245 h 16 M 980 237 v 16" />
              </g>
            </svg>
          </div>

          <div className="wrap">
            <div className="lp-problem-header lp-reveal">
              <div className="lp-eyebrow">The problem</div>
              <h2 className="lp-section-h2">Running your store<br />is hard enough.</h2>
              <p className="lp-section-sub">
                You shouldn't have to wonder which orders are real.
              </p>
            </div>

            <div className="lp-problem-layout">
              {/* left — 4 pain points */}
              <div className="lp-problem-items">
                {[
                  {
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
                    title: 'Fake Orders',
                    desc: 'Orders that look real but leave you with the bill and nothing to show for it.',
                    delay: 'lp-reveal-d1',
                  },
                  {
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
                    title: 'Wasted Time',
                    desc: 'Hours spent checking orders one by one, pulling you away from running your store.',
                    delay: 'lp-reveal-d2',
                  },
                  {
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
                    title: 'Good Customers Blocked',
                    desc: 'Too many rules can turn away real buyers and hurt your sales.',
                    delay: 'lp-reveal-d3',
                  },
                  {
                    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
                    title: 'Uncertainty',
                    desc: "An alert shouldn't leave you wondering what to do next.",
                    delay: 'lp-reveal-d4',
                  },
                ].map(item => (
                  <div className={`lp-problem-item lp-reveal ${item.delay}`} key={item.title}>
                    <div className="lp-problem-icon-wrap" aria-hidden="true">{item.icon}</div>
                    <div className="lp-problem-text">
                      <h3>{item.title}</h3>
                      <p>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* right — live orders flow visual */}
              <div className="lp-reveal lp-reveal-d2">
                <OrdersFlowVisual />
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            HOW ZENO WORKS (DOCKER-STYLE DEVELOPER WORKFLOW)
        ══════════════════════════════════════════════════════════════ */}
        <section className="lp-hiw" id="how-it-works" aria-label="How Zeno works">
          <div className="wrap">
            <div className="lp-hiw-header lp-reveal">
              <div className="lp-eyebrow">How it works</div>
              <h2 className="lp-section-h2">Accelerate how you detect,<br />analyze, and stop bad orders</h2>
              <p className="lp-section-sub">
                From checkout webhook to explainable risk mitigation in under 50ms — simple for merchants, powerful under the hood.
              </p>
            </div>

            <DockerHowItWorks />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            PRODUCT SHOWCASE
        ══════════════════════════════════════════════════════════════ */}
        <section className="lp-product" aria-label="Product showcase">
          <div className="wrap">
            <div className="lp-product-layout">

              <div className="lp-product-copy lp-reveal">
                <div className="lp-eyebrow">The dashboard</div>
                <h2>Know what's happening<br />in your store.</h2>
                <p>
                  One simple view of the orders that matter.
                  At a glance you see what's safe, what to check,
                  and what's been stopped.
                </p>
                <div className="lp-product-checks">
                  {[
                    "Today's safe, review, and blocked orders",
                    'See who is buying and why Zeno flagged an order',
                    'A short list of orders that need your attention',
                    'No confusing charts — just clear answers',
                  ].map(c => (
                    <div className="lp-product-check" key={c}>
                      <div className="lp-product-check-icon">✓</div>
                      {c}
                    </div>
                  ))}
                </div>
              </div>

              <div className="lp-reveal lp-reveal-d1">
                <DashboardMockup />
              </div>

            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            EXPLAINABLE DECISIONS
        ══════════════════════════════════════════════════════════════ */}
        <section className="lp-explain" aria-label="Explainable decisions">
          <div className="wrap">
            <div className="lp-explain-layout">

              <div className="lp-reveal lp-reveal-d1">
                <ReasonCard />
              </div>

              <div className="lp-explain-copy lp-reveal">
                <div className="lp-eyebrow">Clear answers</div>
                <h2>Don't just get an alert.<br />Know why.</h2>
                <p>
                  When Zeno flags an order, it tells you exactly what
                  to look at — in plain language, not confusing numbers.
                </p>
                <div className="lp-explain-tagline">
                  "Is the shipping address different from the billing address?
                  Is this a new customer placing an unusually large order?
                  Zeno points it out so you can check before you ship."
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            BENTO FEATURES (LIGHT SECTION)
        ══════════════════════════════════════════════════════════════ */}
        <section className="lp-features" id="features" aria-label="Features">
          {/* Grand Zeno purple orbital system, 3D gradient sphere & flowing data streams behind bento grid */}
          <div className="lp-decor-features" aria-hidden="true">
            <svg width="100%" height="100%" viewBox="0 0 1200 680" fill="none" preserveAspectRatio="xMidYMid slice">
              <defs>
                {/* Diagonal curved purple light beam */}
                <linearGradient id="lp-feat-beam-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8588e6" stopOpacity="0" />
                  <stop offset="25%" stopColor="#a5a8f4" stopOpacity="0.24" />
                  <stop offset="60%" stopColor="#6366f1" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#4338ca" stopOpacity="0" />
                </linearGradient>
                <filter id="lp-feat-beam-blur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="30" />
                </filter>

                {/* 3D-like translucent gradient sphere */}
                <radialGradient id="lp-feat-sphere-grad" cx="38%" cy="32%" r="62%">
                  <stop offset="0%" stopColor="#e0e7ff" stopOpacity="0.45" />
                  <stop offset="25%" stopColor="#c7d2fe" stopOpacity="0.3" />
                  <stop offset="60%" stopColor="#818cf8" stopOpacity="0.14" />
                  <stop offset="85%" stopColor="#6366f1" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                </radialGradient>
                <filter id="lp-feat-sphere-blur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="16" />
                </filter>

                {/* Flowing animated stream gradients */}
                <linearGradient id="lp-feat-stream-1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.05" />
                  <stop offset="30%" stopColor="#8588e6" stopOpacity="0.55" />
                  <stop offset="70%" stopColor="#c7d2fe" stopOpacity="0.65" />
                  <stop offset="100%" stopColor="#8588e6" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="lp-feat-stream-2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8588e6" stopOpacity="0.05" />
                  <stop offset="50%" stopColor="#a5a8f4" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {/* Wide ambient angled purple light beam */}
              <path
                d="M -120 60 Q 420 190 1320 380"
                stroke="url(#lp-feat-beam-grad)"
                strokeWidth="130"
                strokeLinecap="round"
                filter="url(#lp-feat-beam-blur)"
                className="lp-beam-anim"
              />

              {/* 3D translucent gradient sphere sitting behind center/right cards */}
              <circle cx="820" cy="190" r="165" fill="url(#lp-feat-sphere-grad)" filter="url(#lp-feat-sphere-blur)" />
              <ellipse cx="775" cy="145" rx="55" ry="38" fill="rgba(255,255,255,0.42)" filter="url(#lp-feat-sphere-blur)" />

              {/* Grand Multi-Tier Orbital System */}
              {/* Outer rotating orbit ring with data node & crosshair */}
              <g className="lp-orbit-slow-1" style={{ transformOrigin: '820px 190px' }}>
                <ellipse cx="820" cy="190" rx="480" ry="180" stroke="rgba(133,136,230,0.2)" strokeWidth="1.2" strokeDasharray="7 9" transform="rotate(-15 820 190)" />
                <circle cx="340" cy="190" r="3.5" fill="#8588e6" className="lp-node-glow" />
                <path d="M 332 190 h 16 M 340 182 v 16" stroke="rgba(133,136,230,0.38)" strokeWidth="0.8" />
                <circle cx="1300" cy="190" r="3" fill="#a5a8f4" className="lp-node-glow-alt" />
              </g>

              {/* Mid counter-rotating orbit ring with telemetry ticks */}
              <g className="lp-orbit-slow-2" style={{ transformOrigin: '820px 190px' }}>
                <ellipse cx="820" cy="190" rx="320" ry="120" stroke="rgba(99,102,241,0.22)" strokeWidth="1.1" strokeDasharray="4 6" transform="rotate(22 820 190)" />
                <circle cx="1140" cy="190" r="3" fill="#6366f1" className="lp-node-glow" />
                <circle cx="500" cy="190" r="2.5" fill="#8588e6" className="lp-node-glow-alt" />
              </g>

              {/* Inner stationary orbit ellipse */}
              <ellipse cx="820" cy="190" rx="200" ry="75" stroke="rgba(133,136,230,0.18)" strokeWidth="1" strokeDasharray="14 6" />

              {/* Flowing animated data streams weaving across bento cards */}
              <path
                d="M -40 170 C 260 270, 520 100, 820 190 S 1120 110, 1260 210"
                stroke="url(#lp-feat-stream-1)"
                strokeWidth="2.2"
                strokeDasharray="14 18"
                className="lp-stream-pulse-fast"
              />
              <path
                d="M 40 570 Q 400 420 740 540 T 1250 450"
                stroke="url(#lp-feat-stream-2)"
                strokeWidth="1.8"
                strokeDasharray="10 16"
                className="lp-stream-pulse-rev"
              />

              {/* Subtle vertical coordinate link lines */}
              <path d="M 280 30 L 280 650" stroke="rgba(133,136,230,0.08)" strokeWidth="1" strokeDasharray="4 8" />
              <path d="M 980 50 L 980 660" stroke="rgba(133,136,230,0.08)" strokeWidth="1" strokeDasharray="4 8" />

              {/* Geometric coordinate crosshairs */}
              <g opacity="0.85">
                <path d="M 68 77 h 14 M 75 70 v 14" stroke="rgba(133,136,230,0.35)" strokeWidth="0.8" />
                <path d="M 948 102 h 14 M 955 95 v 14" stroke="rgba(133,136,230,0.35)" strokeWidth="0.8" />
                <path d="M 98 607 h 14 M 105 600 v 14" stroke="rgba(133,136,230,0.32)" strokeWidth="0.8" />
              </g>

              {/* Luminous verification node with active radar ping circle */}
              <circle cx="740" cy="540" r="14" fill="none" stroke="rgba(99,102,241,0.4)" strokeWidth="1" className="lp-detection-ping-circle" />
              <circle cx="740" cy="540" r="3.5" fill="#6366f1" className="lp-node-glow" />
            </svg>
          </div>

          <div className="wrap">
            <div className="lp-features-header lp-reveal">
              <div className="lp-eyebrow">Features</div>
              <h2 className="lp-section-h2">Everything you need.<br />Nothing confusing.</h2>
            </div>

            <div className="lp-bento lp-reveal lp-reveal-d1">

              {/* Cell A — Check orders instantly (wide) */}
              <div className="lp-bento-cell lp-bento-a">
                <div className="lp-bento-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8588e6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                </div>
                <h3>Check Orders Instantly</h3>
                <p>Know whether an order looks safe before you ship it.</p>
                <div className="lp-mini-order-list">
                  <div className="lp-mini-order-row">
                    <span>Order #1060 · $149</span>
                    <div className="lp-badge lp-badge-safe" style={{fontSize:'10px',padding:'3px 8px'}}>SAFE ✓</div>
                  </div>
                  <div className="lp-mini-order-row">
                    <span>Order #1061 · $1,299</span>
                    <div className="lp-badge lp-badge-review" style={{fontSize:'10px',padding:'3px 8px'}}>REVIEW</div>
                  </div>
                  <div className="lp-mini-order-row">
                    <span>Order #1062 · $89</span>
                    <div className="lp-badge lp-badge-safe" style={{fontSize:'10px',padding:'3px 8px'}}>SAFE ✓</div>
                  </div>
                </div>
              </div>

              {/* Cell B — Clear answers */}
              <div className="lp-bento-cell lp-bento-b">
                <div className="lp-bento-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8588e6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <h3>Clear Answers</h3>
                <p>No confusing scores. Just simple recommendations you can act on immediately.</p>
              </div>

              {/* Cell C — Know your customers */}
              <div className="lp-bento-cell lp-bento-c">
                <div className="lp-bento-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8588e6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <h3>Know Your Customers</h3>
                <p>See who's buying and whether they've ordered from you before.</p>
              </div>

              {/* Cell D — Spot repeat problems */}
              <div className="lp-bento-cell lp-bento-d">
                <div className="lp-bento-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8588e6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                </div>
                <h3>Spot Repeat Problems</h3>
                <p>Zeno remembers suspicious activity so you don't have to.</p>
                <div className="lp-memory-dots" aria-hidden="true">
                  {[
                    '#f87171','#f87171','#fbbf24',
                    '#fbbf24','#f87171','#4ade80',
                    '#4ade80','#4ade80','#fbbf24',
                    '#f87171',
                  ].map((c, i) => (
                    <div key={i} className="lp-memory-dot" style={{background:c, opacity: 0.7}} />
                  ))}
                </div>
              </div>

              {/* Cell E — Short review list */}
              <div className="lp-bento-cell lp-bento-e">
                <div className="lp-bento-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8588e6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </div>
                <h3>A Short Review List</h3>
                <p>See the few orders that actually need your attention — not hundreds of false alarms.</p>
              </div>

              {/* Cell F — Data protection */}
              <div className="lp-bento-cell lp-bento-f">
                <div className="lp-bento-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8588e6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <h3>Keep Customer Data Safe</h3>
                <p>Your store's information stays protected. We never share it.</p>
              </div>

            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            BEFORE / AFTER (COMPARISON - DARK)
        ══════════════════════════════════════════════════════════════ */}
        <section className="lp-results" id="difference" aria-label="What changes with Zeno">
          <div className="wrap">
            <div className="lp-results-header lp-reveal">
              <div className="lp-eyebrow">The difference</div>
              <h2 className="lp-section-h2">What changes<br />with Zeno</h2>
            </div>

            <div className="lp-ba-grid lp-reveal lp-reveal-d1">

              <div className="lp-ba-card lp-ba-before">
                <div className="lp-ba-header">
                  <span>✗</span>
                  Without Zeno
                </div>
                <div className="lp-ba-list">
                  {[
                    'Hours spent checking orders one by one',
                    'No way to tell real orders from fake ones',
                    'Suspicious orders slip through unnoticed',
                    'Good customers accidentally blocked',
                    'Confusing alerts with no explanation',
                  ].map(item => (
                    <div className="lp-ba-item" key={item}>
                      <span className="lp-ba-item-icon">✗</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="lp-ba-card lp-ba-after">
                <div className="lp-ba-header">
                  <span>✓</span>
                  With Zeno
                </div>
                <div className="lp-ba-list">
                  {[
                    'Clear recommendations on every order',
                    'Spend less time manually checking',
                    'Suspicious orders caught before you ship',
                    'More confidence, fewer wrong calls',
                    'Plain-language explanations for every flag',
                  ].map(item => (
                    <div className="lp-ba-item" key={item}>
                      <span className="lp-ba-item-icon">✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            TESTIMONIALS (LIGHT SECTION)
        ══════════════════════════════════════════════════════════════ */}
        <section className="lp-testi" id="testimonials" aria-label="Testimonials">
          {/* Dimensional Zeno purple atmosphere: giant translucent lavender orb, orbital rings, and trust telemetry */}
          <div className="lp-decor-testi" aria-hidden="true">
            <svg width="100%" height="100%" viewBox="0 0 1200 580" fill="none" preserveAspectRatio="xMidYMid slice">
              <defs>
                {/* Giant translucent lavender orb gradient */}
                <radialGradient id="lp-testi-orb-grad" cx="35%" cy="30%" r="65%">
                  <stop offset="0%" stopColor="#e0e7ff" stopOpacity="0.5" />
                  <stop offset="30%" stopColor="#c7d2fe" stopOpacity="0.3" />
                  <stop offset="65%" stopColor="#818cf8" stopOpacity="0.12" />
                  <stop offset="85%" stopColor="#6366f1" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                </radialGradient>
                <filter id="lp-testi-orb-blur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="24" />
                </filter>

                {/* Sweeping stream gradient */}
                <linearGradient id="lp-testi-stream-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8588e6" stopOpacity="0.05" />
                  <stop offset="45%" stopColor="#a5a8f4" stopOpacity="0.45" />
                  <stop offset="75%" stopColor="#6366f1" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#8588e6" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {/* Giant dimensional translucent lavender orb partially off-screen at top right */}
              <circle cx="1020" cy="50" r="270" fill="url(#lp-testi-orb-grad)" filter="url(#lp-testi-orb-blur)" />
              <ellipse cx="970" cy="10" rx="90" ry="60" fill="rgba(255,255,255,0.45)" filter="url(#lp-testi-orb-blur)" />

              {/* Multi-tier delicate orbital rings wrapping around the sphere */}
              <g className="lp-orbit-slow-1" style={{ transformOrigin: '1020px 50px' }}>
                <ellipse cx="1020" cy="50" rx="540" ry="210" stroke="rgba(133,136,230,0.18)" strokeWidth="1.2" strokeDasharray="7 10" transform="rotate(-18 1020 50)" />
                <circle cx="520" cy="130" r="3.5" fill="#8588e6" className="lp-node-glow" />
                <path d="M 512 130 h 16 M 520 122 v 16" stroke="rgba(133,136,230,0.32)" strokeWidth="0.8" />
              </g>

              <g className="lp-orbit-slow-2" style={{ transformOrigin: '1020px 50px' }}>
                <ellipse cx="1020" cy="50" rx="380" ry="145" stroke="rgba(99,102,241,0.16)" strokeWidth="1" strokeDasharray="4 7" transform="rotate(16 1020 50)" />
                <circle cx="730" cy="165" r="3" fill="#6366f1" className="lp-node-glow-alt" />
              </g>

              {/* Inner crisp stationary ring */}
              <ellipse cx="1020" cy="50" rx="220" ry="85" stroke="rgba(133,136,230,0.14)" strokeWidth="1" strokeDasharray="10 6" />

              {/* Geometric Zeno brand prism motif watermark on the left */}
              <g opacity="0.85" transform="translate(140, 160)">
                <polygon points="50,0 100,30 100,90 50,120 0,90 0,30" stroke="rgba(133,136,230,0.16)" strokeWidth="1.2" fill="rgba(133,136,230,0.025)" strokeDasharray="6 4" />
                <polygon points="50,20 85,40 85,80 50,100 15,80 15,40" stroke="rgba(99,102,241,0.12)" strokeWidth="1" fill="none" />
                <line x1="50" y1="0" x2="50" y2="120" stroke="rgba(133,136,230,0.14)" strokeWidth="0.8" />
                <line x1="0" y1="30" x2="100" y2="90" stroke="rgba(133,136,230,0.12)" strokeWidth="0.8" />
                <line x1="0" y1="90" x2="100" y2="30" stroke="rgba(133,136,230,0.12)" strokeWidth="0.8" />
                <circle cx="50" cy="60" r="3.5" fill="#8588e6" className="lp-node-glow" />
              </g>

              {/* Sweeping lower animated data stream */}
              <path
                d="M -60 440 Q 320 330 680 450 T 1280 370"
                stroke="url(#lp-testi-stream-grad)"
                strokeWidth="1.8"
                strokeDasharray="12 18"
                className="lp-stream-pulse"
              />

              {/* Ambient focal crosshairs and nodes */}
              <g opacity="0.8">
                <path d="M 868 317 h 14 M 875 310 v 14" stroke="rgba(133,136,230,0.32)" strokeWidth="0.8" />

                <circle cx="210" cy="190" r="2.5" fill="#a5a8f4" className="lp-node-glow" />
                <circle cx="680" cy="450" r="3" fill="#6366f1" className="lp-node-glow-alt" />
              </g>
            </svg>
          </div>

          <div className="wrap">
            <div className="lp-testi-header lp-reveal">
              <div className="lp-eyebrow">Merchants</div>
              <h2 className="lp-section-h2">Merchants sleep better<br />with Zeno.</h2>
              <p className="lp-section-sub">
                Because they know someone is watching the orders.
              </p>
            </div>

            <div className="lp-testi-grid">
              {[
                {
                  quote: 'I used to spend hours checking suspicious orders. Now Zeno tells me which ones actually need my attention. I get that time back every single day.',
                  name: 'Priya Sharma',
                  store: 'Boutique Owner',
                  color: '#8588e6',
                  delay: 'lp-reveal-d1',
                },
                {
                  quote: "We were losing money to bad orders without even realising it. Zeno started catching them straight away. The explanation it gives is what I love most — I finally understand why.",
                  name: 'Marcus Obi',
                  store: 'Electronics Retailer',
                  color: '#4ade80',
                  delay: 'lp-reveal-d2',
                },
                {
                  quote: "The best part is how simple it is. I'm not a tech person at all. I just see a green, yellow, or red on each order. That's all I need.",
                  name: 'Li Wei',
                  store: 'Apparel Brand',
                  color: '#fbbf24',
                  delay: 'lp-reveal-d3',
                },
              ].map(t => (
                <div className={`lp-testi-card lp-reveal ${t.delay}`} key={t.name}>
                  <div className="lp-testi-quote" aria-hidden="true">"</div>
                  <p className="lp-testi-text">{t.quote}</p>
                  <div className="lp-testi-author">
                    <div
                      className="lp-testi-avatar"
                      style={{background:t.color}}
                      aria-hidden="true"
                    >
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <span className="lp-testi-name">{t.name}</span>
                      <span className="lp-testi-store">{t.store}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECURITY
        ══════════════════════════════════════════════════════════════ */}
        <section className="lp-security" id="security" aria-label="Security">
          <div className="wrap lp-security-inner">

            <div className="lp-security-copy lp-reveal">
              <div className="lp-eyebrow">Security</div>
              <h2>Your store deserves<br />serious protection.</h2>
              <p>
                Zeno keeps your information protected while quietly
                watching over your orders — every hour of every day.
              </p>
              <div className="lp-sec-items">
                {[
                  {
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
                    title: 'Everything is kept safe',
                    desc: 'Your store data and customer information are protected at all times.',
                  },
                  {
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
                    title: 'Your data is yours',
                    desc: 'We never sell or share your information. Ever.',
                  },
                  {
                    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
                    title: 'Always watching',
                    desc: 'Zeno monitors your orders around the clock, even when you sleep.',
                  },
                ].map(item => (
                  <div className="lp-sec-item" key={item.title}>
                    <div className="lp-sec-item-icon" aria-hidden="true">{item.icon}</div>
                    <div className="lp-sec-item-text">
                      <h4>{item.title}</h4>
                      <p>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:'28px',display:'flex',flexDirection:'column',gap:'10px'}}>
                {['Protected','Monitoring active','Your data stays private'].map(label => (
                  <div key={label} style={{display:'flex',alignItems:'center',gap:'10px',fontSize:'13px',color:'rgba(232,234,240,0.5)',fontWeight:500}}>
                    <div style={{width:'18px',height:'18px',borderRadius:'50%',background:'rgba(74,222,128,0.15)',border:'1px solid rgba(74,222,128,0.3)',display:'flex',alignItems:'center',justifyContent:'center',color:'#4ade80',fontSize:'9px',fontWeight:800,flexShrink:0}}>✓</div>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="lp-reveal lp-reveal-d2">
              <SecurityOrb />
            </div>

          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            FINAL CTA
        ══════════════════════════════════════════════════════════════ */}
        <section className="lp-cta" aria-label="Get started">
          <div className="wrap">
            <div className="lp-cta-inner lp-reveal">
              <div className="lp-cta-orb-wrap" aria-hidden="true">
                <div className="lp-cta-orb" />
              </div>
              <div className="lp-cta-content">
                <div className="lp-eyebrow" style={{justifyContent:'center'}}>Get started</div>
                <h2>Spend less time worrying<br />about orders.</h2>
                <p>
                  Let Zeno watch the risk while you focus on
                  growing your store.
                </p>
                <div className="lp-cta-actions">
                  <Link to="/register" className="lp-btn-hero-primary">
                    Start Protecting My Store <ArrowRight size={16} />
                  </Link>
                  <Link to="/login" className="lp-btn-hero-secondary">
                    Log In
                  </Link>
                </div>
                <p className="lp-cta-reassurance">Quick setup. No technical skills needed.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            FOOTER
        ══════════════════════════════════════════════════════════════ */}
        <footer className="lp-footer" aria-label="Footer">
          <div className="wrap">
            <div className="lp-footer-inner">

              {/* ── Left: brand + nav + legal ── */}
              <div className="lp-footer-left">
                <div className="lp-footer-brand">
                  <ZenoLogo height={24} forceVariant={logoVariant} />
                  ZENO
                </div>
                <nav className="lp-footer-nav" aria-label="Footer navigation">
                  <a href="#how-it-works">How It Works</a>
                  <a href="#features">Features</a>
                  <a href="#testimonials">Testimonials</a>
                  <a href="#security">Security</a>
                  <Link to="/login">Log In</Link>
                  <Link to="/register" style={{color:'#8588e6',fontWeight:600}}>Get Started</Link>
                </nav>
                <div className="lp-footer-legal">
                  <a href="#">Privacy Policy</a>
                  <span className="lp-footer-dot">·</span>
                  <a href="#">Terms of Service</a>
                </div>
                <p className="lp-footer-copy">
                  © {new Date().getFullYear()} Zeno.
                  <span className="lp-footer-dot">·</span>
                  Protecting merchants worldwide.
                </p>
              </div>

              {/* ── Right: Connect card ── */}
              <div className="lp-footer-connect">
                <div className="lp-footer-connect-title">Connect</div>

                <div className="lp-footer-social-row">
                  {/* GitHub */}
                  <a
                    href="https://github.com/Rayan-Mohammed-Rafeeq"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lp-footer-social-btn"
                    aria-label="GitHub"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.021C22 6.484 17.522 2 12 2z"/>
                    </svg>
                    GitHub
                  </a>

                  {/* LinkedIn */}
                  <a
                    href="https://www.linkedin.com/in/rayan-mohammed-rafeeq"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lp-footer-social-btn"
                    aria-label="LinkedIn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    LinkedIn
                  </a>
                </div>

                {/* Profile card */}
                <div className="lp-footer-profile">
                  <img
                    src="/pic.png"
                    alt="Rayan Mohammed Rafeeq"
                    className="lp-footer-avatar"
                  />
                  <div className="lp-footer-profile-info">
                    <span className="lp-footer-profile-name">Rayan Mohammed Rafeeq</span>
                    <span className="lp-footer-profile-role">Developer</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </footer>

        </div>{/* end lp-page-body */}

      </div>
    </>
  );
}
