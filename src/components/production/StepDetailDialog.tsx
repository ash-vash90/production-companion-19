import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, CheckCircle2, XCircle, Package, ClipboardList, Edit2 } from 'lucide-react';
import { format } from 'date-fns';

interface StepDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderItemId: string;
  stepNumber: number;
  productType: string;
  onEdit?: () => void;
}

const StepDetailDialog = ({ 
  open, 
  onOpenChange, 
  workOrderItemId, 
  stepNumber, 
  productType,
  onEdit 
}: StepDetailDialogProps) => {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [stepData, setStepData] = useState<any>(null);
  const [execution, setExecution] = useState<any>(null);
  const [checklistResponses, setChecklistResponses] = useState<any[]>([]);
  const [batchMaterials, setBatchMaterials] = useState<any[]>([]);

  useEffect(() => {
    if (open && workOrderItemId && stepNumber) {
      fetchStepDetails();
    }
  }, [open, workOrderItemId, stepNumber]);

  const fetchStepDetails = async () => {
    setLoading(true);
    try {
      // Fetch the production step definition
      const { data: step, error: stepError } = await supabase
        .from('production_steps')
        .select('*')
        .eq('product_type', productType as 'SDM_ECO' | 'SENSOR' | 'MLA' | 'HMI' | 'TRANSMITTER')
        .eq('step_number', stepNumber)
        .single();

      if (stepError) throw stepError;
      setStepData(step);

      // Fetch the completed execution for this step
      const { data: execData, error: execError } = await supabase
        .from('step_executions')
        .select(`
          *,
          executed_by_profile:profiles!step_executions_executed_by_fkey(full_name, avatar_url)
        `)
        .eq('work_order_item_id', workOrderItemId)
        .eq('production_step_id', step.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (execError) throw execError;
      setExecution(execData);

      // If step has checklist, fetch responses
      if (step.has_checklist && execData) {
        const { data: checklistItems } = await supabase
          .from('checklist_items')
          .select('*')
          .eq('production_step_id', step.id)
          .order('sort_order', { ascending: true });

        const { data: responses } = await supabase
          .from('checklist_responses')
          .select('*')
          .eq('step_execution_id', execData.id);

        if (checklistItems && responses) {
          const merged = checklistItems.map(item => ({
            ...item,
            response: responses.find(r => r.checklist_item_id === item.id)
          }));
          setChecklistResponses(merged);
        }
      }

      // If step requires batch number, fetch batch materials
      if (step.requires_batch_number) {
        const { data: materials } = await supabase
          .from('batch_materials')
          .select('*')
          .eq('work_order_item_id', workOrderItemId)
          .eq('production_step_id', step.id);

        setBatchMaterials(materials || []);
      }
    } catch (error) {
      console.error('Error fetching step details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChecklistText = (item: any) => {
    return language === 'nl' ? item.item_text_nl : item.item_text_en;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-ui">
            <span>{t('step')} {stepNumber}: {stepData?.title_en || ''}</span>
            {execution?.validation_status === 'passed' && (
              <Badge variant="default" className="ml-2">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {t('passed') || 'Passed'}
              </Badge>
            )}
            {execution?.validation_status === 'failed' && (
              <Badge variant="destructive" className="ml-2">
                <XCircle className="h-3 w-3 mr-1" />
                {t('failed')}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {stepData?.description_en || t('stepDetailsDescription') || 'View the recorded data for this completed step'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Execution Info */}
              {execution && (
                <div className="p-4 bg-muted/30 rounded-lg border space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('completionDetails') || 'Completion Details'}
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('completedBy') || 'Completed by'}:</span>
                      <p className="font-medium font-data">
                        {execution.executed_by_profile?.full_name || 'Unknown'}
                        {execution.operator_initials && ` (${execution.operator_initials})`}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('completedAt') || 'Completed at'}:</span>
                      <p className="font-medium font-data">
                        {execution.completed_at 
                          ? format(new Date(execution.completed_at), 'dd/MM/yyyy HH:mm')
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Measurement Values */}
              {execution?.measurement_values && Object.keys(execution.measurement_values).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {t('measurements') || 'Measurements'}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(execution.measurement_values).map(([key, value]) => (
                      <div key={key} className="p-3 bg-accent/50 rounded-lg border">
                        <p className="text-xs text-muted-foreground font-data">{key}</p>
                        <p className="text-lg font-semibold font-data">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Validation Message */}
              {execution?.validation_message && (
                <div className={`p-4 rounded-lg border ${
                  execution.validation_status === 'failed'
                    ? 'bg-destructive/10 border-destructive/30'
                    : 'bg-primary/10 border-primary/30'
                }`}>
                  <h4 className="text-sm font-semibold mb-1">
                    {t('validationResult') || 'Validation Result'}
                  </h4>
                  <p className="text-sm font-data">{execution.validation_message}</p>
                </div>
              )}

              {/* Checklist Responses */}
              {checklistResponses.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    {t('checklist')}
                  </h4>
                  <div className="space-y-2">
                    {checklistResponses.map((item) => (
                      <div 
                        key={item.id} 
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          item.response?.checked 
                            ? 'bg-primary/10 border-primary/30' 
                            : 'bg-muted/30 border-border'
                        }`}
                      >
                        <div className={`h-5 w-5 rounded flex items-center justify-center ${
                          item.response?.checked 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted border-2 border-border'
                        }`}>
                          {item.response?.checked && <CheckCircle2 className="h-3 w-3" />}
                        </div>
                        <span className="text-sm font-data">{getChecklistText(item)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Batch Materials */}
              {batchMaterials.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('batchMaterials') || 'Batch Materials'}
                  </h4>
                  <div className="space-y-2">
                    {batchMaterials.map((material) => (
                      <div key={material.id} className="p-3 bg-accent/50 rounded-lg border">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium font-data">{material.material_type}</p>
                            <p className="text-xs text-muted-foreground font-mono">{material.batch_number}</p>
                          </div>
                          {material.opening_date && (
                            <p className="text-xs text-muted-foreground">
                              {t('opened') || 'Opened'}: {format(new Date(material.opening_date), 'dd/MM/yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {execution?.notes && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('notes')}
                  </h4>
                  <p className="text-sm font-data p-3 bg-muted/30 rounded-lg border">
                    {execution.notes}
                  </p>
                </div>
              )}

              {/* Edit Button - for admins/supervisors */}
              {onEdit && (
                <div className="pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      onOpenChange(false);
                      onEdit();
                    }}
                    className="w-full gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    {t('editStep') || 'Edit Step Data'}
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StepDetailDialog;
