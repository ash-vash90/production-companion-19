import React from 'react';
import { Menu, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

interface MobileHeaderProps {
  onSearchClick: () => void;
}

/**
 * Global App Header - Layer 1 of the 4-layer layout system
 *
 * Purpose: Navigation, identity, global utilities.
 *
 * Rules:
 * - Height: 56px (never taller)
 * - Position: sticky
 * - Content:
 *   - Left: Hamburger (always)
 *   - Right: Search + Notifications (always)
 * - White background with subtle shadow
 */
export function MobileHeader({ onSearchClick }: MobileHeaderProps) {
  const { toggleSidebar, isMobile } = useSidebar();

  // Only show on mobile (when sidebar is not visible by default)
  if (!isMobile) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between bg-background px-3 shadow-sm">
      {/* Left: Hamburger menu */}
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 text-foreground"
        onClick={toggleSidebar}
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Right: Search + Notifications */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-foreground"
          onClick={onSearchClick}
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </Button>
        <NotificationCenter />
      </div>
    </header>
  );
}
