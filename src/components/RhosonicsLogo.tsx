import { useId } from 'react';
import { cn } from '@/lib/utils';

interface RhosonicsLogoProps {
  variant?: 'gradient' | 'white' | 'dark';
  className?: string;
  animated?: boolean;
  size?: number;
}

/** Clean React useId() output for use in SVG IDs */
const cleanReactId = (id: string): string => id.replace(/:/g, '');

export function RhosonicsLogo({ variant = 'gradient', className, animated = false, size }: RhosonicsLogoProps) {
  const rawId = useId();
  const uid = cleanReactId(rawId);
  const brandGradientId = `brandGradient-${uid}`;
  const whiteGradientId = `whiteGradient-${uid}`;

  const getFill = () => {
    switch (variant) {
      case 'white':
        return `url(#${whiteGradientId})`;
      default:
        return `url(#${brandGradientId})`;
    }
  };

  return (
    <svg
      width={size}
      height={size}
      className={cn(!size && 'w-full h-full', className)}
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={brandGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7DC42E" />
          <stop offset="50%" stopColor="#4CAF50" />
          <stop offset="100%" stopColor="#2D8636" />
        </linearGradient>
        <linearGradient id={whiteGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f1f5f9" />
        </linearGradient>
      </defs>

      {/* Wave 1 - Propagation point (innermost, fills corner) */}
      <g className={cn(animated && 'animate-boot opacity-0')} style={{ transformOrigin: 'bottom right' }}>
        <path d="M 80 80 L 80 61 A 19 19 0 0 0 61 80 L 80 80 Z" fill={getFill()} />
      </g>

      {/* Wave 2 - Middle */}
      <g className={cn(animated && 'animate-boot delay-100 opacity-0')} style={{ transformOrigin: 'bottom right' }}>
        <path d="M 80 47 L 80 30 A 50 50 0 0 0 30 80 L 47 80 A 33 33 0 0 1 80 47 Z" fill={getFill()} />
      </g>

      {/* Wave 3 - Outermost */}
      <g className={cn(animated && 'animate-boot delay-200 opacity-0')} style={{ transformOrigin: 'bottom right' }}>
        <path d="M 80 15 L 80 0 A 80 80 0 0 0 0 80 L 15 80 A 65 65 0 0 1 80 15 Z" fill={getFill()} />
      </g>
    </svg>
  );
}

export default RhosonicsLogo;
