import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatProductType } from '@/lib/utils';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { SyncStatusBanner, SyncStatus } from './SyncStatusBanner';
import { MaterialsSummary, MaterialsSummaryData, MaterialsIssuedStatus } from './MaterialsSummary';
import OperatorAssignmentPanel from './OperatorAssignmentPanel';
import ItemLevelAssignmentPanel from './ItemLevelAssignmentPanel';
import { useLanguage } from '@/contexts/LanguageContext';
import { Package, Calendar, Truck, User, Play, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { triggerWebhook } from '@/lib/webhooks';
import { toast } from 'sonner';

interface WorkOrderDetail {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  customer_name: string | null;
  shipping_date: string | null;
  start_date: string | null;
  scheduled_date: string | null;
  production_ready_date: string | null;
  notes: string | null;
  external_order_number: string | null;
  assigned_to: string | null;
  created_at: string;
  // Exact sync fields
  exact_shop_order_number: string | null;
  exact_shop_order_link: string | null;
  sync_status: SyncStatus | null;
  last_sync_at: string | null;
  last_sync_error: string | null;
  materials_summary: MaterialsSummaryData | null;
  materials_issued_status: MaterialsIssuedStatus | null;
  work_order_items?: Array<{ id: string; status: string; batch_number: string | null; serial_number: string }>;
}

interface WorkOrderDetailSheetProps {
  workOrderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: () => void;
}

const WorkOrderDetailSheet: React.FC<WorkOrderDetailSheetProps> = ({
  workOrderId,
  open,
  onOpenChange,
  onStatusChange,
}) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (open && workOrderId) {
      fetchWorkOrder();
    }
  }, [open, workOrderId]);

  const fetchWorkOrder = async () => {
    if (!workOrderId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          work_order_items(id, status, batch_number, serial_number)
        `)
        .eq('id', workOrderId)
        .single();

      if (error) throw error;
      setWorkOrder(data as WorkOrderDetail);
    } catch (error) {
      console.error('Error fetching work order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetrySync = async () => {
    if (!workOrder) return;
    
    setRetrying(true);
    try {
      // Update sync status
      await supabase
        .from('work_orders')
        .update({ 
          sync_status: 'waiting_for_exact',
          last_sync_error: null,
        })
        .eq('id', workOrder.id);
      
      // Re-trigger webhook
      await triggerWebhook('workOrder.create.requested', {
        work_order_id: workOrder.id,
        wo_number: workOrder.wo_number,
        product_type: workOrder.product_type,
        batch_size: workOrder.batch_size,
        customer_name: workOrder.customer_name,
        external_order_number: workOrder.external_order_number,
        start_date: workOrder.start_date,
        shipping_date: workOrder.shipping_date,
        serial_numbers: workOrder.work_order_items?.map(i => i.serial_number) || [],
        retry: true,
      });
      
      toast.success(language === 'nl' ? 'Sync opnieuw gestart' : 'Sync retry started');
      
      // Refresh data
      await fetchWorkOrder();
    } catch (error) {
      console.error('Error retrying sync:', error);
      toast.error(language === 'nl' ? 'Fout bij opnieuw synchroniseren' : 'Failed to retry sync');
    } finally {
      setRetrying(false);
    }
  };

  const getProgressData = () => {
    if (!workOrder?.work_order_items) return { percent: 0, completed: 0, total: 0 };
    const items = workOrder.work_order_items;
    const completed = items.filter(i => i.status === 'completed').length;
    const total = items.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { percent, completed, total };
  };

  const progress = getProgressData();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : workOrder ? (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-center gap-3">
                <SheetTitle className="font-mono text-xl">{workOrder.wo_number}</SheetTitle>
                <StatusIndicator status={workOrder.status as any} showIcon />
              </div>
              <SheetDescription>
                {workOrder.customer_name || (language === 'nl' ? 'Geen klant opgegeven' : 'No customer specified')}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6">
              {/* Sync Status Banner */}
              {workOrder.sync_status && workOrder.sync_status !== 'not_sent' && (
                <SyncStatusBanner
                  syncStatus={workOrder.sync_status}
                  lastSyncAt={workOrder.last_sync_at}
                  lastSyncError={workOrder.last_sync_error}
                  exactShopOrderNumber={workOrder.exact_shop_order_number}
                  exactShopOrderLink={workOrder.exact_shop_order_link}
                  onRetry={handleRetrySync}
                  isRetrying={retrying}
                />
              )}

              {/* Exact Shop Order Info */}
              {workOrder.exact_shop_order_number && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        {language === 'nl' ? 'Exact Werkorder' : 'Exact Shop Order'}
                      </p>
                      <p className="font-mono font-semibold">{workOrder.exact_shop_order_number}</p>
                    </div>
                    {workOrder.exact_shop_order_link && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={workOrder.exact_shop_order_link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1.5" />
                          {language === 'nl' ? 'Open in Exact' : 'Open in Exact'}
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{language === 'nl' ? 'Voortgang' : 'Progress'}</span>
                  <span className="font-medium">{progress.completed}/{progress.total} items ({progress.percent}%)</span>
                </div>
                <Progress value={progress.percent} className="h-2" />
              </div>

              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Package className="h-3.5 w-3.5" />
                    {language === 'nl' ? 'Producttype' : 'Product Type'}
                  </div>
                  <Badge variant="outline">{formatProductType(workOrder.product_type)}</Badge>
                </div>
                {workOrder.production_ready_date && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {language === 'nl' ? 'Productie gereed' : 'Production Ready'}
                    </div>
                    <p className="font-medium">{formatDate(workOrder.production_ready_date)}</p>
                  </div>
                )}
                {workOrder.start_date && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {language === 'nl' ? 'Startdatum' : 'Start Date'}
                    </div>
                    <p className="font-medium">{formatDate(workOrder.start_date)}</p>
                  </div>
                )}
                {workOrder.shipping_date && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Truck className="h-3.5 w-3.5" />
                      {language === 'nl' ? 'Verzenddatum' : 'Ship Date'}
                    </div>
                    <p className="font-medium">{formatDate(workOrder.shipping_date)}</p>
                  </div>
                )}
              </div>

              {workOrder.external_order_number && (
                <div className="text-sm">
                  <span className="text-muted-foreground">{language === 'nl' ? 'Extern order: ' : 'External Order: '}</span>
                  <span className="font-medium">{workOrder.external_order_number}</span>
                </div>
              )}

              {workOrder.notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground">{language === 'nl' ? 'Notities: ' : 'Notes: '}</span>
                  <span>{workOrder.notes}</span>
                </div>
              )}

              <Separator />

              {/* Materials Summary (from Exact) */}
              {workOrder.materials_summary && Object.keys(workOrder.materials_summary).length > 0 && (
                <>
                  <MaterialsSummary
                    summary={workOrder.materials_summary}
                    issuedStatus={workOrder.materials_issued_status || 'not_issued'}
                  />
                  <Separator />
                </>
              )}

              {/* Items with Batch Numbers */}
              {workOrder.work_order_items && workOrder.work_order_items.some(i => i.batch_number) && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">
                    {language === 'nl' ? 'Items met Batchnummers' : 'Items with Batch Numbers'}
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {workOrder.work_order_items
                      .filter(i => i.batch_number)
                      .map((item) => (
                        <div 
                          key={item.id}
                          className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-muted/50"
                        >
                          <span className="font-mono text-xs">{item.serial_number}</span>
                          <Badge variant="outline" className="font-mono text-xs">
                            {item.batch_number}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Operator Assignment Panel */}
              <OperatorAssignmentPanel
                workOrderId={workOrder.id}
                scheduledDate={workOrder.scheduled_date || workOrder.start_date}
                onAssignmentChange={onStatusChange}
              />

              {/* Item-Level Assignment for mixed product type orders */}
              <ItemLevelAssignmentPanel
                workOrderId={workOrder.id}
                scheduledDate={workOrder.scheduled_date || workOrder.start_date}
                onAssignmentChange={onStatusChange}
              />

              <Separator />

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/production/${workOrder.id}`);
                  }}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {language === 'nl' ? 'Open Productie' : 'Open Production'}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {language === 'nl' ? 'Werkorder niet gevonden' : 'Work order not found'}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default WorkOrderDetailSheet;
