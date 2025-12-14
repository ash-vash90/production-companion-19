import React, { useEffect, useState, useRef, memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Users, UserCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { CardSectionHeader } from '@/components/CardSectionHeader';

interface OnlineUser {
  id: string;
  name: string;
  avatar_url?: string;
  role?: string;
  online_at: string;
}

export const ActiveOperators = memo(function ActiveOperators() {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
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
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profileError) throw profileError;
        
        clearTimeout(timeoutId);
        if (isMountedRef.current) {
          setCurrentUserProfile(data);
          setLoading(false);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        if (isMountedRef.current) {
          setError(err instanceof Error ? err : new Error(t('failedToLoad')));
          setLoading(false);
        }
      }
    };

    fetchProfile();
    
    return () => {
      isMountedRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [user]);

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

  const handleRetry = async () => {
    setLoading(true);
    setError(null);
    if (user) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (isMountedRef.current) {
          setCurrentUserProfile(data);
          setLoading(false);
        }
      } catch {
        if (isMountedRef.current) setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <section>
        <CardSectionHeader
          icon={<Users className="h-5 w-5 text-success" />}
          title={t('yourTeam')}
          chipLabel={onlineUsers.length > 0 ? onlineUsers.length : undefined}
          chipVariant="success"
        />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <CardSectionHeader
          icon={<Users className="h-5 w-5 text-success" />}
          title={t('yourTeam')}
          chipLabel={onlineUsers.length > 0 ? onlineUsers.length : undefined}
          chipVariant="success"
        />
        <div className="flex items-center justify-center py-8 gap-3 text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{t('failedToLoad')}</span>
          <Button variant="outline" size="sm" onClick={handleRetry}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <CardSectionHeader
        icon={<Users className="h-5 w-5 text-success" />}
        title={t('yourTeam')}
        chipLabel={onlineUsers.length > 0 ? onlineUsers.length : undefined}
        chipVariant="success"
      />

      {onlineUsers.length > 0 ? (
        <div className="space-y-1">
          {onlineUsers.slice(0, 6).map((colleague) => (
            <div
              key={colleague.id}
              className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="relative shrink-0">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={colleague.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                    {getInitials(colleague.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success border-2 border-background" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{colleague.name}</div>
                {colleague.role && (
                  <Badge variant={getRoleBadgeVariant(colleague.role)} className="text-[10px] mt-0.5">
                    {getRoleLabel(colleague.role)}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-3 rounded-full bg-muted/50 mb-3">
            <UserCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {t('noOneElseOnline')}
          </p>
        </div>
      )}
    </section>
  );
});
