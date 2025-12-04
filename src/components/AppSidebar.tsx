import { LayoutDashboard, Package, Settings, CalendarDays, BarChart3, Users, FileText, ClipboardList, Search } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { UserProfile } from '@/components/sidebar/UserProfile';
import { RhosonicsLogo } from '@/components/RhosonicsLogo';

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const { state } = useSidebar();
  
  const isCollapsed = state === 'collapsed';

  const productionItems = [
    { title: t('dashboard'), url: '/', icon: LayoutDashboard },
    { title: t('workOrders'), url: '/work-orders', icon: Package },
    { title: t('productionCalendar'), url: '/calendar', icon: CalendarDays },
  ];

  const qualityItems = [
    { title: t('qualityCertificates'), url: '/quality-certificates', icon: FileText },
    { title: t('productionReports'), url: '/production-reports', icon: ClipboardList },
    { title: t('traceability'), url: '/genealogy', icon: Search },
  ];

  const adminItems = [
    { title: t('analytics'), url: '/analytics', icon: BarChart3 },
    { title: t('roleManagement'), url: '/role-management', icon: Users },
    { title: t('settingsPage'), url: '/settings', icon: Settings },
  ];

  const isActive = (url: string) => location.pathname === url;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-3 p-2">
          <RhosonicsLogo size={32} className="shrink-0" />
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-display text-base text-sidebar-foreground leading-tight">Rhosonics</span>
              <span className="font-display text-lg text-sidebar-foreground tracking-wide font-medium">PMS</span>
            </div>
          )}
        </div>
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
              tooltip={isCollapsed ? (language === 'en' ? 'NL' : 'EN') : undefined}
            >
              <span className="font-data text-xs uppercase tracking-wider">
                {language === 'en' ? '🇬🇧' : '🇳🇱'}
              </span>
              {!isCollapsed && (
                <span className="text-xs">
                  {language === 'en' ? 'English' : 'Nederlands'}
                </span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <UserProfile />
      </SidebarFooter>
    </Sidebar>
  );
}
