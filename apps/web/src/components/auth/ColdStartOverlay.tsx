import { useState, useEffect } from 'react';
import { Zap, Clock, Sparkles, ChevronRight } from 'lucide-react';

interface ColdStartOverlayProps {
  isOpen: boolean;
  actionText?: string;
}

const FUN_STATUS_MESSAGES = [
  { icon: '🚀', text: 'Spinning up container instances on Render…' },
  { icon: '☕', text: 'Brewing fresh espresso for the backend server…' },
  { icon: '🔌', text: 'Establishing secure database connection pools…' },
  { icon: '⚡', text: 'Warming up serverless caches & routing tables…' },
  { icon: '🧠', text: 'Calibrating ZENO intelligence & refill engines…' },
  { icon: '🛰️', text: 'Syncing telemetry & queue processors…' },
  { icon: '🧊', text: 'Thawing out dormant free-tier compute layers…' },
  { icon: '✨', text: 'Almost there! Preparing your secure session…' },
];

const FUN_TIPS = [
  '⚡ Rest of requests are immediate: once awake, every action takes <150ms!',
  '🌍 Free-tier servers automatically sleep when idle to conserve energy.',
  '☕ Perfect time for a quick sip of coffee or a mindful stretch!',
  '🚀 You only wait once per session — subsequent page loads are lightning fast.',
  '🔒 End-to-end encryption handshake is being completed in the background.',
  '💡 No need to refresh! This page will sign you in the instant it wakes up.',
];

