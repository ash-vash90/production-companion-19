import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarInset, useSidebar } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MobileHeader } from '@/components/MobileHeader';
import { SearchModal } from '@/components/SearchModal';
import { GlobalSearch } from '@/components/GlobalSearch';
import { useSwipeGesture } from '@/hooks/useTouchDevice';

interface LayoutProps {
  children: React.ReactNode;
}

// Inner component that can use useSidebar
const LayoutContent: React.FC<LayoutProps> = ({ children }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();

  // Swipe from left edge to open sidebar
  const swipeHandlers = useSwipeGesture(
    {
      onSwipeRight: () => {
        if (isMobile) {
          setOpenMobile(true);
        }
      },
    },
    { threshold: 30, timeout: 500 }
  );

  // Add touch listeners to detect swipes starting from left edge
  useEffect(() => {
    if (!isMobile) return;

    let startX = 0;
    const edgeThreshold = 30; // pixels from left edge

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const deltaX = endX - startX;
      
      // Only trigger if started from left edge and swiped right
      if (startX < edgeThreshold && deltaX > 50) {
        setOpenMobile(true);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, setOpenMobile]);

  return (
    <>
      <div className="flex min-h-screen w-full bg-background overflow-x-hidden">
        <AppSidebar />
        <SidebarInset className="flex flex-col overflow-x-hidden">
          {/* Mobile Header - visible on mobile/tablet */}
          <MobileHeader onSearchClick={() => setSearchOpen(true)} />
          
          {/* Desktop Header - hidden on mobile only, visible on tablet+ */}
          <header className="sticky top-0 z-40 hidden md:flex h-14 shrink-0 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex flex-1 items-center justify-center px-3 max-w-2xl mx-auto">
              <GlobalSearch onOpenModal={() => setSearchOpen(true)} />
            </div>
            <div className="absolute right-0 flex items-center gap-1 px-3">
              <ThemeToggle />
              <NotificationCenter />
            </div>
          </header>
          
          <main className="flex-1 px-3 md:px-4 lg:px-6 py-3 md:py-4 lg:py-6 w-full overflow-x-hidden">
            <div key={location.pathname} className="mx-auto w-full max-w-7xl animate-page-enter">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
      
      {/* Search Modal - works on all screen sizes */}
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <SidebarProvider defaultOpen={true}>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
};

export default Layout;
