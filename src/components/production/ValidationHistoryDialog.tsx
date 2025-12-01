import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface ValidationHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderItemId: string;
  serialNumber: string;
}

const ValidationHistoryDialog = ({ open, onOpenChange, workOrderItemId, serialNumber }: ValidationHistoryDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [executions, setExecutions] = useState<any[]>([]);

  useEffect(() => {
    if (open && workOrderItemId) {
      fetchValidationHistory();
    }
  }, [open, workOrderItemId]);

  const fetchValidationHistory = async () => {
    setLoading(true);
    try {
      const { data: executionsData, error } = await supabase
        .from('step_executions')
        .select(`
          *,
          production_step:production_steps(title_en, step_number),
          executed_by_profile:profiles!step_executions_executed_by_fkey(full_name)
        `)
        .eq('work_order_item_id', workOrderItemId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExecutions(executionsData || []);
    } catch (error) {
      console.error('Error fetching validation history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string, validationStatus: string | null) => {
    if (validationStatus === 'failed') {
      return <XCircle className="h-5 w-5 text-destructive" />;
    }
    if (status === 'completed' && validationStatus === 'passed') {
      return <CheckCircle2 className="h-5 w-5 text-primary" />;
    }
    if (status === 'in_progress') {
      return <Clock className="h-5 w-5 text-warning" />;
    }
    return <AlertTriangle className="h-5 w-5 text-muted-foreground" />;
  };

  const getStatusBadge = (status: string, validationStatus: string | null) => {
    if (validationStatus === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    if (status === 'completed' && validationStatus === 'passed') {
      return <Badge variant="default">Passed</Badge>;
    }
    if (status === 'in_progress') {
      return <Badge variant="outline">In Progress</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="font-ui">Validation History - {serialNumber}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {executions.map((exec) => (
                <div
                  key={exec.id}
                  className="border rounded-lg p-4 space-y-3 bg-card"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(exec.status, exec.validation_status)}
                      <div>
                        <h4 className="font-semibold font-ui">
                          Step {exec.production_step?.step_number}: {exec.production_step?.title_en}
                        </h4>
                        <p className="text-sm text-muted-foreground font-data">
                          {exec.executed_by_profile?.full_name || 'Unknown'} • {exec.operator_initials || 'N/A'}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(exec.status, exec.validation_status)}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Started:</span>
                      <p className="font-medium font-data">
                        {exec.started_at ? format(new Date(exec.started_at), 'PPp') : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Completed:</span>
                      <p className="font-medium font-data">
                        {exec.completed_at ? format(new Date(exec.completed_at), 'PPp') : 'In Progress'}
                      </p>
                    </div>
                  </div>

                  {exec.measurement_values && Object.keys(exec.measurement_values).length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-semibold text-muted-foreground font-ui">Measurements:</h5>
                      <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 p-3 rounded">
                        {Object.entries(exec.measurement_values).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-muted-foreground font-data">{key}:</span>
                            <span className="font-medium font-data">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {exec.validation_message && (
                    <div className={`p-3 rounded text-sm ${
                      exec.validation_status === 'failed' 
                        ? 'bg-destructive/10 text-destructive' 
                        : 'bg-primary/10 text-primary'
                    }`}>
                      <p className="font-medium font-data">{exec.validation_message}</p>
                    </div>
                  )}

                  {exec.batch_number && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Batch Number:</span>
                      <span className="ml-2 font-medium font-mono">{exec.batch_number}</span>
                    </div>
                  )}

                  {exec.notes && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Notes:</span>
                      <p className="mt-1 font-data">{exec.notes}</p>
                    </div>
                  )}

                  {exec.retry_count && exec.retry_count > 0 && (
                    <div className="flex items-center gap-2 text-sm text-warning">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-data">Retry attempt #{exec.retry_count}</span>
                    </div>
                  )}
                </div>
              ))}

              {executions.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="font-data">No validation history found</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ValidationHistoryDialog;
