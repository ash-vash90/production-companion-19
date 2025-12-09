import React from 'react';
import { Menu, Search, Bell, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { RhosonicsLogo } from '@/components/RhosonicsLogo';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDistanceToNow } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

interface MobileHeaderProps {
  onSearchClick: () => void;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export function MobileHeader({ onSearchClick }: MobileHeaderProps) {
  const { toggleSidebar, isMobile } = useSidebar();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (user && isMobile) {
      fetchNotifications();
    }
  }, [user, isMobile]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Only show on mobile (when sidebar is not visible by default)
  // On tablet (md), sidebar is visible so we don't need this header
  if (!isMobile) {
    return null;
  }

  const buttonClass = "h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground";

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-3 gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={buttonClass}
          onClick={toggleSidebar}
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <RhosonicsLogo size={20} />
          <span className="font-display text-sm whitespace-nowrap text-sidebar-foreground">
            Rhosonics <span className="font-medium">PMS</span>
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className={buttonClass}
          onClick={onSearchClick}
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </Button>
        
        {/* Notifications */}
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`${buttonClass} relative`}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h4 className="font-semibold text-sm">{t('notifications')}</h4>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {unreadCount} {t('unread') || 'unread'}
                </Badge>
              )}
            </div>
            <ScrollArea className="h-[300px]">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {t('noNotifications') || 'No notifications'}
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3 ${!notif.read ? 'bg-accent/50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{notif.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            {formatDistanceToNow(new Date(notif.created_at), {
                              addSuffix: true,
                              locale: language === 'nl' ? nl : enUS,
                            })}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!notif.read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => markAsRead(notif.id)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteNotification(notif.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
