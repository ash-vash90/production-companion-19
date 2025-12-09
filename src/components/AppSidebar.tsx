import { LayoutDashboard, Package, Settings, CalendarDays, BarChart3, Users, FileText, ClipboardList, PanelLeft, Globe, Moon, Sun, Monitor, Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useTheme } from '@/hooks/useTheme';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const { isAdmin, canManageInventory, loading } = useUserProfile();
  const { theme, setTheme } = useTheme();
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

  // Items visible to users who can manage inventory (admin or supervisor)
  const inventoryItems = canManageInventory && !loading ? [
    { title: t('inventory'), url: '/inventory', icon: Warehouse },
  ] : [];

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
      <SidebarHeader className="border-b border-sidebar-border bg-sidebar h-12 lg:h-14 flex items-center justify-center">
        <div className={cn(
          "flex items-center w-full gap-2",
          isCollapsed ? "justify-center px-0" : "px-3"
        )}>
          {isCollapsed ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleSidebar}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <RhosonicsLogo size={24} className="shrink-0" />
              <span className="font-display text-sm text-sidebar-foreground whitespace-nowrap flex-1">
                Rhosonics <span className="font-medium">PMS</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={toggleSidebar}
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </>
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

        {inventoryItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{t('inventory')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {inventoryItems.map((item) => (
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
        )}

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
        {!isCollapsed && (
          <div className="px-2 py-2 space-y-2">
            {/* Theme Select */}
            <div className="flex items-center gap-2">
              <div className="w-8 flex justify-center shrink-0">
                {theme === 'dark' ? (
                  <Moon className="h-4 w-4 text-sidebar-foreground/70" />
                ) : theme === 'system' ? (
                  <Monitor className="h-4 w-4 text-sidebar-foreground/70" />
                ) : (
                  <Sun className="h-4 w-4 text-sidebar-foreground/70" />
                )}
              </div>
              <Select value={theme} onValueChange={(value: 'light' | 'dark' | 'system') => setTheme(value)}>
                <SelectTrigger className="flex-1 h-8 text-xs bg-sidebar-accent border-sidebar-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light" className="text-xs">
                    <span className="flex items-center gap-2">
                      <Sun className="h-3.5 w-3.5" />
                      {t('lightMode')}
                    </span>
                  </SelectItem>
                  <SelectItem value="dark" className="text-xs">
                    <span className="flex items-center gap-2">
                      <Moon className="h-3.5 w-3.5" />
                      {t('darkMode')}
                    </span>
                  </SelectItem>
                  <SelectItem value="system" className="text-xs">
                    <span className="flex items-center gap-2">
                      <Monitor className="h-3.5 w-3.5" />
                      {t('systemMode')}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Language Select */}
            <div className="flex items-center gap-2">
              <div className="w-8 flex justify-center shrink-0">
                <Globe className="h-4 w-4 text-sidebar-foreground/70" />
              </div>
              <Select value={language} onValueChange={(value: 'en' | 'nl') => setLanguage(value)}>
                <SelectTrigger className="flex-1 h-8 text-xs bg-sidebar-accent border-sidebar-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en" className="text-xs">English</SelectItem>
                  <SelectItem value="nl" className="text-xs">Nederlands</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        
        {isCollapsed && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}
                tooltip={t('theme')}
              >
                {theme === 'dark' ? (
                  <Moon className="h-4 w-4" />
                ) : theme === 'system' ? (
                  <Monitor className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setLanguage(language === 'en' ? 'nl' : 'en')}
                tooltip={language === 'en' ? 'Nederlands' : 'English'}
              >
                <Globe className="h-4 w-4" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        
        <UserProfile />
      </SidebarFooter>
    </Sidebar>
  );
}
