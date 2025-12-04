import { LayoutDashboard, Package, Settings, Factory, CalendarDays, BarChart3, Users, FileText, ClipboardList, GitBranch } from 'lucide-react';
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
    { title: t('genealogy'), url: '/genealogy', icon: GitBranch },
  ];

  const adminItems = [
    { title: t('analytics'), url: '/analytics', icon: BarChart3 },
    { title: t('roleManagement'), url: '/role-management', icon: Users },
    { title: t('settingsPage'), url: '/settings', icon: Settings },
  ];

  const isActive = (url: string) => location.pathname === url;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 p-2">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-sm shrink-0">
            <Factory className="h-5 w-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-logo text-base text-foreground lowercase leading-tight">rhosonics</span>
              <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">PMS</span>
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
