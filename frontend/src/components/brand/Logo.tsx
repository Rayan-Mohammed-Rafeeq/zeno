import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

interface LogoProps {
  forceVariant?: 'dark' | 'light';
  className?: string;
  /** Height in pixels — width scales proportionally (aspect 218.87 : 253.79) */
  height?: number;
}

const ASPECT = 218.87 / 253.79; // ≈ 0.863

/**
 * Full Niro logo SVG asset.
 * dark-logo.svg  → white geometry + lavender bars  → use on dark surfaces
 * light-logo.svg → navy geometry + deep-purple bars → use on light surfaces
 * Auto-picks based on resolved theme unless forceVariant is given.
 */
export function NiroLogo({ forceVariant, className, height = 40 }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const variant = forceVariant ?? resolvedTheme;
  const src = variant === 'dark' ? '/dark-logo.svg' : '/light-logo.svg';
  const width = Math.round(height * ASPECT);

  return (
    <img
      src={src}
      alt="Niro"
      width={width}
      height={height}
      className={cn('select-none shrink-0', className)}
      draggable={false}
    />
  );
}

/**
 * Icon-only mark — shows just the left portion of the logo SVG (the
 * geometric N shape + lavender bars) by overflow-clipping.
 * No favicon involved. Uses the same dark/light logo SVG as NiroLogo.
 */
export function NiroMark({
  forceVariant,
  size = 32,
  className,
}: {
  forceVariant?: 'dark' | 'light';
  size?: number;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const variant = forceVariant ?? resolvedTheme;
  const src = variant === 'dark' ? '/dark-logo.svg' : '/light-logo.svg';

  // The full SVG is ~219 wide × ~254 tall.
  // The mark (N shape + bars) lives roughly in the left 68% of the width.
  // We render the full image at a scale where height = size,
  // then clip to show only the leftmost portion (square crop ≈ size × size).
  const scale = 1.35;
  const renderedH = Math.round(size * scale);
  const renderedW = Math.round(renderedH * ASPECT);

  return (
    <div
      className={cn('shrink-0 overflow-hidden select-none', className)}
      style={{ width: size, height: size }}
      aria-label="Niro"
      role="img"
    >
      <img
        src={src}
        alt=""
        width={renderedW}
        height={renderedH}
        style={{
          // Shift left slightly so the mark is centred in the crop window
          marginLeft: `-${Math.round(renderedW * 0.04)}px`,
          marginTop:  `-${Math.round(renderedH * 0.02)}px`,
        }}
        className="select-none"
        draggable={false}
      />
    </div>
  );
}

/** Full lockup: mark + "NIRO" wordmark */
export function NiroWordmark({
  forceVariant,
  className,
  height = 36,
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  const variant = forceVariant ?? resolvedTheme;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <NiroLogo forceVariant={variant} height={height} />
      <span
        className={cn(
          'text-2xl font-bold tracking-widest select-none',
          variant === 'dark' ? 'text-white' : 'text-[#171d32]',
        )}
      >
        NIRO
      </span>
    </div>
  );
}
