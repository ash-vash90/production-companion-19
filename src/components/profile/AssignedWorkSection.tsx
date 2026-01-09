import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { formatProductType } from '@/lib/utils';
import { Briefcase, Loader2, ArrowRight, Package, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface WorkOrderWithProgress {
  id: string;
  wo_number: string;
  product_type: string;
  customer_name: string | null;
  status: string;
  shipping_date: string | null;
  batch_size: number;
  completed_count: number;
  progress_percent: number;
}

interface AssignedWorkSectionProps {
  userId: string;
}

const AssignedWorkSection: React.FC<AssignedWorkSectionProps> = ({ userId }) => {
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState<WorkOrderWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssignedWork();
  }, [userId]);

  const fetchAssignedWork = async () => {
    setLoading(true);
    try {
      // Get work orders where user is assigned (either at WO level or item level)
      const { data: woData, error: woError } = await supabase
        .from('work_orders')
        .select(`
          id,
          wo_number,
          product_type,
          customer_name,
          status,
          shipping_date,
          batch_size,
          work_order_items(id, status)
        `)
        .eq('assigned_to', userId)
        .in('status', ['planned', 'in_progress', 'on_hold'])
        .order('shipping_date', { ascending: true, nullsFirst: false })
        .limit(10);

      if (woError) throw woError;

      // Also get work orders where items are assigned to user
      const { data: itemAssignments, error: itemError } = await supabase
        .from('work_order_items')
        .select(`
          work_order_id,
          work_order:work_orders(
            id,
            wo_number,
            product_type,
            customer_name,
            status,
            shipping_date,
            batch_size
          )
        `)
        .eq('assigned_to', userId)
        .neq('status', 'completed')
        .neq('status', 'cancelled');

      if (itemError) throw itemError;

      // Merge and deduplicate
      const woMap = new Map<string, WorkOrderWithProgress>();

      // Add directly assigned WOs
      (woData || []).forEach(wo => {
        const items = wo.work_order_items || [];
        const completedCount = items.filter((i: any) => i.status === 'completed').length;
        const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
        
        woMap.set(wo.id, {
          id: wo.id,
          wo_number: wo.wo_number,
          product_type: wo.product_type,
          customer_name: wo.customer_name,
          status: wo.status,
          shipping_date: wo.shipping_date,
          batch_size: wo.batch_size,
          completed_count: completedCount,
          progress_percent: progressPercent,
        });
      });

      // Add item-level assignments
      (itemAssignments || []).forEach((assignment: any) => {
        if (assignment.work_order && !woMap.has(assignment.work_order.id)) {
          const wo = assignment.work_order;
          woMap.set(wo.id, {
            id: wo.id,
            wo_number: wo.wo_number,
            product_type: wo.product_type,
            customer_name: wo.customer_name,
            status: wo.status,
            shipping_date: wo.shipping_date,
            batch_size: wo.batch_size,
            completed_count: 0,
            progress_percent: 0,
          });
        }
      });

      setWorkOrders(Array.from(woMap.values()));
    } catch (error) {
      console.error('Error fetching assigned work:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-blue-500/20 text-blue-700 dark:text-blue-400';
      case 'planned': return 'bg-gray-500/20 text-gray-700 dark:text-gray-400';
      case 'on_hold': return 'bg-amber-500/20 text-amber-700 dark:text-amber-400';
      default: return 'bg-gray-500/20 text-gray-700 dark:text-gray-400';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Briefcase className="h-5 w-5" />
          Assigned Work
        </CardTitle>
        <CardDescription>
          Active work orders and tasks
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : workOrders.length === 0 ? (
          <div className="text-center py-8 border rounded-lg border-dashed">
            <Briefcase className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-medium mb-1">No active assignments</h3>
            <p className="text-sm text-muted-foreground">
              No work orders are currently assigned
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {workOrders.map((wo) => (
              <div
                key={wo.id}
                className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/work-orders?highlight=${wo.id}`)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{wo.wo_number}</span>
                      <Badge variant="outline" className="text-xs">
                        {formatProductType(wo.product_type)}
                      </Badge>
                      <Badge className={`text-xs ${getStatusColor(wo.status)}`}>
                        {wo.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    {wo.customer_name && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">{wo.customer_name}</p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" />
                    <span>{wo.completed_count}/{wo.batch_size}</span>
                  </div>
                  {wo.shipping_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{format(new Date(wo.shipping_date), 'MMM d')}</span>
                    </div>
                  )}
                </div>
                
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={wo.progress_percent} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground">{wo.progress_percent}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AssignedWorkSection;
