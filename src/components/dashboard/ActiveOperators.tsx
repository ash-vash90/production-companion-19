import React, { useEffect, useState, useRef, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Users, Circle, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnlineUser {
  id: string;
  name: string;
  avatar_url?: string;
  role?: string;
  online_at: string;
}

export const ActiveOperators = memo(function ActiveOperators() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Timeout after 8 seconds to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) setLoading(false);
    }, 8000);

    const fetchProfile = async () => {
      if (!user) {
        clearTimeout(timeoutId);
        setLoading(false);
        return;
      }
      
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        clearTimeout(timeoutId);
        if (isMountedRef.current) {
          setCurrentUserProfile(data);
          setLoading(false);
        }
      } catch {
        clearTimeout(timeoutId);
        if (isMountedRef.current) setLoading(false);
      }
    };

    fetchProfile();
    
    return () => {
      isMountedRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [user]);

  // Set up real-time presence channel
  useEffect(() => {
    if (!user || !currentUserProfile) return;

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: OnlineUser[] = [];
        
        Object.entries(state).forEach(([key, presences]) => {
          if (Array.isArray(presences) && presences.length > 0) {
            const presence = presences[0] as unknown as OnlineUser;
            if (presence.name) {
              users.push({
                id: key,
                name: presence.name || 'Unknown',
                avatar_url: presence.avatar_url,
                role: presence.role,
                online_at: presence.online_at,
              });
            }
          }
        });
        
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: user.id,
            name: currentUserProfile.full_name,
            avatar_url: currentUserProfile.avatar_url,
            role: currentUserProfile.role,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [user, currentUserProfile]);

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'supervisor': return 'warning';
      case 'operator': return 'info';
      case 'logistics': return 'muted';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, { en: string; nl: string }> = {
      admin: { en: 'Admin', nl: 'Admin' },
      supervisor: { en: 'Supervisor', nl: 'Supervisor' },
      operator: { en: 'Operator', nl: 'Operator' },
      logistics: { en: 'Logistics', nl: 'Logistiek' },
    };
    return labels[role]?.[language] || role;
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
            </div>
            <span>{language === 'nl' ? 'Je Collega\'s' : 'Your Team'}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col w-full">
      <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10">
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
          </div>
          <span className="truncate">{language === 'nl' ? 'Je Collega\'s' : 'Your Team'}</span>
          {onlineUsers.length > 0 && (
            <Badge variant="success" className="ml-auto">
              <Circle className="h-1.5 w-1.5 mr-1 fill-current animate-pulse" />
              {onlineUsers.length} online
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0 px-4 sm:px-6">
        {onlineUsers.length > 0 ? (
          <div className="space-y-2">
            {onlineUsers.slice(0, 6).map((colleague, index) => (
              <div
                key={colleague.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border bg-card p-3",
                  "hover:shadow-card-hover hover:border-success/20 transition-all duration-normal"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-9 w-9 ring-2 ring-background">
                    <AvatarImage src={colleague.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                      {getInitials(colleague.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success border-2 border-background shadow-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{colleague.name}</div>
                  {colleague.role && (
                    <Badge variant={getRoleBadgeVariant(colleague.role)} className="mt-0.5">
                      {getRoleLabel(colleague.role)}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 rounded-full bg-muted/50 mb-3">
              <UserCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'nl' ? 'Niemand anders is online' : 'No one else is online'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
