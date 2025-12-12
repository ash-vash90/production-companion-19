import React, { useState } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MobileHeader } from '@/components/MobileHeader';
import { SearchModal } from '@/components/SearchModal';
import { GlobalSearch } from '@/components/GlobalSearch';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex flex-col">
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
            <div className="mx-auto w-full max-w-6xl">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
      
      {/* Search Modal - works on all screen sizes */}
      <SearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </SidebarProvider>
  );
};

export default Layout;
