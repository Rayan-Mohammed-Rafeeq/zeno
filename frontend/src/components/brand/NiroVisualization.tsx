/**
 * NiroVisualization
 * ------------------
 * Premium CSS/SVG hero illustration for the NIRO login page.
 * Real NIRO logo inlined inside the central orb.
 * Pure ambient animation only — no mouse interaction.
 */

import { useState, useEffect } from 'react';

interface Props {
  isDark: boolean;
  className?: string;
}

let _uid = 0;
const nextUid = () => `nv${++_uid}`;

const P = {
  dark: {
    orbCore:      '#7b7fe0',
    orbCoreInner: '#a5a8f4',
    orbRing1:     'rgba(133,136,230,0.35)',
    orbRing2:     'rgba(133,136,230,0.14)',
    orbGlow:      'rgba(133,136,230,0.55)',
    platform:     'rgba(133,136,230,0.18)',
    platformEdge: 'rgba(133,136,230,0.45)',
    nodeBaseFar:  '#1a1c3e',
    nodeBaseNear: '#2a2d5a',
    nodeEdge:     'rgba(133,136,230,0.55)',
    nodeGlowFill: 'rgba(133,136,230,0.22)',
    nodeIcon:     '#a5a8f4',
    trail:        'rgba(133,136,230,0.55)',
    trailFade:    'rgba(133,136,230,0)',
    particle:     'rgba(165,168,244,0.7)',
    shadow:       'rgba(0,0,0,0.5)',
    spinRing:     'rgba(133,136,230,0.45)',
    platformBody: 'rgba(25,27,55,0.8)',
    orbRimStroke: 'rgba(200,202,255,0.35)',
  },
  light: {
    orbCore:      '#6b68d4',
    orbCoreInner: '#8486e2',
    orbRing1:     'rgba(107,104,212,0.28)',
    orbRing2:     'rgba(107,104,212,0.10)',
    orbGlow:      'rgba(107,104,212,0.35)',
    platform:     'rgba(107,104,212,0.12)',
    platformEdge: 'rgba(107,104,212,0.38)',
    nodeBaseFar:  '#ece9fb',
    nodeBaseNear: '#ffffff',
    nodeEdge:     'rgba(107,104,212,0.40)',
    nodeGlowFill: 'rgba(107,104,212,0.12)',
    nodeIcon:     '#6b68d4',
    trail:        'rgba(107,104,212,0.45)',
    trailFade:    'rgba(107,104,212,0)',
    particle:     'rgba(107,104,212,0.6)',
    shadow:       'rgba(100,100,200,0.18)',
    spinRing:     'rgba(107,104,212,0.38)',
    platformBody: 'rgba(210,205,240,0.7)',
    orbRimStroke: 'rgba(107,104,212,0.4)',
  },
};

type IconType = 'transaction' | 'account' | 'device' | 'payment' | 'location' | 'order' | 'shield';
interface NodeDef {
  id: string; cx: number; cy: number; r: number;
  icon: IconType; delay: number; floatAmp: number;
}

const NODES: NodeDef[] = [
  { id: 'n1', cx: 105,  cy: 112,  r: 36, icon: 'account',    delay: 0,   floatAmp: 7  },
  { id: 'n2', cx: 215,  cy: 58,   r: 32, icon: 'transaction', delay: 0.8, floatAmp: 9  },
  { id: 'n3', cx: 358,  cy: 84,   r: 34, icon: 'device',      delay: 1.6, floatAmp: 6  },
  { id: 'n4', cx: 432,  cy: 192,  r: 32, icon: 'order',       delay: 0.4, floatAmp: 8  },
  { id: 'n5', cx: 70,   cy: 252,  r: 33, icon: 'location',    delay: 1.2, floatAmp: 10 },
  { id: 'n6', cx: 158,  cy: 346,  r: 34, icon: 'payment',     delay: 2.0, floatAmp: 7  },
  { id: 'n7', cx: 402,  cy: 332,  r: 30, icon: 'shield',      delay: 2.4, floatAmp: 9  },
];

/* Icon SVG src mapped to each node */
const NODE_ICON_SRC: Record<IconType, string> = {
  account:     '/profile-users.svg',
  transaction: '/network.svg',
  device:      '/devices.svg',
  payment:     '/wallet.svg',
  location:    '/store.svg',
  order:       '/orders.svg',
  shield:      '/shield.svg',
};

const ORB = { cx: 285, cy: 290, r: 44 };

function trailPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len, ny = dx / len;
  return `M ${x1} ${y1} Q ${mx + nx * len * 0.25} ${my + ny * len * 0.25} ${x2} ${y2}`;
}

