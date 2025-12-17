import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate, formatProductType } from '@/lib/utils';
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge';
import StepAssignmentPanel from './StepAssignmentPanel';
import { Package, Calendar, Truck, DollarSign, Play, Loader2, AlertTriangle, User } from 'lucide-react';

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
  order_value: number | null;
  notes: string | null;
  external_order_number: string | null;
  assigned_to: string | null;
  created_at: string;
  work_order_items?: Array<{ id: string; status: string; product_type: string | null }>;
}

interface WorkOrderDetailDialogProps {
  workOrderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange?: () => void;
}

const WorkOrderDetailDialog: React.FC<WorkOrderDetailDialogProps> = ({
  workOrderId,
  open,
  onOpenChange,
  onStatusChange,
}) => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);

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
          work_order_items(id, status, product_type)
        `)
        .eq('id', workOrderId)
        .single();

      if (error) throw error;
      setWorkOrder(data);
    } catch (error) {
      console.error('Error fetching work order:', error);
    } finally {
      setLoading(false);
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

  const handleOpenProduction = () => {
    onOpenChange(false);
    navigate(`/production?workOrder=${workOrder?.id}`);
  };

  // Check if work order has no assignments
  const isUnassigned = !workOrder?.assigned_to;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : workOrder ? (
          <>
            <DialogHeader className="px-6 pt-6 pb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <DialogTitle className="font-mono text-xl">{workOrder.wo_number}</DialogTitle>
                  <WorkOrderStatusBadge status={workOrder.status} />
                </div>
                <Button onClick={handleOpenProduction} size="sm">
                  <Play className="h-4 w-4 mr-1.5" />
                  {language === 'nl' ? 'Productie' : 'Production'}
                </Button>
              </div>
              <DialogDescription className="flex items-center gap-2">
                {workOrder.customer_name || (language === 'nl' ? 'Geen klant opgegeven' : 'No customer specified')}
                {isUnassigned && (
                  <Badge variant="outline" className="gap-1 text-warning border-warning/50">
                    <AlertTriangle className="h-3 w-3" />
                    {language === 'nl' ? 'Niet toegewezen' : 'Unassigned'}
                  </Badge>
                )}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[calc(90vh-180px)]">
              <div className="px-6 pb-6 space-y-5">
                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{language === 'nl' ? 'Voortgang' : 'Progress'}</span>
                    <span className="font-medium font-mono">{progress.completed}/{progress.total} ({progress.percent}%)</span>
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
                    <Badge variant="outline" className="font-mono">{formatProductType(workOrder.product_type)}</Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      {language === 'nl' ? 'Orderwaarde' : 'Order Value'}
                    </div>
                    <p className="font-medium font-mono">
                      {workOrder.order_value 
                        ? `€${workOrder.order_value.toLocaleString('nl-NL')}` 
                        : '-'}
                    </p>
                  </div>
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
                    <span className="text-muted-foreground">{language === 'nl' ? 'Extern ordernr' : 'External Order'}: </span>
                    <span className="font-medium font-mono">{workOrder.external_order_number}</span>
                  </div>
                )}

                {workOrder.notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">{language === 'nl' ? 'Notities' : 'Notes'}: </span>
                    <span>{workOrder.notes}</span>
                  </div>
                )}

                <Separator />

                {/* Step-Based Assignment Panel */}
                <StepAssignmentPanel
                  workOrderId={workOrder.id}
                  productType={workOrder.product_type}
                  scheduledDate={workOrder.scheduled_date || workOrder.start_date}
                  onAssignmentChange={() => {
                    fetchWorkOrder();
                    onStatusChange?.();
                  }}
                />
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {language === 'nl' ? 'Werkorder niet gevonden' : 'Work order not found'}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WorkOrderDetailDialog;