const OVERLAY_STYLES = `
  @keyframes cso-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes cso-spin-reverse {
    from { transform: rotate(360deg); }
    to { transform: rotate(0deg); }
  }
  @keyframes cso-pulse-glow {
    0%, 100% { opacity: 0.35; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.12); }
  }
  @keyframes cso-float-particle {
    0% { transform: translateY(0px) scale(0.8); opacity: 0; }
    50% { opacity: 0.8; }
    100% { transform: translateY(-70px) scale(1.2); opacity: 0; }
  }
  @keyframes cso-shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  @keyframes cso-fade-in {
    from { opacity: 0; transform: translateY(12px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes cso-badge-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }

  .cso-root {
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: radial-gradient(circle at 50% 30%, rgba(30, 24, 66, 0.94) 0%, rgba(10, 12, 26, 0.98) 100%);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    animation: cso-fade-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    overflow-y: auto;
    font-family: inherit;
    color: #f1f3fd;
  }

  .cso-bg-glow {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(80px);
    z-index: 0;
  }
  .cso-bg-glow-1 {
    width: 420px;
    height: 420px;
    background: rgba(124, 58, 237, 0.22);
    top: 20%;
    left: 50%;
    transform: translate(-50%, -30%);
    animation: cso-pulse-glow 5s ease-in-out infinite alternate;
  }
  .cso-bg-glow-2 {
    width: 320px;
    height: 320px;
    background: rgba(99, 102, 241, 0.16);
    bottom: 10%;
    right: 25%;
  }

  /* Floating particles */
  .cso-particle {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    background: radial-gradient(circle, #c084fc 0%, rgba(147, 51, 234, 0) 70%);
  }

  .cso-modal {
    position: relative;
    z-index: 1;
    width: min(100%, 520px);
    background: rgba(18, 20, 39, 0.88);
    border: 1px solid rgba(168, 85, 247, 0.28);
    box-shadow: 
      0 24px 64px -8px rgba(0, 0, 0, 0.75),
      0 0 0 1px rgba(255, 255, 255, 0.05),
      0 0 50px -10px rgba(139, 92, 246, 0.22);
    border-radius: 28px;
    padding: 34px 32px 30px;
    text-align: center;
    overflow: hidden;
  }

  .cso-modal::before {
    content: '';
    position: absolute;
    top: 0;
    left: 15%;
    right: 15%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(192, 132, 252, 0.8), transparent);
  }

  /* Mark / Animation Centerpiece */
  .cso-anim-stage {
    position: relative;
    width: 110px;
    height: 110px;
    margin: 0 auto 22px;
    display: grid;
    place-items: center;
  }

  .cso-ambient-pulse {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(168, 85, 247, 0.35) 0%, transparent 70%);
    animation: cso-pulse-glow 3s ease-in-out infinite;
  }

  .cso-ring-outer {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px dashed rgba(168, 85, 247, 0.45);
    animation: cso-spin 18s linear infinite;
  }

  .cso-ring-orbit {
    position: absolute;
    inset: 6px;
    border-radius: 50%;
    border: 2.5px solid transparent;
    border-top-color: #a855f7;
    border-right-color: #6366f1;
    animation: cso-spin 1.8s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite;
  }

  .cso-ring-inner {
    position: absolute;
    inset: 16px;
    border-radius: 50%;
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    border-bottom-color: #38bdf8;
    animation: cso-spin-reverse 3s linear infinite;
  }

  .cso-orbit-dot {
    position: absolute;
    top: -4px;
    left: 50%;
    margin-left: -5px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #c084fc;
    box-shadow: 0 0 10px #c084fc, 0 0 20px #9333ea;
  }

  .cso-center-logo {
    position: relative;
    z-index: 2;
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(8px);
    box-shadow: inset 0 0 12px rgba(168, 85, 247, 0.25);
  }
  .cso-center-logo img {
    height: 32px;
    width: auto;
    filter: drop-shadow(0 2px 8px rgba(168, 85, 247, 0.5));
  }

  /* Status badge & title */
  .cso-header-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 100px;
    background: rgba(168, 85, 247, 0.12);
    border: 1px solid rgba(168, 85, 247, 0.3);
    font-size: 0.78rem;
    font-weight: 600;
    color: #e9d5ff;
    letter-spacing: 0.03em;
    margin-bottom: 12px;
  }
  .cso-header-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #34d399;
    box-shadow: 0 0 8px #34d399;
    animation: cso-badge-pulse 1.8s ease-in-out infinite;
  }

  .cso-title {
    margin: 0;
    font-size: 1.55rem;
    font-weight: 800;
    letter-spacing: -0.025em;
    background: linear-gradient(135deg, #ffffff 40%, #c4b5fd 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  /* Entertaining status ticker */
  .cso-ticker-wrap {
    margin: 10px 0 18px;
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 0.94rem;
    font-weight: 500;
    color: #c4b5fd;
    transition: all 0.3s ease;
  }
  .cso-ticker-icon {
    font-size: 1.1rem;
    animation: cso-badge-pulse 2s infinite ease-in-out;
  }

  /* Highlight Callout Box (The key requirement) */
  .cso-highlight-box {
    margin: 18px 0 20px;
    padding: 16px 18px;
    background: linear-gradient(135deg, rgba(30, 27, 75, 0.65) 0%, rgba(19, 21, 48, 0.85) 100%);
    border: 1.5px solid rgba(139, 92, 246, 0.35);
    border-radius: 18px;
    text-align: left;
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
  }

  .cso-highlight-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .cso-highlight-row + .cso-highlight-row {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px dashed rgba(168, 85, 247, 0.2);
  }

  .cso-icon-badge {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .cso-icon-badge-amber {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.35);
    color: #fbbf24;
  }
  .cso-icon-badge-green {
    background: rgba(16, 185, 129, 0.18);
    border: 1px solid rgba(16, 185, 129, 0.45);
    color: #34d399;
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.2);
  }

  .cso-row-content {
    flex: 1;
  }
  .cso-row-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
  }
  .cso-row-title {
    font-size: 0.86rem;
    font-weight: 700;
    color: #ffffff;
  }
  .cso-row-tag {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 6px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .cso-tag-first {
    background: rgba(245, 158, 11, 0.2);
    color: #fde68a;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
  .cso-tag-immediate {
    background: rgba(16, 185, 129, 0.22);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.4);
    animation: cso-badge-pulse 2.2s infinite ease-in-out;
  }

  .cso-row-desc {
    font-size: 0.80rem;
    color: #a5b4fc;
    line-height: 1.45;
    margin: 0;
  }
  .cso-row-desc strong {
    color: #ffffff;
  }

  /* Progress bar */
  .cso-progress-track {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 100px;
    overflow: hidden;
    position: relative;
    margin: 18px 0 14px;
  }
  .cso-progress-bar {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(90deg, #7c3aed, #ec4899, #38bdf8, #7c3aed);
    background-size: 200% 100%;
    animation: cso-shimmer 2.2s linear infinite;
  }

  /* Footer meta & tips */
  .cso-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.76rem;
    color: #94a3b8;
    margin-bottom: 14px;
  }
  .cso-timer {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-variant-numeric: tabular-nums;
    color: #cbd5e1;
    font-weight: 600;
  }

  .cso-tip-card {
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.78rem;
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
  }
  .cso-tip-card:hover {
    background: rgba(168, 85, 247, 0.08);
    border-color: rgba(168, 85, 247, 0.25);
  }
  .cso-tip-content {
    display: flex;
    align-items: center;
    gap: 6px;
    text-align: left;
    line-height: 1.35;
  }

  @media (max-width: 520px) {
    .cso-modal {
      padding: 24px 20px 22px;
      border-radius: 20px;
    }
    .cso-title {
      font-size: 1.35rem;
    }
    .cso-highlight-box {
      padding: 14px 14px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cso-ring-outer, .cso-ring-orbit, .cso-ring-inner, .cso-progress-bar, .cso-bg-glow-1 {
      animation: none !important;
    }
  }
`;