const PARTICLES = [
  { cx: 195, cy: 145, r: 2.2, delay: 0,   pdx:  4, pdy: -4 },
  { cx: 320, cy: 135, r: 1.8, delay: 1.1, pdx: -3, pdy:  5 },
  { cx: 155, cy: 205, r: 2.5, delay: 2.3, pdx:  5, pdy: -3 },
  { cx: 380, cy: 260, r: 1.6, delay: 0.7, pdx: -4, pdy:  4 },
  { cx: 240, cy: 360, r: 2.0, delay: 1.8, pdx:  3, pdy: -5 },
  { cx: 135, cy: 310, r: 1.5, delay: 3.0, pdx: -5, pdy:  3 },
  { cx: 340, cy: 185, r: 1.9, delay: 0.3, pdx:  4, pdy: -4 },
  { cx: 415, cy: 145, r: 1.4, delay: 2.1, pdx: -3, pdy:  5 },
  { cx: 95,  cy: 185, r: 2.1, delay: 1.5, pdx:  5, pdy: -3 },
  { cx: 275, cy: 180, r: 1.3, delay: 2.8, pdx: -4, pdy:  4 },
];

/* NIRO logo paths normalised from light-logo.svg
   group transform translate(-224.84719,-158.875) removed.
   Light logo: dark navy N-slash (#171d32) + deep purple bars (#5e5ac2)
   — used always inside the orb so it reads clearly on the purple sphere. */
const LOGO_SLASH =
  'M 1.92061 7.2435 Q 1.92061 0 10.4379 0 L 99.1593 64.6737 ' +
  'Q 104.8375 68.8128 104.8375 74.5041 L 104.8375 114.8605 ' +
  'Q 104.8375 122.104 96.3202 115.8952 L 7.599 51.2215 ' +
  'Q 1.92061 47.0824 1.92061 41.3921 Z';
// ellipse: cx=234.466-224.847=9.619, cy=251.373-158.875=92.498
const LOGO_EL   = { cx: 9.619,  cy: 92.498, rx: 9.619, ry: 9.928 };
// rects: subtract translate offsets
const LOGO_BARS = [
  { x: 2.238,  y: 111.237, w: 16,     h: 57.993,  rx: 8    }, // 227.085-224.847, 270.113-158.875
  { x: 25.241, y: 79.475,  w: 22.808, h: 111.185, rx: 11.4 }, // 250.089-224.847, 238.350-158.875
  { x: 55.672, y: 105.045, w: 17.238, h: 68,      rx: 8.62 }, // 280.519-224.847, 263.920-158.875
  { x: 79.913, y: 122.808, w: 16,     h: 33.955,  rx: 8    }, // 304.760-224.847, 281.683-158.875
];

