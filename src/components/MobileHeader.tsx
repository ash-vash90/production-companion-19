import React from 'react';
import { Menu, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { ThemeToggle } from '@/components/ThemeToggle';
import { RhosonicsLogo } from '@/components/RhosonicsLogo';

interface MobileHeaderProps {
  onSearchClick: () => void;
}

export function MobileHeader({ onSearchClick }: MobileHeaderProps) {
  const { toggleSidebar, openMobile } = useSidebar();

  return (
    <header className="sticky top-0 z-50 flex lg:hidden h-14 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={toggleSidebar}
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <RhosonicsLogo size={20} />
          <span className="font-display text-sm whitespace-nowrap">
            Rhosonics <span className="font-medium">PMS</span>
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={onSearchClick}
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </Button>
        <ThemeToggle />
        <NotificationCenter />
      </div>
    </header>
  );
}
