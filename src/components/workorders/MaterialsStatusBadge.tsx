import { Badge } from '@/components/ui/badge';
import { Package, PackageCheck, PackageX, Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type MaterialsStatus = 'pending' | 'partial' | 'complete' | null;

interface MaterialsStatusBadgeProps {
  status: MaterialsStatus;
  className?: string;
}

const statusConfig: Record<NonNullable<MaterialsStatus>, {
  icon: typeof Package;
  labelEn: string;
  labelNl: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
}> = {
  pending: {
    icon: Clock,
    labelEn: 'Materials Pending',
    labelNl: 'Materialen in afwachting',
    variant: 'outline',
    className: 'border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30',
  },
  partial: {
    icon: PackageX,
    labelEn: 'Partial Materials',
    labelNl: 'Gedeeltelijke materialen',
    variant: 'outline',
    className: 'border-orange-500/50 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30',
  },
  complete: {
    icon: PackageCheck,
    labelEn: 'Materials Ready',
    labelNl: 'Materialen gereed',
    variant: 'outline',
    className: 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30',
  },
};

export function MaterialsStatusBadge({ status, className = '' }: MaterialsStatusBadgeProps) {
  const { language } = useLanguage();
  
  if (!status) {
    return null;
  }

  const config = statusConfig[status];
  const Icon = config.icon;
  const label = language === 'nl' ? config.labelNl : config.labelEn;

  return (
    <Badge 
      variant={config.variant} 
      className={`${config.className} ${className} gap-1 text-xs font-medium`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
