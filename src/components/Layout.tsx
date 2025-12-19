import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarInset, useSidebar } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MobileHeader } from '@/components/MobileHeader';
import { SearchModal } from '@/components/SearchModal';
import { GlobalSearch } from '@/components/GlobalSearch';
import { useHapticFeedback, useTouchDevice } from '@/hooks/useTouchDevice';

interface LayoutProps {
  children: React.ReactNode;
}

// Visual indicator for swipe hint on left edge - fades out after delay
const SwipeHintIndicator: React.FC<{ visible: boolean }> = ({ visible }) => {
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      setFading(false);
      
      // Start fading after 3 seconds
      const fadeTimer = setTimeout(() => setFading(true), 3000);
      // Hide completely after fade animation (500ms)
      const hideTimer = setTimeout(() => setShow(false), 3500);
      
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    } else {
      setShow(false);
      setFading(false);
    }
  }, [visible]);

  if (!show) return null;
  
  return (
    <div 
      className={`fixed left-0 top-0 bottom-0 w-1 z-50 pointer-events-none md:hidden transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
      aria-hidden="true"
    >
      <div className="h-full w-full bg-gradient-to-r from-primary/30 to-transparent animate-pulse" />
    </div>
  );
};

const LayoutContent: React.FC<LayoutProps> = ({ children }) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const { setOpenMobile, openMobile, isMobile, open, setOpen } = useSidebar();
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const haptic = useHapticFeedback();
  const isTouch = useTouchDevice();

  // Add touch listeners to detect swipes on touch devices (mobile + tablet)
  useEffect(() => {
    if (!isTouch) return;

    const edgeThreshold = 30; // pixels from left edge to trigger open
    const swipeThreshold = 50; // minimum swipe distance
    const maxVerticalMovement = 100; // prevent diagonal swipes

    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const deltaX = endX - touchStartRef.current.x;
      const deltaY = Math.abs(endY - touchStartRef.current.y);
      const duration = Date.now() - touchStartRef.current.time;
      
      // Only process quick swipes (under 500ms) that are mostly horizontal
      if (duration > 500 || deltaY > maxVerticalMovement) {
        touchStartRef.current = null;
        return;
      }

      // Determine if sidebar is currently open (mobile uses openMobile, desktop/tablet uses open)
      const sidebarIsOpen = isMobile ? openMobile : !open;

      // Swipe right from left edge to OPEN
      if (!sidebarIsOpen && touchStartRef.current.x < edgeThreshold && deltaX > swipeThreshold) {
        haptic.lightTap();
        if (isMobile) {
          setOpenMobile(true);
        } else {
          setOpen(true);
        }
      }
      
      // Swipe left to CLOSE (when sidebar is open)
      if (sidebarIsOpen && deltaX < -swipeThreshold) {
        haptic.lightTap();
        if (isMobile) {
          setOpenMobile(false);
        } else {
          setOpen(false);
        }
      }

      touchStartRef.current = null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isTouch, isMobile, openMobile, setOpenMobile, open, setOpen, haptic]);

  return (
    <>
      {/* Swipe hint indicator - only visible on touch devices when sidebar is closed */}
      <SwipeHintIndicator visible={isTouch && (isMobile ? !openMobile : !open)} />

      <div className="flex min-h-screen w-full bg-background overflow-x-hidden">
        <AppSidebar />
        <SidebarInset className="flex flex-col overflow-x-hidden">
          {/* Mobile Header - visible on mobile/tablet */}
          <MobileHeader />

          {/* Desktop Header - hidden on mobile only, visible on tablet+ */}
          <header className="sticky top-0 z-40 hidden md:flex h-14 shrink-0 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex flex-1 items-center justify-center px-3 max-w-2xl mx-auto">
              {location.pathname !== '/work-orders' && (
                <GlobalSearch onOpenModal={() => setSearchOpen(true)} />
              )}
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
