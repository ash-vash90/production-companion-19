import React from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface TeamBadgeProps {
  name: string;
  nameNl?: string | null;
  color: string;
  isLead?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

export function TeamBadge({ 
  name, 
  nameNl, 
  color, 
  isLead = false, 
  size = 'sm',
  showDot = true,
  className 
}: TeamBadgeProps) {
  const { language } = useLanguage();
  
  const displayName = language === 'nl' && nameNl ? nameNl : name;
  
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-1 gap-1.5',
    lg: 'text-sm px-2.5 py-1 gap-2',
  };

  const dotSizes = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  };

  return (
    <span 
      className={cn(
        'inline-flex items-center rounded-full font-medium bg-muted/50 text-foreground',
        sizeClasses[size],
        className
      )}
    >
      {showDot && (
        <span 
          className={cn('rounded-full flex-shrink-0', dotSizes[size])}
          style={{ backgroundColor: color }}
        />
      )}
      <span className="truncate">{displayName}</span>
      {isLead && (
        <span className="text-primary">★</span>
      )}
    </span>
  );
}

interface TeamBadgeListProps {
  teams: Array<{
    name: string;
    name_nl?: string | null;
    color: string;
    is_lead?: boolean;
  }>;
  size?: 'sm' | 'md' | 'lg';
  maxDisplay?: number;
  className?: string;
}

export function TeamBadgeList({ 
  teams, 
  size = 'sm', 
  maxDisplay = 2,
  className 
}: TeamBadgeListProps) {
  const { language } = useLanguage();
  
  if (!teams || teams.length === 0) return null;

  const displayTeams = teams.slice(0, maxDisplay);
  const remainingCount = teams.length - maxDisplay;

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {displayTeams.map((team, index) => (
        <TeamBadge
          key={index}
          name={team.name}
          nameNl={team.name_nl}
          color={team.color}
          isLead={team.is_lead}
          size={size}
        />
      ))}
      {remainingCount > 0 && (
        <span className={cn(
          'inline-flex items-center rounded-full bg-muted/50 text-muted-foreground font-medium',
          size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 
          size === 'md' ? 'text-xs px-2 py-1' : 'text-sm px-2.5 py-1'
        )}>
          +{remainingCount}
        </span>
      )}
    </div>
  );
}

export default TeamBadge;
