import React from 'react';

interface PageIdentityProps {
  title: string;
  description?: string;
}

/**
 * Page Identity Block - Layer 2 of the 4-layer layout system
 * Purpose: Tell the user where they are, not what to do.
 * 
 * Rules:
 * - Appears below global header
 * - NO buttons in this block
 * - Subtitle optional (lighter color, smaller size)
 */
export function PageIdentity({ title, description }: PageIdentityProps) {
  return (
    <div className="space-y-0.5 sm:space-y-1 mb-3 sm:mb-4">
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h1>
      {description && (
        <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
