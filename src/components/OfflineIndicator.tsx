/**
 * Offline Indicator Component
 *
 * Shows a banner when the user is offline and displays pending sync status.
 */

import React from 'react';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  WifiOff,
  Wifi,
  RefreshCw,
  Cloud,
  CloudOff,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  className?: string;
  showWhenOnline?: boolean;
}

export function OfflineIndicator({ className, showWhenOnline = false }: OfflineIndicatorProps) {
  const { language } = useLanguage();
  const {
    isOnline,
    pendingSyncCount,
    failedSyncCount,
    isSyncing,
    syncNow,
  } = useOfflineStatus();

  // Don't show anything if online and no pending syncs (unless showWhenOnline is true)
  if (isOnline && pendingSyncCount === 0 && failedSyncCount === 0 && !showWhenOnline) {
    return null;
  }

  // Offline banner
  if (!isOnline) {
    return (
      <div className={cn(
        'flex items-center justify-between gap-3 px-4 py-2 bg-amber-500 text-amber-950',
        className
      )}>
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">
            {language === 'nl' ? 'Je bent offline' : "You're offline"}
          </span>
          {pendingSyncCount > 0 && (
            <Badge variant="secondary" className="bg-amber-600 text-white border-0">
              {pendingSyncCount} {language === 'nl' ? 'in wachtrij' : 'pending'}
            </Badge>
          )}
        </div>
        <span className="text-xs opacity-80">
          {language === 'nl'
            ? 'Wijzigingen worden gesynchroniseerd wanneer je weer online bent'
            : 'Changes will sync when you reconnect'}
        </span>
      </div>
    );
  }

  // Online with pending syncs
  if (pendingSyncCount > 0 || failedSyncCount > 0) {
    return (
      <div className={cn(
        'flex items-center justify-between gap-3 px-4 py-2',
        failedSyncCount > 0
          ? 'bg-red-50 border-b border-red-200 dark:bg-red-950/30 dark:border-red-900'
          : 'bg-blue-50 border-b border-blue-200 dark:bg-blue-950/30 dark:border-blue-900',
        className
      )}>
        <div className="flex items-center gap-2">
          {failedSyncCount > 0 ? (
            <AlertCircle className="h-4 w-4 text-red-500" />
          ) : (
            <Cloud className="h-4 w-4 text-blue-500" />
          )}
          <span className="text-sm">
            {failedSyncCount > 0 ? (
              <>
                {failedSyncCount} {language === 'nl' ? 'sync-fouten' : 'sync errors'}
              </>
            ) : (
              <>
                {pendingSyncCount} {language === 'nl' ? 'in wachtrij om te synchroniseren' : 'pending sync'}
              </>
            )}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={syncNow}
          disabled={isSyncing}
          className="h-7"
        >
          <RefreshCw className={cn('h-3 w-3 mr-1', isSyncing && 'animate-spin')} />
          {isSyncing
            ? language === 'nl' ? 'Synchroniseren...' : 'Syncing...'
            : language === 'nl' ? 'Nu synchroniseren' : 'Sync now'}
        </Button>
      </div>
    );
  }

  // Online status indicator (when showWhenOnline is true)
  if (showWhenOnline) {
    return (
      <div className={cn(
        'flex items-center gap-2 text-green-600 dark:text-green-400',
        className
      )}>
        <Wifi className="h-4 w-4" />
        <span className="text-xs">
          {language === 'nl' ? 'Online' : 'Online'}
        </span>
      </div>
    );
  }

  return null;
}

/**
 * Compact offline status badge for use in headers/toolbars
 */
export function OfflineStatusBadge({ className }: { className?: string }) {
  const { language } = useLanguage();
  const { isOnline, pendingSyncCount, isSyncing, syncNow } = useOfflineStatus();

  if (isOnline && pendingSyncCount === 0) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'h-7 px-2 gap-1.5',
        !isOnline && 'text-amber-600',
        pendingSyncCount > 0 && isOnline && 'text-blue-600',
        className
      )}
      onClick={isOnline ? syncNow : undefined}
      disabled={!isOnline || isSyncing}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          <span className="text-xs">{language === 'nl' ? 'Offline' : 'Offline'}</span>
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">{language === 'nl' ? 'Syncing' : 'Syncing'}</span>
        </>
      ) : (
        <>
          <Cloud className="h-3.5 w-3.5" />
          <span className="text-xs">{pendingSyncCount}</span>
        </>
      )}
    </Button>
  );
}

export default OfflineIndicator;
