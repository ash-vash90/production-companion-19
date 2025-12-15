import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLowStock } from '@/hooks/useInventory';
import {
  AlertTriangle,
  Package,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  ShoppingCart,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function LowStockAlerts() {
  const { language } = useLanguage();
  const { data: lowStockItems, isLoading, error, refetch } = useLowStock();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            {language === 'nl' ? 'Fout bij laden' : 'Error Loading'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {language === 'nl' ? 'Opnieuw proberen' : 'Try Again'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasLowStock = lowStockItems && lowStockItems.length > 0;
  const criticalCount = lowStockItems?.filter(item => item.totalAvailable <= 0).length || 0;
  const warningCount = (lowStockItems?.length || 0) - criticalCount;

  return (
    <Card className={cn(
      hasLowStock && 'border-amber-500/50',
      criticalCount > 0 && 'border-red-500/50'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {criticalCount > 0 ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : hasLowStock ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <Package className="h-5 w-5 text-green-500" />
            )}
            {language === 'nl' ? 'Voorraadwaarschuwingen' : 'Stock Alerts'}
          </CardTitle>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} {language === 'nl' ? 'kritiek' : 'critical'}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                {warningCount} {language === 'nl' ? 'laag' : 'low'}
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          {hasLowStock
            ? language === 'nl'
              ? `${lowStockItems.length} materialen onder bestelpunt`
              : `${lowStockItems.length} materials below reorder point`
            : language === 'nl'
              ? 'Alle voorraden zijn op niveau'
              : 'All stock levels are healthy'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasLowStock ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Package className="h-10 w-10 text-green-500 mb-3" />
            <p className="text-sm text-muted-foreground">
              {language === 'nl'
                ? 'Geen waarschuwingen op dit moment'
                : 'No alerts at this time'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[200px]">
            <div className="space-y-2 pr-3">
              {lowStockItems.map((item) => {
                const isCritical = item.totalAvailable <= 0;
                return (
                  <div
                    key={item.material.id}
                    className={cn(
                      'flex items-center justify-between p-3 border rounded-lg transition-colors',
                      isCritical
                        ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900'
                        : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isCritical ? (
                          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        )}
                        <span className="font-medium text-sm truncate">
                          {item.material.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 ml-6 text-xs text-muted-foreground">
                        <span>
                          {language === 'nl' ? 'Beschikbaar' : 'Available'}:{' '}
                          <span className={cn(
                            'font-mono font-medium',
                            isCritical ? 'text-red-600' : 'text-amber-600'
                          )}>
                            {item.totalAvailable}
                          </span>
                        </span>
                        <span>
                          {language === 'nl' ? 'Bestelpunt' : 'Reorder'}:{' '}
                          <span className="font-mono">{item.reorderPoint}</span>
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant={isCritical ? 'destructive' : 'outline'}
                      className={cn(
                        'ml-2 shrink-0',
                        !isCritical && 'border-amber-500 text-amber-600'
                      )}
                    >
                      {isCritical
                        ? language === 'nl' ? 'Op' : 'Out'
                        : language === 'nl' ? 'Laag' : 'Low'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
        {hasLowStock && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {language === 'nl' ? 'Vernieuwen' : 'Refresh'}
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link to="/settings?tab=inventory">
                <ShoppingCart className="h-4 w-4 mr-2" />
                {language === 'nl' ? 'Voorraad beheren' : 'Manage Inventory'}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LowStockAlerts;
