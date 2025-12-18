import React from 'react';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PrimaryActionProps {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  /** Full width on mobile (default: true) */
  fullWidthMobile?: boolean;
}

/**
 * Primary Page Action - Layer 3 of the 4-layer layout system
 * Purpose: The single most important action on this page.
 * 
 * Rules:
 * - Exactly one primary action per page
 * - Placed below page title
 * - Full-width on mobile OR floating FAB
 * - Not in header, not next to filters
 */
export function PrimaryAction({ 
  label, 
  icon: Icon, 
  onClick, 
  disabled = false,
  loading = false,
  className,
  fullWidthMobile = true 
}: PrimaryActionProps) {
  return (
    <div className={cn("mb-3 sm:mb-4", className)}>
      <Button 
        onClick={onClick}
        disabled={disabled || loading}
        className={cn(
          "h-11 sm:h-10",
          fullWidthMobile && "w-full sm:w-auto"
        )}
      >
        {Icon && <Icon className="h-4 w-4 mr-2" />}
        {label}
      </Button>
    </div>
  );
}
