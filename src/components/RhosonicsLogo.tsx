import React from 'react';

interface RhosonicsLogoProps {
  className?: string;
  size?: number;
}

export function RhosonicsLogo({ className, size = 24 }: RhosonicsLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#73B82E" />
          <stop offset="100%" stopColor="#33993c" />
        </linearGradient>
      </defs>
      {/* Arc 1 - innermost */}
      <path
        d="M 80 60 L 80 49 A 31 31 0 0 0 49 80 L 60 80 A 20 20 0 0 1 80 60 Z"
        fill="url(#brandGradient)"
      />
      {/* Arc 2 - middle */}
      <path
        d="M 80 41 L 80 30 A 50 50 0 0 0 30 80 L 41 80 A 39 39 0 0 1 80 41 Z"
        fill="url(#brandGradient)"
        opacity="0.93"
      />
      {/* Arc 3 - outermost */}
      <path
        d="M 80 22 L 80 11 A 69 69 0 0 0 11 80 L 22 80 A 58 58 0 0 1 80 22 Z"
        fill="url(#brandGradient)"
        opacity="0.86"
      />
    </svg>
  );
}
