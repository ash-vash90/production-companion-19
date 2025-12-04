import React from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { ThemeToggle } from '@/components/ThemeToggle';
import { GlobalSearch } from '@/components/GlobalSearch';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-40 flex h-12 lg:h-14 shrink-0 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex flex-1 items-center justify-center px-3">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-1 px-3">
              <ThemeToggle />
              <NotificationCenter />
            </div>
          </header>
          <main className="flex-1 p-3 md:p-4 lg:p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
