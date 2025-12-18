import React from 'react';
import { Palmtree, Stethoscope, GraduationCap, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AvailabilityStatusIndicatorProps {
  reasonType: 'holiday' | 'sick' | 'training' | 'other' | null;
  reason?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

const REASON_CONFIG = {
  holiday: { 
    icon: Palmtree, 
    label: 'On Holiday', 
    labelNl: 'Op Vakantie',
    bgColor: 'bg-sky-500', 
    textColor: 'text-sky-500',
    ringColor: 'ring-sky-500/50'
  },
  sick: { 
    icon: Stethoscope, 
    label: 'Sick Leave', 
    labelNl: 'Ziek',
    bgColor: 'bg-red-500', 
    textColor: 'text-red-500',
    ringColor: 'ring-red-500/50'
  },
  training: { 
    icon: GraduationCap, 
    label: 'Training', 
    labelNl: 'Training',
    bgColor: 'bg-purple-500', 
    textColor: 'text-purple-500',
    ringColor: 'ring-purple-500/50'
  },
  other: { 
    icon: HelpCircle, 
    label: 'Unavailable', 
    labelNl: 'Niet Beschikbaar',
    bgColor: 'bg-gray-500', 
    textColor: 'text-gray-500',
    ringColor: 'ring-gray-500/50'
  },
};

const SIZE_CLASSES = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

const BADGE_SIZE_CLASSES = {
  sm: 'h-4 w-4 -bottom-0.5 -right-0.5',
  md: 'h-5 w-5 -bottom-0.5 -right-0.5',
  lg: 'h-6 w-6 -bottom-1 -right-1',
};

export const AvailabilityStatusIndicator: React.FC<AvailabilityStatusIndicatorProps> = ({
  reasonType,
  reason,
  size = 'md',
  showTooltip = true,
  className,
}) => {
  if (!reasonType) return null;

  const config = REASON_CONFIG[reasonType];
  if (!config) return null;

  const Icon = config.icon;
  const iconSize = SIZE_CLASSES[size];

  const indicator = (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        config.bgColor,
        'text-white shadow-sm',
        BADGE_SIZE_CLASSES[size],
        className
      )}
    >
      <Icon className={cn(iconSize, 'p-0.5')} />
    </div>
  );

  if (!showTooltip) return indicator;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {indicator}
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{config.label}</p>
        {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
      </TooltipContent>
    </Tooltip>
  );
};

// Badge variant for avatar overlays
export const AvailabilityBadge: React.FC<{
  reasonType: 'holiday' | 'sick' | 'training' | 'other' | null;
  reason?: string | null;
  className?: string;
}> = ({ reasonType, reason, className }) => {
  if (!reasonType) return null;

  const config = REASON_CONFIG[reasonType];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center',
            config.bgColor,
            'text-white shadow-md ring-2 ring-background',
            className
          )}
        >
          <Icon className="h-3 w-3" />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{config.label}</p>
        {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
      </TooltipContent>
    </Tooltip>
  );
};

export default AvailabilityStatusIndicator;
