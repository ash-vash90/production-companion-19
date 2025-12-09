import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLowStock } from '@/hooks/useInventory';
import { getMaterialName } from '@/hooks/useMaterials';
import { AlertTriangle, Package, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Component showing low stock alerts.
 * Can be placed on dashboard or inventory page.
 */
export function LowStockAlert() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { data: lowStockItems, isLoading } = useLowStock();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!lowStockItems || lowStockItems.length === 0) {
    return null; // Don't show anything if no low stock
  }

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-warning">
          <AlertTriangle className="h-4 w-4" />
          {language === 'nl' ? 'Lage Voorraad Waarschuwing' : 'Low Stock Alert'}
          <Badge variant="secondary" className="ml-auto">
            {lowStockItems.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {lowStockItems.slice(0, 3).map((item) => (
          <div
            key={item.material.id}
            className="flex items-center justify-between p-2 bg-background rounded border"
          >
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {getMaterialName(item.material, language as 'en' | 'nl')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === 'nl' ? 'Beschikbaar' : 'Available'}: {item.totalAvailable}{' '}
                  / {language === 'nl' ? 'Min' : 'Min'}: {item.reorderPoint}
                </p>
              </div>
            </div>
            <Badge
              variant={item.totalAvailable <= 0 ? 'destructive' : 'secondary'}
              className="text-xs"
            >
              {item.totalAvailable <= 0
                ? language === 'nl'
                  ? 'Op'
                  : 'Out'
                : language === 'nl'
                ? 'Laag'
                : 'Low'}
            </Badge>
          </div>
        ))}

        {lowStockItems.length > 3 && (
          <p className="text-xs text-muted-foreground text-center">
            {language === 'nl'
              ? `+ ${lowStockItems.length - 3} meer items`
              : `+ ${lowStockItems.length - 3} more items`}
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full mt-2"
          onClick={() => navigate('/inventory')}
        >
          {language === 'nl' ? 'Bekijk Voorraad' : 'View Inventory'}
          <ArrowRight className="h-3 w-3 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
