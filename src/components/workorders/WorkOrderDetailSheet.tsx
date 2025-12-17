import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatProductType } from '@/lib/utils';
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge';
import OperatorAssignmentPanel from './OperatorAssignmentPanel';
import { Package, Calendar, Truck, DollarSign, User, Play, Loader2 } from 'lucide-react';

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
  work_order_items?: Array<{ id: string; status: string }>;
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
          work_order_items(id, status)
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
                <WorkOrderStatusBadge status={workOrder.status} />
              </div>
              <SheetDescription>
                {workOrder.customer_name || 'No customer specified'}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{progress.completed}/{progress.total} items ({progress.percent}%)</span>
                </div>
                <Progress value={progress.percent} className="h-2" />
              </div>

              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Package className="h-3.5 w-3.5" />
                    Product Type
                  </div>
                  <Badge variant="outline">{formatProductType(workOrder.product_type)}</Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    Order Value
                  </div>
                  <p className="font-medium">
                    {workOrder.order_value 
                      ? `€${workOrder.order_value.toLocaleString('nl-NL')}` 
                      : '-'}
                  </p>
                </div>
                {workOrder.start_date && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      Start Date
                    </div>
                    <p className="font-medium">{formatDate(workOrder.start_date)}</p>
                  </div>
                )}
                {workOrder.shipping_date && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Truck className="h-3.5 w-3.5" />
                      Ship Date
                    </div>
                    <p className="font-medium">{formatDate(workOrder.shipping_date)}</p>
                  </div>
                )}
              </div>

              {workOrder.external_order_number && (
                <div className="text-sm">
                  <span className="text-muted-foreground">External Order: </span>
                  <span className="font-medium">{workOrder.external_order_number}</span>
                </div>
              )}

              {workOrder.notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Notes: </span>
                  <span>{workOrder.notes}</span>
                </div>
              )}

              <Separator />

              {/* Operator Assignment Panel */}
              <OperatorAssignmentPanel
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
                    navigate(`/production?workOrder=${workOrder.id}`);
                  }}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Open Production
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Work order not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default WorkOrderDetailSheet;
