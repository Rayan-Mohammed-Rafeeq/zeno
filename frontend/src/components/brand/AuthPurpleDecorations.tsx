/**
 * AuthPurpleDecorations
 * ----------------------------------------------------
 * High-tech cybernetic purple visual designs for the right-hand
 * authentication panel of Login and Register pages:
 * - Multi-layer ambient purple aurora blooms with smooth breathing animation
 * - Subtle cyber matrix grid with radial fade mask
 * - Concentric orbital radar ring with animated orbiting satellite node
 * - Neural constellation data mesh with glowing vertex nodes
 * - Floating telemetry indicators
 */
export function AuthPurpleDecorations() {
  return (
    <div className="zeno-purple-decor-root" aria-hidden="true">
      {/* ── Dynamic Ambient Aurora Glows ── */}
      <div className="zeno-aurora-bloom zeno-aurora-1" />
      <div className="zeno-aurora-bloom zeno-aurora-2" />
      <div className="zeno-aurora-bloom zeno-aurora-3" />

      {/* ── Cybernetic Matrix Grid Overlay ── */}
      <div className="zeno-auth-grid" />

      {/* ── Top-Right Orbital Radar Vector Accent ── */}
      <div className="zeno-auth-vector-top">
        <svg
          width="380"
          height="380"
          viewBox="0 0 380 380"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="purpleGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9333ea" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#7c3aed" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.12" />
            </linearGradient>
            <linearGradient id="purpleGradRing" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#9333ea" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#c084fc" stopOpacity="0.3" />
            </linearGradient>
            <filter id="purpleGlow1" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <radialGradient id="purpleRadialCore" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#9333ea" stopOpacity="0.14" />
              <stop offset="60%" stopColor="#7c3aed" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Core radial glow */}
          <circle cx="270" cy="110" r="140" fill="url(#purpleRadialCore)" />

          {/* Concentric orbital rings */}
          <circle cx="270" cy="110" r="155" stroke="#9333ea" strokeWidth="1" strokeOpacity="0.22" strokeDasharray="3 8" />
          <circle cx="270" cy="110" r="120" stroke="url(#purpleGradRing)" strokeWidth="1.2" strokeOpacity="0.45" strokeDasharray="6 8" />
          <circle cx="270" cy="110" r="82" stroke="url(#purpleGrad1)" strokeWidth="1.5" strokeOpacity="0.6" />
          <circle cx="270" cy="110" r="45" stroke="#7c3aed" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="2 4" />
          <circle cx="270" cy="110" r="4" fill="#9333ea" filter="url(#purpleGlow1)" />

          {/* Crosshair coordinate axes */}
          <line x1="90" y1="110" x2="350" y2="110" stroke="#7c3aed" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="4 4" />
          <line x1="270" y1="0" x2="270" y2="270" stroke="#7c3aed" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="4 4" />

          {/* Radar ticks */}
          <path d="M 270 20 L 270 30 M 270 190 L 270 200 M 180 110 L 190 110 M 350 110 L 360 110" stroke="#7c3aed" strokeWidth="1.5" strokeOpacity="0.55" />

          {/* Outer angled decorative brackets */}
          <path d="M 200 40 L 215 25 L 235 25" stroke="#9333ea" strokeWidth="1.2" strokeOpacity="0.4" fill="none" />
          <path d="M 330 170 L 345 185 L 345 205" stroke="#9333ea" strokeWidth="1.2" strokeOpacity="0.4" fill="none" />

          {/* Orbiting satellite node 1 */}
          <g className="zeno-orbit-spinner" style={{ transformOrigin: '270px 110px' }}>
            <circle cx="270" cy="28" r="3.5" fill="#a855f7" filter="url(#purpleGlow1)" />
            <circle cx="270" cy="28" r="7.5" stroke="#9333ea" strokeWidth="1" strokeOpacity="0.6" />
          </g>

          {/* Orbiting satellite node 2 (counter-orbiting) */}
          <g className="zeno-orbit-spinner-rev" style={{ transformOrigin: '270px 110px' }}>
            <circle cx="188" cy="110" r="2.5" fill="#6366f1" filter="url(#purpleGlow1)" />
          </g>
        </svg>
      </div>

      {/* ── Bottom-Left Neural Constellation Vector Accent ── */}
      <div className="zeno-auth-vector-bottom">
        <svg
          width="360"
          height="360"
          viewBox="0 0 360 360"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="purpleMeshLine" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#7c3aed" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.25" />
            </linearGradient>
            <radialGradient id="purpleMeshGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#9333ea" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ambient glow */}
          <circle cx="100" cy="260" r="130" fill="url(#purpleMeshGlow)" />

          {/* Neural network connection lines */}
          <line x1="30" y1="290" x2="90" y2="230" stroke="url(#purpleMeshLine)" strokeWidth="1.2" strokeDasharray="3 3" />
          <line x1="90" y1="230" x2="165" y2="260" stroke="url(#purpleMeshLine)" strokeWidth="1.2" />
          <line x1="90" y1="230" x2="80" y2="150" stroke="url(#purpleMeshLine)" strokeWidth="1" />
          <line x1="165" y1="260" x2="235" y2="210" stroke="url(#purpleMeshLine)" strokeWidth="1.2" />
          <line x1="80" y1="150" x2="170" y2="170" stroke="url(#purpleMeshLine)" strokeWidth="1" strokeDasharray="2 4" />
          <line x1="170" y1="170" x2="235" y2="210" stroke="url(#purpleMeshLine)" strokeWidth="1" />
          <line x1="165" y1="260" x2="195" y2="330" stroke="url(#purpleMeshLine)" strokeWidth="1.2" strokeDasharray="4 4" />
          <line x1="235" y1="210" x2="310" y2="235" stroke="url(#purpleMeshLine)" strokeWidth="1" />

          {/* Hex / Triangle background faint polygon */}
          <polygon
            points="90,230 170,170 235,210 165,260"
            fill="#a855f7"
            fillOpacity="0.04"
            stroke="#a855f7"
            strokeWidth="0.8"
            strokeOpacity="0.18"
          />

          {/* Nodes with glowing halos */}
          <circle cx="30" cy="290" r="3" fill="#6366f1" fillOpacity="0.7" />
          <circle cx="90" cy="230" r="4.5" fill="#7c3aed" filter="url(#purpleGlow1)" />
          <circle cx="165" cy="260" r="3" fill="#9333ea" />
          <circle cx="80" cy="150" r="2.5" fill="#6366f1" />
          <circle cx="170" cy="170" r="3.5" fill="#7c3aed" filter="url(#purpleGlow1)" />
          <circle cx="235" cy="210" r="4" fill="#a855f7" filter="url(#purpleGlow1)" />
          <circle cx="195" cy="330" r="3" fill="#6366f1" fillOpacity="0.8" />
          <circle cx="310" cy="235" r="2.5" fill="#9333ea" fillOpacity="0.65" />

          {/* Cyber Corner Marks */}
          <path d="M 20 325 L 20 345 L 40 345" stroke="#9333ea" strokeWidth="1.5" strokeOpacity="0.55" fill="none" />
          <path d="M 330 330 L 350 330 L 350 310" stroke="#9333ea" strokeWidth="1.5" strokeOpacity="0.45" fill="none" />
        </svg>
      </div>
    </div>
  );
}
