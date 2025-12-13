import React, { useEffect, useState, useRef, memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Circle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface OnlineUser {
  id: string;
  name: string;
  avatar_url?: string;
  role?: string;
}

export const ActiveOperators = memo(function ActiveOperators() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const timeout = setTimeout(() => mountedRef.current && setLoading(false), 6000);

    if (!user) {
      setLoading(false);
      return;
    }

    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        clearTimeout(timeout);
        if (mountedRef.current) {
          setProfile(data);
          setLoading(false);
        }
      });

    return () => { mountedRef.current = false; clearTimeout(timeout); };
  }, [user]);

  useEffect(() => {
    if (!user || !profile) return;

    const channel = supabase.channel('presence', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: OnlineUser[] = [];
        Object.entries(state).forEach(([key, presences]) => {
          if (Array.isArray(presences) && presences.length > 0) {
            const p = presences[0] as any;
            if (p.name) users.push({ id: key, name: p.name, avatar_url: p.avatar_url, role: p.role });
          }
        });
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            name: profile.full_name,
            avatar_url: profile.avatar_url,
            role: profile.role,
          });
        }
      });

    return () => { channel.untrack(); supabase.removeChannel(channel); };
  }, [user, profile]);

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const roleColor = (role: string) => {
    if (role === 'admin') return 'destructive';
    if (role === 'supervisor') return 'warning';
    if (role === 'operator') return 'info';
    return 'secondary';
  };

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Users className="h-4 w-4" />
          {language === 'nl' ? 'Team Online' : 'Team Online'}
        </h2>
        {onlineUsers.length > 0 && (
          <Badge variant="success" className="gap-1">
            <Circle className="h-1.5 w-1.5 fill-current animate-pulse" />
            {onlineUsers.length}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 py-1">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : onlineUsers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          {language === 'nl' ? 'Niemand anders online' : 'No one else is online'}
        </p>
      ) : (
        <div className="space-y-1">
          {onlineUsers.slice(0, 8).map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-1.5">
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={u.avatar_url} />
                  <AvatarFallback className="text-xs bg-muted">{initials(u.name)}</AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success border-2 border-background" />
              </div>
              <span className="text-sm font-medium truncate">{u.name}</span>
              {u.role && (
                <Badge variant={roleColor(u.role) as any} className="text-[10px] ml-auto">
                  {u.role}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
