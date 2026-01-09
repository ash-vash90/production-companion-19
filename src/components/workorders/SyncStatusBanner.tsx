import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  CloudOff
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export type SyncStatus = 'not_sent' | 'waiting_for_exact' | 'synced' | 'sync_failed' | 'out_of_sync';

interface SyncStatusBannerProps {
  syncStatus: SyncStatus;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  exactShopOrderNumber?: string | null;
  exactShopOrderLink?: string | null;
  className?: string;
  compact?: boolean;
}

const syncStatusConfig: Record<SyncStatus, {
  icon: React.ReactNode;
  label: { en: string; nl: string };
  description: { en: string; nl: string };
  variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive';
  bgClass: string;
}> = {
  not_sent: {
    icon: <CloudOff className="h-4 w-4" />,
    label: { en: 'Not Synced', nl: 'Niet gesynchroniseerd' },
    description: { en: 'Waiting to send to Exact', nl: 'Wacht op verzenden naar Exact' },
    variant: 'secondary',
    bgClass: 'bg-muted/50',
  },
  waiting_for_exact: {
    icon: <Clock className="h-4 w-4 animate-pulse" />,
    label: { en: 'Waiting for Exact', nl: 'Wacht op Exact' },
    description: { en: 'Request sent, waiting for confirmation', nl: 'Verzoek verzonden, wacht op bevestiging' },
    variant: 'warning',
    bgClass: 'bg-yellow-500/10',
  },
  synced: {
    icon: <CheckCircle className="h-4 w-4" />,
    label: { en: 'Synced', nl: 'Gesynchroniseerd' },
    description: { en: 'Connected to Exact', nl: 'Verbonden met Exact' },
    variant: 'success',
    bgClass: 'bg-green-500/10',
  },
  sync_failed: {
    icon: <XCircle className="h-4 w-4" />,
    label: { en: 'Sync Failed', nl: 'Synchronisatie mislukt' },
    description: { en: 'Failed to sync with Exact', nl: 'Synchroniseren met Exact mislukt' },
    variant: 'destructive',
    bgClass: 'bg-destructive/10',
  },
  out_of_sync: {
    icon: <AlertCircle className="h-4 w-4" />,
    label: { en: 'Out of Sync', nl: 'Niet gesynchroniseerd' },
    description: { en: 'Changes detected, sync needed', nl: 'Wijzigingen gedetecteerd, synchronisatie nodig' },
    variant: 'warning',
    bgClass: 'bg-orange-500/10',
  },
};

export const SyncStatusBanner: React.FC<SyncStatusBannerProps> = ({
  syncStatus,
  lastSyncAt,
  lastSyncError,
  onRetry,
  isRetrying,
  exactShopOrderNumber,
  exactShopOrderLink,
  className,
  compact = false,
}) => {
  const { language } = useLanguage();
  const config = syncStatusConfig[syncStatus] || syncStatusConfig.not_sent;
  
  const label = config.label[language as 'en' | 'nl'] || config.label.en;
  const description = config.description[language as 'en' | 'nl'] || config.description.en;
  
  const showRetry = (syncStatus === 'sync_failed' || syncStatus === 'out_of_sync') && onRetry;
  
  if (compact) {
    return (
      <Badge 
        variant={config.variant === 'success' ? 'default' : config.variant === 'warning' ? 'secondary' : config.variant}
        className={cn('flex items-center gap-1.5', className)}
      >
        {config.icon}
        {label}
      </Badge>
    );
  }
  
  return (
    <div className={cn('rounded-lg border p-3', config.bgClass, className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn(
            'rounded-full p-1.5',
            config.variant === 'success' && 'bg-green-500/20 text-green-600 dark:text-green-400',
            config.variant === 'warning' && 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
            config.variant === 'destructive' && 'bg-destructive/20 text-destructive',
            config.variant === 'secondary' && 'bg-muted text-muted-foreground',
          )}>
            {config.icon}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{label}</span>
              {exactShopOrderNumber && (
                <Badge variant="outline" className="text-xs font-semibold">
                  {exactShopOrderNumber}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
            {lastSyncAt && (
              <p className="text-xs text-muted-foreground">
                {language === 'nl' ? 'Laatst gesynchroniseerd' : 'Last synced'}: {formatDate(lastSyncAt)}
              </p>
            )}
            {lastSyncError && syncStatus === 'sync_failed' && (
              <p className="text-xs text-destructive mt-1">{lastSyncError}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {exactShopOrderLink && syncStatus === 'synced' && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="text-xs"
            >
              <a href={exactShopOrderLink} target="_blank" rel="noopener noreferrer">
                {language === 'nl' ? 'Open in Exact' : 'Open in Exact'}
              </a>
            </Button>
          )}
          
          {showRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isRetrying}
              className="text-xs"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isRetrying && 'animate-spin')} />
              {language === 'nl' ? 'Opnieuw' : 'Retry'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncStatusBanner;
