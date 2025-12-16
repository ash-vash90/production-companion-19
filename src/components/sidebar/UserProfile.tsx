import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, LogOut, ChevronUp } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { TeamBadgeList } from '@/components/TeamBadge';
import { useUserTeams } from '@/hooks/useUserTeams';

export function UserProfile() {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  
  const { teams } = useUserTeams(user?.id);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  if (!user) return null;

  const displayName = profile?.full_name || user.email || 'User';
  const initials = getInitials(displayName);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={`flex items-center gap-2 p-2 w-full rounded-md hover:bg-sidebar-accent transition-colors text-left ${isCollapsed ? 'justify-center' : ''}`}>
          <Avatar className="h-8 w-8 shrink-0">
            {profile?.avatar_url && (
              <AvatarImage src={profile.avatar_url} alt={displayName} />
            )}
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                {teams.length > 0 ? (
                  <TeamBadgeList teams={teams} size="sm" maxDisplay={1} className="mt-0.5" />
                ) : (
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                )}
              </div>
              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuItem onClick={() => navigate('/personal-settings')}>
          <Settings className="mr-2 h-4 w-4" />
          {t('personalSettings')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
