import React from 'react';
import { Menu, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { RhosonicsLogo } from '@/components/RhosonicsLogo';

interface MobileHeaderProps {
  /** If omitted, the search icon is hidden (and spacing is preserved). */
  onSearchClick?: () => void;
}

/**
 * Global App Header - Layer 1 of the 4-layer layout system
 *
 * Purpose: Navigation, identity, one global utility.
 *
 * Rules:
 * - Height: 56px (never taller)
 * - Position: sticky / fixed
 * - Content:
 *   - Left: Hamburger (always)
 *   - Center: Logo icon only (no "Rhosonics PMS" text on mobile)
 *   - Right: ONE icon (Search) — optional per page
 * - No page-specific actions here — ever
 */
export function MobileHeader({ onSearchClick }: MobileHeaderProps) {
  const { toggleSidebar, isMobile } = useSidebar();

  // Only show on mobile (when sidebar is not visible by default)
  if (!isMobile) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-3">
      {/* Left: Hamburger menu */}
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent"
        onClick={toggleSidebar}
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Center: Logo only */}
      <div className="flex items-center">
        <RhosonicsLogo size={24} />
      </div>

      {/* Right: Single utility icon (Search) */}
      {onSearchClick ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={onSearchClick}
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </Button>
      ) : (
        // Keep spacing so the logo stays centered
        <div className="h-10 w-10" aria-hidden="true" />
      )}
    </header>
  );
}