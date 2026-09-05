import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

interface LogoProps {
  forceVariant?: 'dark' | 'light';
  className?: string;
  /** Height in pixels — width scales proportionally */
  height?: number;
}

// SVG viewBox: 0 0 104.83748 190.66043  →  aspect ≈ 0.5497 (width / height)
const ASPECT = 104.83748 / 190.66043; // ≈ 0.5497

/**
 * Full Zeno logo SVG asset.
 * dark-logo.svg  → white geometry + lavender bars  → use on dark surfaces
 * light-logo.svg → navy geometry + deep-purple bars → use on light surfaces
 * Auto-picks based on resolved theme unless forceVariant is given.
 */
export function ZenoLogo({ forceVariant, className, height = 40 }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const variant = forceVariant ?? resolvedTheme;
  const src = variant === 'dark' ? '/dark-logo.svg' : '/light-logo.svg';
  const width = Math.round(height * ASPECT);

  return (
    <img
      src={src}
      alt="Zeno"
      width={width}
      height={height}
      className={cn('select-none shrink-0', className)}
      draggable={false}
    />
  );
}

/**
 * Icon-only mark — renders the Zeno logo SVG as a small square icon.
 * The SVG is already just the mark (no text), so we render it directly
 * fitting within a square container.
 */
export function ZenoMark({
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

  // The SVG is portrait (~105 × 191). Fit it inside a square by constraining height.
  // Width will be narrower than size due to aspect ratio.
  const imgH = size;
  const imgW = Math.round(imgH * ASPECT);

  return (
    <div
      className={cn('shrink-0 flex items-center justify-center select-none', className)}
      style={{ width: size, height: size }}
      aria-label="Zeno"
      role="img"
    >
      <img
        src={src}
        alt=""
        width={imgW}
        height={imgH}
        className="select-none"
        draggable={false}
      />
    </div>
  );
}

/** Full lockup: mark + "ZENO" wordmark */
export function ZenoWordmark({
  forceVariant,
  className,
  height = 36,
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  const variant = forceVariant ?? resolvedTheme;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <ZenoLogo forceVariant={variant} height={height} />
      <span
        className={cn(
          'text-2xl font-bold tracking-widest select-none',
          variant === 'dark' ? 'text-white' : 'text-[#171d32]',
        )}
      >
        ZENO
      </span>
    </div>
  );
}