export function ColdStartOverlay({ isOpen, actionText = 'Signing you in…' }: ColdStartOverlayProps) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);

  // Timer counter
  useEffect(() => {
    if (!isOpen) {
      setSecondsElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      setSecondsElapsed(s => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Fun status message rotator (every 3.8 seconds)
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setStatusIdx(i => (i + 1) % FUN_STATUS_MESSAGES.length);
    }, 3800);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Tips rotator (every 6.5 seconds)
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setTipIdx(i => (i + 1) % FUN_TIPS.length);
    }, 6500);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentStatus = FUN_STATUS_MESSAGES[statusIdx];
  const minutes = Math.floor(secondsElapsed / 60);
  const seconds = secondsElapsed % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <>
      <style>{OVERLAY_STYLES}</style>
      <div className="cso-root" role="status" aria-live="polite" aria-label="Waking up backend">
        {/* Ambient atmospheric lighting */}
        <div className="cso-bg-glow cso-bg-glow-1" />
        <div className="cso-bg-glow cso-bg-glow-2" />

        <div className="cso-modal">
          {/* Top category badge */}
          <div className="cso-header-pill">
            <span className="cso-header-dot" />
            <span>Render Free Tier · Cold Start Boot</span>
          </div>

          {/* Central entertaining animation centerpiece */}
          <div className="cso-anim-stage" aria-hidden="true">
            <div className="cso-ambient-pulse" />
            <div className="cso-ring-outer" />
            <div className="cso-ring-orbit">
              <span className="cso-orbit-dot" />
            </div>
            <div className="cso-ring-inner" />
            <div className="cso-center-logo">
              <img src="/dark-logo.svg" alt="ZENO" />
            </div>
          </div>

          {/* Main title */}
          <h2 className="cso-title">Waking up the backend…</h2>

          {/* Entertaining dynamic status ticker */}
          <div className="cso-ticker-wrap">
            <span className="cso-ticker-icon">{currentStatus.icon}</span>
            <span>{currentStatus.text}</span>
          </div>

          {/* ══════════════════════════════════════════════════════
              HIGH-IMPACT HIGHLIGHT CARD:
              Explicitly contrasts initial boot (~1-2m) vs subsequent requests (instant!)
             ══════════════════════════════════════════════════════ */}
          <div className="cso-highlight-box">
            {/* Initial cold start */}
            <div className="cso-highlight-row">
              <div className="cso-icon-badge cso-icon-badge-amber">
                <Clock size={16} />
              </div>
              <div className="cso-row-content">
                <div className="cso-row-header">
                  <span className="cso-row-title">First Request Only</span>
                  <span className="cso-row-tag cso-tag-first">Takes ~1–2 mins</span>
                </div>
                <p className="cso-row-desc">
                  Inactive instances spin down to conserve cloud resources. The server is warming up right now.
                </p>
              </div>
            </div>

            {/* Subsequent requests are immediate */}
            <div className="cso-highlight-row">
              <div className="cso-icon-badge cso-icon-badge-green">
                <Zap size={16} />
              </div>
              <div className="cso-row-content">
                <div className="cso-row-header">
                  <span className="cso-row-title">Subsequent Requests</span>
                  <span className="cso-row-tag cso-tag-immediate">Immediate ⚡</span>
                </div>
                <p className="cso-row-desc">
                  <strong>Rest of all requests are instant!</strong> Once awake, all dashboards, refill routes, and clicks respond in milliseconds.
                </p>
              </div>
            </div>
          </div>

          {/* Animated infinite cyber progress bar */}
          <div className="cso-progress-track">
            <div className="cso-progress-bar" />
          </div>

          {/* Live timer & reassurance */}
          <div className="cso-meta-row">
            <span className="cso-timer">
              <Clock size={12} />
              <span>Elapsed: {formattedTime}</span>
            </span>
            <span>{actionText} Please keep tab open</span>
          </div>

          {/* Entertaining interactive tip box (clickable to advance) */}
          <div 
            className="cso-tip-card" 
            title="Click to see next fact"
            onClick={() => setTipIdx(i => (i + 1) % FUN_TIPS.length)}
          >
            <div className="cso-tip-content">
              <Sparkles size={14} style={{ color: '#c084fc', flexShrink: 0 }} />
              <span>{FUN_TIPS[tipIdx]}</span>
            </div>
            <ChevronRight size={13} style={{ opacity: 0.6, flexShrink: 0 }} />
          </div>
        </div>
      </div>
    </>
  );
}
