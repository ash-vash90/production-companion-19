import React, { useEffect, useState, useRef, memo, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Circle, UserCircle, AlertCircle, RefreshCw, Palmtree, Stethoscope, GraduationCap, HelpCircle, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamBadgeList } from '@/components/TeamBadge';
import { useUsersTeams } from '@/hooks/useUserTeams';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';

interface OnlineUser {
  id: string;
  name: string;
  avatar_url?: string;
  role?: string;
  online_at: string;
}

interface OperatorAvailability {
  user_id: string;
  reason_type: 'holiday' | 'sick' | 'training' | 'other';
  reason: string | null;
}

type PresenceStatus = 'online' | 'away' | 'extended_away' | 'holiday' | 'sick' | 'training' | 'other' | 'off_hours';

const REASON_ICONS = {
  holiday: Palmtree,
  sick: Stethoscope,
  training: GraduationCap,
  other: HelpCircle,
};

const REASON_LABELS = {
  holiday: { en: 'On Holiday', nl: 'Op Vakantie' },
  sick: { en: 'Sick Leave', nl: 'Ziek' },
  training: { en: 'Training', nl: 'Training' },
  other: { en: 'Unavailable', nl: 'Niet Beschikbaar' },
};

// Check if current time is within working hours (08:30-17:00, Mon-Fri)
const isWithinWorkingHours = (): boolean => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Weekend
  if (day === 0 || day === 6) return false;
  
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  const startTime = 8 * 60 + 30; // 08:30
  const endTime = 17 * 60; // 17:00
  
  return timeInMinutes >= startTime && timeInMinutes < endTime;
};

// Get minutes since last online
const getMinutesSinceOnline = (onlineAt: string): number => {
  const lastOnline = new Date(onlineAt);
  const now = new Date();
  return Math.floor((now.getTime() - lastOnline.getTime()) / (1000 * 60));
};

