import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CardSectionHeaderProps {
  icon?: ReactNode;
  title: string;
  chipLabel?: string | number;
  chipVariant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'muted';
  actions?: ReactNode;
  className?: string;
}

export function CardSectionHeader({
  icon,
  title,
  chipLabel,
  chipVariant = 'secondary',
  actions,
  className,
}: CardSectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3 mb-4 flex-wrap', className)}>
      <div className="flex items-center gap-2 flex-wrap">
        {icon}
        <h2 className="font-semibold text-base">{title}</h2>
        {chipLabel !== undefined && chipLabel !== '' && (
          <Badge variant={chipVariant} className="text-xs">
            {chipLabel}
          </Badge>
        )}
      </div>
      {actions}
    </div>
  );
}

