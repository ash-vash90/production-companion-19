import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WorkOrderStatusBadge } from '@/components/workorders/WorkOrderStatusBadge';
import { ProductBreakdownBadges } from '@/components/workorders/ProductBreakdownBadges';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate, ProductBreakdown } from '@/lib/utils';
import { Calendar, User, Package, ChevronRight } from 'lucide-react';

interface MobileReportCardProps {
  workOrder: {
    id: string;
    wo_number: string;
    product_type: string;
    batch_size: number;
    status: string;
    created_at: string;
    completed_at?: string | null;
    customer_name?: string | null;
    shipping_date?: string | null;
    productBreakdown: ProductBreakdown[];
    isMainAssembly?: boolean;
    hasSubassemblies?: boolean;
  };
  onClick: () => void;
}

export function MobileReportCard({ workOrder, onClick }: MobileReportCardProps) {
  const { t } = useLanguage();

  return (
    <Card 
      className="cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-sm">{workOrder.wo_number}</span>
              <WorkOrderStatusBadge status={workOrder.status} />
            </div>
            
            {/* Product breakdown */}
            <ProductBreakdownBadges
              breakdown={workOrder.productBreakdown}
              batchSize={workOrder.batch_size}
              isMainAssembly={workOrder.isMainAssembly}
              hasSubassemblies={workOrder.hasSubassemblies}
              compact
              maxVisible={3}
            />
            
            {/* Details grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {workOrder.customer_name && (
                <div className="flex items-center gap-1.5 col-span-2">
                  <User className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{workOrder.customer_name}</span>
                </div>
              )}
              
              {workOrder.completed_at && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  <span>{t('completed')}: {formatDate(workOrder.completed_at)}</span>
                </div>
              )}
              
              {workOrder.shipping_date && (
                <div className="flex items-center gap-1.5">
                  <Package className="h-3 w-3 flex-shrink-0" />
                  <span>{t('ship')}: {formatDate(workOrder.shipping_date)}</span>
                </div>
              )}
            </div>
          </div>
          
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}