export const ActiveOperators = memo(function ActiveOperators() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [todayAvailability, setTodayAvailability] = useState<OperatorAvailability[]>([]);
  const [allTeamMembers, setAllTeamMembers] = useState<any[]>([]);
  const isMountedRef = useRef(true);

  // Get all team members (not just online ones)
  const teamMemberIds = useMemo(() => allTeamMembers.map(m => m.id), [allTeamMembers]);
  const { teamsMap } = useUsersTeams(teamMemberIds);

  // Fetch today's availability data
  useEffect(() => {
    const fetchTodayAvailability = async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('operator_availability')
        .select('user_id, reason_type, reason')
        .eq('date', today);
      
      if (data && isMountedRef.current) {
        setTodayAvailability(data as OperatorAvailability[]);
      }
    };
    
    fetchTodayAvailability();
  }, []);

  // Fetch all team members (profiles)
  useEffect(() => {
    const fetchAllMembers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .order('full_name');
      
      if (data && isMountedRef.current) {
        setAllTeamMembers(data);
      }
    };
    
    fetchAllMembers();
  }, []);

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
          setError(err instanceof Error ? err : new Error('Failed to load profile'));
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

  // Determine presence status for a user
  const getPresenceStatus = (userId: string): PresenceStatus => {
    // Check if user is on leave today
    const availability = todayAvailability.find(a => a.user_id === userId);
    if (availability) {
      return availability.reason_type as PresenceStatus;
    }
    
    // Check if within working hours
    if (!isWithinWorkingHours()) {
      return 'off_hours';
    }
    
    // Check online status
    const onlineUser = onlineUsers.find(u => u.id === userId);
    if (!onlineUser) {
      return 'extended_away'; // Not online during working hours = red
    }
    
    const minutesAway = getMinutesSinceOnline(onlineUser.online_at);
    
    if (minutesAway <= 15) {
      return 'online';
    } else if (minutesAway <= 60) {
      return 'away';
    } else {
      return 'extended_away';
    }
  };

  const getStatusIndicator = (status: PresenceStatus, reason?: string | null) => {
    switch (status) {
      case 'online':
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success border-2 border-card" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{language === 'nl' ? 'Online' : 'Online'}</p>
            </TooltipContent>
          </Tooltip>
        );
      case 'away':
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-500 border-2 border-card" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{language === 'nl' ? 'Even weg' : 'Away'}</p>
            </TooltipContent>
          </Tooltip>
        );
      case 'extended_away':
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive border-2 border-card" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{language === 'nl' ? 'Lang afwezig' : 'Extended away'}</p>
            </TooltipContent>
          </Tooltip>
        );
      case 'off_hours':
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-muted border-2 border-card flex items-center justify-center">
                <Moon className="h-2.5 w-2.5 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{language === 'nl' ? 'Buiten werktijd' : 'Off hours'}</p>
            </TooltipContent>
          </Tooltip>
        );
      case 'holiday':
      case 'sick':
      case 'training':
      case 'other':
        const Icon = REASON_ICONS[status];
        const label = REASON_LABELS[status][language];
        const bgColors = {
          holiday: 'bg-sky-500',
          sick: 'bg-red-500',
          training: 'bg-purple-500',
          other: 'bg-gray-500',
        };
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn(
                "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card flex items-center justify-center text-white",
                bgColors[status]
              )}>
                <Icon className="h-2.5 w-2.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{label}</p>
              {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
            </TooltipContent>
          </Tooltip>
        );
      default:
        return null;
    }
  };

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

  // Filter out current user and prepare team members for display
  const displayMembers = useMemo(() => {
    if (!user) return [];
    return allTeamMembers
      .filter(member => member.id !== user.id)
      .map(member => {
        const status = getPresenceStatus(member.id);
        const availability = todayAvailability.find(a => a.user_id === member.id);
        return {
          ...member,
          status,
          reason: availability?.reason || null,
        };
      })
      // Sort: online first, then away, then others
      .sort((a, b) => {
        const order: Record<PresenceStatus, number> = {
          online: 0,
          away: 1,
          extended_away: 2,
          off_hours: 3,
          holiday: 4,
          sick: 5,
          training: 6,
          other: 7,
        };
        return order[a.status] - order[b.status];
      });
  }, [allTeamMembers, user, onlineUsers, todayAvailability]);

  // Count online users (excluding self)
  const onlineCount = useMemo(() => {
    return displayMembers.filter(m => m.status === 'online').length;
  }, [displayMembers]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Users className="h-4 w-4 text-success" />
            </div>
            <h2 className="font-semibold text-sm">{language === 'nl' ? 'Je Team' : 'Your Team'}</h2>
          </div>
        </div>
        <div className="p-4 sm:p-5 space-y-3">
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Users className="h-4 w-4 text-success" />
            </div>
            <h2 className="font-semibold text-sm">{language === 'nl' ? 'Je Team' : 'Your Team'}</h2>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-center py-6 gap-3 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">Failed to load</span>
            <Button variant="ghost" size="sm" onClick={handleRetry}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Section Header */}
      <div className="p-4 sm:p-5 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Users className="h-4 w-4 text-success" />
            </div>
            <h2 className="font-semibold text-sm">{language === 'nl' ? 'Je Team' : 'Your Team'}</h2>
          </div>
          {onlineCount > 0 && (
            <Badge variant="success" className="text-xs">
              <Circle className="h-1.5 w-1.5 mr-1 fill-current animate-pulse" />
              {onlineCount} {language === 'nl' ? 'online' : 'online'}
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">
        {displayMembers.length > 0 ? (
          <div className="space-y-2">
            {displayMembers.slice(0, 6).map((member) => {
              const userTeams = teamsMap[member.id] || [];
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:border-primary/20 transition-colors"
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                        {getInitials(member.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    {getStatusIndicator(member.status, member.reason)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{member.full_name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {member.role && (
                        <Badge variant={getRoleBadgeVariant(member.role)} className="text-[10px]">
                          {getRoleLabel(member.role)}
                        </Badge>
                      )}
                      {userTeams.length > 0 && (
                        <TeamBadgeList teams={userTeams} size="sm" maxDisplay={1} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 rounded-full bg-muted/50 mb-3">
              <UserCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'nl' ? 'Geen teamleden gevonden' : 'No team members found'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
