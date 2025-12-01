import { LayoutDashboard, Package, Settings, LogOut, Factory, CalendarDays, BarChart3, Users } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { state } = useSidebar();
  
  const isCollapsed = state === 'collapsed';

  const menuItems = [
    { 
      title: t('dashboard'), 
      url: '/', 
      icon: LayoutDashboard 
    },
    { 
      title: t('workOrders'), 
      url: '/work-orders', 
      icon: Package 
    },
  ];

  const adminItems = [
    { 
      title: t('analytics'), 
      url: '/analytics', 
      icon: BarChart3 
    },
    { 
      title: t('roleManagement'), 
      url: '/role-management', 
      icon: Users 
    },
    { 
      title: t('productionCalendar'), 
      url: '/calendar', 
      icon: CalendarDays 
    },
    { 
      title: t('settingsPage'), 
      url: '/settings', 
      icon: Settings 
    },
  ];

  const isActive = (url: string) => location.pathname === url;

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 p-2">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-sm shrink-0">
            <Factory className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <span className="font-logo text-lg text-foreground lowercase">rhosonics</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('mainMenu')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    onClick={() => navigate(item.url)}
                    tooltip={isCollapsed ? item.title : undefined}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>{t('administration')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={isActive(item.url)}
                    onClick={() => navigate(item.url)}
                    tooltip={isCollapsed ? item.title : undefined}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setLanguage(language === 'en' ? 'nl' : 'en')}
              tooltip={isCollapsed ? (language === 'en' ? 'NL' : 'EN') : undefined}
            >
              <span className="font-data text-xs uppercase tracking-wider">
                {language === 'en' ? '🇬🇧 EN' : '🇳🇱 NL'}
              </span>
              {!isCollapsed && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {language === 'en' ? 'Switch to Dutch' : 'Schakel naar Engels'}
                </span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip={isCollapsed ? t('logout') : undefined}
            >
              <LogOut className="h-4 w-4" />
              <span>{t('logout')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
