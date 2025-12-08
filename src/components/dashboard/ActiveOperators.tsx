import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Users, Circle } from 'lucide-react';

interface OnlineUser {
  id: string;
  name: string;
  avatar_url?: string;
  role?: string;
  online_at: string;
}

export function ActiveOperators() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

  // Fetch current user profile first
  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setCurrentUserProfile(data);
          setLoading(false);
        });
    }
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
      case 'logistics': return 'secondary';
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
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" />
            {language === 'nl' ? 'Je Collega\'s' : 'Your Team'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5" />
          {language === 'nl' ? 'Je Collega\'s' : 'Your Team'}
          {onlineUsers.length > 0 && (
            <Badge variant="success" className="ml-auto">
              <Circle className="h-2 w-2 mr-1 fill-current" />
              {onlineUsers.length} {language === 'nl' ? 'online' : 'online'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {onlineUsers.length > 0 ? (
          <div className="space-y-2">
            {onlineUsers.slice(0, 6).map((colleague) => (
              <div
                key={colleague.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="relative">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={colleague.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(colleague.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success border-2 border-background" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{colleague.name}</div>
                  {colleague.role && (
                    <Badge variant={getRoleBadgeVariant(colleague.role)} className="text-xs mt-0.5">
                      {getRoleLabel(colleague.role)}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {language === 'nl' ? 'Niemand anders is online' : 'No one else is online'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
