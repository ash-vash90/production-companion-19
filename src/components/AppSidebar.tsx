import { LayoutDashboard, Package, Settings, CalendarDays, BarChart3, Users, FileText, ClipboardList, PanelLeft, Globe } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
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
import { UserProfile } from '@/components/sidebar/UserProfile';
import { RhosonicsLogo } from '@/components/RhosonicsLogo';
import { Button } from '@/components/ui/button';

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const { isAdmin, loading } = useUserProfile();
  const { state, toggleSidebar } = useSidebar();
  
  const isCollapsed = state === 'collapsed';

  const productionItems = [
    { title: t('dashboard'), url: '/', icon: LayoutDashboard },
    { title: t('workOrders'), url: '/work-orders', icon: Package },
    { title: t('productionCalendar'), url: '/calendar', icon: CalendarDays },
  ];

  const qualityItems = [
    { title: t('qualityCertificates'), url: '/quality-certificates', icon: FileText },
    { title: t('productionReports'), url: '/production-reports', icon: ClipboardList },
  ];

  // Only show admin items if user is admin (and not still loading)
  const adminItems = [
    { title: t('analytics'), url: '/analytics', icon: BarChart3 },
    ...(isAdmin && !loading ? [
      { title: t('roleManagement'), url: '/role-management', icon: Users },
      { title: t('settingsPage'), url: '/settings', icon: Settings },
    ] : []),
  ];

  const isActive = (url: string) => location.pathname === url;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border bg-sidebar">
        <div className={`flex items-center ${isCollapsed ? 'justify-center p-3' : 'justify-between p-2'}`}>
          <div className={`flex items-center ${isCollapsed ? '' : 'gap-2'}`}>
            <RhosonicsLogo size={isCollapsed ? 24 : 28} className="shrink-0" />
            {!isCollapsed && (
              <span className="font-display text-sm text-sidebar-foreground whitespace-nowrap">
                Rhosonics <span className="font-medium">PMS</span>
              </span>
            )}
          </div>
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={toggleSidebar}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
        {isCollapsed && (
          <div className="flex justify-center pb-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={toggleSidebar}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('production')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {productionItems.map((item) => (
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
          <SidebarGroupLabel>{t('quality')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {qualityItems.map((item) => (
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
              tooltip={isCollapsed ? (language === 'en' ? 'Switch to NL' : 'Switch to EN') : undefined}
              className="group"
            >
              <Globe className="h-4 w-4" />
              {!isCollapsed && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-xs uppercase">
                    {language === 'en' ? 'EN' : 'NL'}
                  </span>
                  <span className="text-xs text-muted-foreground group-hover:text-sidebar-accent-foreground">
                    → {language === 'en' ? 'NL' : 'EN'}
                  </span>
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <UserProfile />
      </SidebarFooter>
    </Sidebar>
  );
}