export function NiroVisualization({ isDark, className = '' }: Props) {
  const c = isDark ? P.dark : P.light;
  const [uid] = useState<string>(() => nextUid());
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const styleId = `${uid}-kf`;
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @media (prefers-reduced-motion: no-preference) {
        .${uid}-float    { animation: ${uid}-float    linear      infinite alternate; }
        .${uid}-pulse    { animation: ${uid}-pulse    ease-in-out infinite; }
        .${uid}-trail    { animation: ${uid}-dash     linear      infinite; }
        .${uid}-particle { animation: ${uid}-drift    ease-in-out infinite alternate; }
        .${uid}-spin     { animation: ${uid}-spin     linear      infinite; }
        .${uid}-spin-rev { animation: ${uid}-spin-rev linear      infinite; }
      }
      @keyframes ${uid}-float {
        from { transform: translateY(0px); }
        to   { transform: translateY(var(--amp, -8px)); }
      }
      @keyframes ${uid}-pulse {
        0%,100% { opacity: 0.50; }
        50%     { opacity: 0.95; }
      }
      @keyframes ${uid}-dash {
        from { stroke-dashoffset: 0; }
        to   { stroke-dashoffset: -120; }
      }
      @keyframes ${uid}-drift {
        from { transform: translate(0px, 0px); }
        to   { transform: translate(var(--pdx, 4px), var(--pdy,-4px)); }
      }
      @keyframes ${uid}-spin {
        from { transform: rotate(0deg);   }
        to   { transform: rotate(360deg); }
      }
      @keyframes ${uid}-spin-rev {
        from { transform: rotate(0deg);    }
        to   { transform: rotate(-360deg); }
      }
      @keyframes ${uid}-pop {
        0%   { transform: scale(1)    filter: brightness(1);   }
        40%  { transform: scale(1.22) filter: brightness(1.15); }
        70%  { transform: scale(1.18) filter: brightness(1.12); }
        100% { transform: scale(1.2)  filter: brightness(1.12); }
      }
      @keyframes ${uid}-popout {
        0%   { transform: scale(1.2); }
        100% { transform: scale(1);   }
      }
      .${uid}-node-hov {
        animation: ${uid}-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        cursor: pointer;
        filter: drop-shadow(0 4px 12px rgba(133,136,230,0.55)) brightness(1.12);
      }
      .${uid}-node-idle {
        animation: ${uid}-popout 0.3s ease forwards;
        cursor: default;
      }
    `;    document.head.appendChild(style);
    return () => { document.getElementById(styleId)?.remove(); };
  }, [uid]);

  const ids = {
    orb:   `${uid}-orb`,
    plat:  `${uid}-plat`,
    node:  `${uid}-node`,
    clip:  `${uid}-clip`,
    fBlur: `${uid}-fblur`,
    fGlow: `${uid}-fglow`,
    trail: (i: number) => `${uid}-tg${i}`,
  };

  const LOGO_H    = 190.66, LOGO_W = 104.84;
  const logoScale = (ORB.r * 1.55) / LOGO_H;
  const logoTx    = ORB.cx - (LOGO_W * logoScale) / 2 + 4;
  const logoTy    = ORB.cy - (LOGO_H * logoScale) / 2 + 2;

  return (
    <svg
      viewBox="-60 -40 620 520"
      className={className}
      aria-hidden="true"
      style={{ overflow: 'visible', width: '100%', height: '100%' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={ids.orb} cx="30%" cy="22%" r="75%">
          <stop offset="0%"   stopColor="#e8eaf0" />
          <stop offset="35%"  stopColor="#c8ccd8" />
          <stop offset="70%"  stopColor="#9ba2b4" />
          <stop offset="100%" stopColor="#6e7588" />
        </radialGradient>

        <radialGradient id={ids.plat} cx="50%" cy="30%" r="60%">
          <stop offset="0%"   stopColor={c.platformEdge} />
          <stop offset="100%" stopColor={c.platform} stopOpacity="0" />
        </radialGradient>

        <radialGradient id={ids.node} cx="30%" cy="25%" r="75%">
          <stop offset="0%"   stopColor={c.nodeBaseNear} />
          <stop offset="100%" stopColor={c.nodeBaseFar}  />
        </radialGradient>

        <clipPath id={ids.clip}>
          <circle cx={ORB.cx} cy={ORB.cy} r={ORB.r - 1} />
        </clipPath>

        <filter id={ids.fBlur} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id={ids.fGlow} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {NODES.map((n, i) => (
          <linearGradient
            key={ids.trail(i)}
            id={ids.trail(i)}
            gradientUnits="userSpaceOnUse"
            x1={n.cx} y1={n.cy} x2={ORB.cx} y2={ORB.cy}
          >
            <stop offset="0%"   stopColor={c.trailFade} />
            <stop offset="55%"  stopColor={c.trail}     />
            <stop offset="100%" stopColor={c.orbCore}   />
          </linearGradient>
        ))}
      </defs>

      {/* Layer 1 — Data trails */}
      {NODES.map((n, i) => (
        <path
          key={`trail-${n.id}`}
          d={trailPath(n.cx, n.cy, ORB.cx, ORB.cy)}
          fill="none"
          stroke={`url(#${ids.trail(i)})`}
          strokeWidth={hovered === n.id ? 2.0 : (isDark ? 1.2 : 1.0)}
          strokeDasharray="8 6"
          strokeLinecap="round"
          opacity={hovered === n.id ? 1 : 0.7}
          className={`${uid}-trail`}
          style={{
            animationDuration: hovered === n.id ? '1.4s' : `${3.5 + i * 0.4}s`,
            animationDelay:    `${-n.delay}s`,
            transition:        'stroke-width 0.2s, opacity 0.2s',
          } as React.CSSProperties}
        />
      ))}

      {/* Layer 2 — Platform */}
      <ellipse
        cx={ORB.cx} cy={ORB.cy + ORB.r + 10}
        rx={ORB.r + 18} ry={16}
        fill={c.shadow} filter={`url(#${ids.fBlur})`} opacity={0.6}
      />
      <ellipse
        cx={ORB.cx} cy={ORB.cy + ORB.r - 4}
        rx={ORB.r + 22} ry={18}
        fill={`url(#${ids.plat})`} stroke={c.platformEdge} strokeWidth={1} opacity={0.9}
      />
      <ellipse
        cx={ORB.cx} cy={ORB.cy + ORB.r + 6}
        rx={ORB.r + 14} ry={12}
        fill={c.platformBody} stroke={c.platformEdge} strokeWidth={0.8}
      />

      {/* Layer 3 — Orb glow rings */}
      <circle cx={ORB.cx} cy={ORB.cy} r={ORB.r + 28}
        fill="none" stroke="rgba(180,185,200,0.18)" strokeWidth={1} opacity={0.5} />
      <circle cx={ORB.cx} cy={ORB.cy} r={ORB.r + 15}
        fill="rgba(200,205,220,0.12)" opacity={0.45}
        className={`${uid}-pulse`}
        style={{ animationDuration: '4s', transformOrigin: `${ORB.cx}px ${ORB.cy}px` } as React.CSSProperties}
      />

      {/* Layer 4 — Orb */}
      <circle cx={ORB.cx} cy={ORB.cy} r={ORB.r + 8}
        fill="rgba(180,185,205,0.22)" filter={`url(#${ids.fBlur})`} opacity={0.65}
        className={`${uid}-pulse`}
        style={{ animationDuration: '3.5s', transformOrigin: `${ORB.cx}px ${ORB.cy}px` } as React.CSSProperties}
      />
      <circle cx={ORB.cx} cy={ORB.cy} r={ORB.r} fill={`url(#${ids.orb})`} />

      {/* Real NIRO logo clipped inside orb — always light-logo colors */}
      <g clipPath={`url(#${ids.clip})`}>
        <g
          transform={`translate(${logoTx}, ${logoTy}) scale(${logoScale})`}
        >
          {/* N slash — navy, matches light logo */}
          <path
            d={LOGO_SLASH}
            fill="#171d32"
            style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.25))' }}
          />
          {/* Highlight stripe along the top-left edge of the N slash */}
          <path
            d={LOGO_SLASH}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="3"
            style={{ filter: 'blur(1.5px)' }}
          />
          {/* Ellipse dot */}
          <ellipse
            cx={LOGO_EL.cx} cy={LOGO_EL.cy}
            rx={LOGO_EL.rx} ry={LOGO_EL.ry}
            fill="#5e5ac2"
          />
          {/* Bar rects */}
          {LOGO_BARS.map((b, i) => (
            <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={b.rx} fill="#5e5ac2" />
          ))}
        </g>
      </g>

      {/* Rim stroke only — no blurred ellipse on the circle */}
      <circle cx={ORB.cx} cy={ORB.cy} r={ORB.r}
        fill="none" stroke="rgba(220,224,235,0.6)" strokeWidth={1.5} />

      {/* Layer 5 — Floating nodes */}
      {NODES.map((n) => {
        const size = n.r * 2;
        const isHov = hovered === n.id;
        const scale = isHov ? 1.22 : 1;
        // Scale from the node centre using SVG transform
        const tx = n.cx - n.cx * scale;
        const ty = n.cy - n.cy * scale;
        return (
          <g
            key={n.id}
            className={`${uid}-float`}
            style={{
              '--amp':           `-${n.floatAmp}px`,
              animationDuration: `${3.8 + n.floatAmp * 0.18}s`,
              animationDelay:    `${n.delay}s`,
              transformOrigin:   `${n.cx}px ${n.cy}px`,
            } as React.CSSProperties}
          >
            {/* Glow halo — always present, visible on hover */}
            <circle
              cx={n.cx} cy={n.cy}
              r={size * 0.58}
              fill={isDark ? 'rgba(133,136,230,0.18)' : 'rgba(94,91,193,0.12)'}
              style={{
                filter: 'blur(6px)',
                opacity: isHov ? 1 : 0,
                transition: 'opacity 0.2s ease',
              }}
            />
            {/* Icon image — scaled via SVG transform attribute */}
            <g transform={`translate(${tx}, ${ty}) scale(${scale})`}
               style={{ transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                        filter: isHov
                          ? `drop-shadow(0 4px 10px rgba(133,136,230,0.6)) brightness(1.15)`
                          : 'none',
               }}
            >
              <image
                href={NODE_ICON_SRC[n.icon]}
                x={n.cx - size * 0.5}
                y={n.cy - size * 0.5}
                width={size}
                height={size}
              />
            </g>
            {/* Invisible hit rect — reliable pointer-events surface */}
            <rect
              x={n.cx - size * 0.5}
              y={n.cy - size * 0.5}
              width={size}
              height={size}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
            />
          </g>
        );
      })}

      {/* Layer 6 — Particles */}
      {PARTICLES.map((p, i) => (
        <circle
          key={`p${i}`}
          cx={p.cx} cy={p.cy} r={p.r}
          fill={c.particle}
          className={`${uid}-particle`}
          style={{
            '--pdx':           `${p.pdx}px`,
            '--pdy':           `${p.pdy}px`,
            animationDuration: `${4 + i * 0.35}s`,
            animationDelay:    `${p.delay}s`,
            opacity:           isDark ? 0.65 : 0.5,
          } as React.CSSProperties}
        />
      ))}
    </svg>
  );
}
