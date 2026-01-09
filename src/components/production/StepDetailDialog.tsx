import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { Loader2, CheckCircle2, XCircle, Package, ClipboardList, Edit2, Eye } from 'lucide-react';
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
  const { isAdmin } = useUserProfile();
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
        .select('*')
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

  const getStepTitle = () => {
    if (!stepData) return '';
    return language === 'nl' ? stepData.title_nl : stepData.title_en;
  };

  const getStepDescription = () => {
    if (!stepData) return '';
    return language === 'nl' ? stepData.description_nl : stepData.description_en;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            <span>{t('step')} {stepNumber}: {getStepTitle()}</span>
          </DialogTitle>
          <DialogDescription>
            {getStepDescription() || (language === 'nl' ? 'Bekijk de geregistreerde gegevens voor deze stap' : 'View the recorded data for this completed step')}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !execution ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>{language === 'nl' ? 'Geen gegevens gevonden voor deze stap' : 'No data found for this step'}</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[55vh] pr-4">
            <div className="space-y-4">
              {/* Status & Completion Time */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">{language === 'nl' ? 'Voltooid op' : 'Completed at'}</p>
                  <p className="font-medium">
                    {execution.completed_at 
                      ? format(new Date(execution.completed_at), 'dd/MM/yyyy HH:mm')
                      : 'N/A'}
                  </p>
                </div>
                {execution.validation_status && (
                  <Badge variant={execution.validation_status === 'passed' ? 'default' : 'destructive'}>
                    {execution.validation_status === 'passed' ? (
                      <><CheckCircle2 className="h-3 w-3 mr-1" />{language === 'nl' ? 'Geslaagd' : 'Passed'}</>
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1" />{language === 'nl' ? 'Gefaald' : 'Failed'}</>
                    )}
                  </Badge>
                )}
              </div>

              {/* Measurement Values */}
              {execution?.measurement_values && Object.keys(execution.measurement_values).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {language === 'nl' ? 'Metingen' : 'Measurements'}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(execution.measurement_values).map(([key, value]) => (
                      <div key={key} className="p-2 bg-accent/50 rounded border">
                        <p className="text-xs text-muted-foreground">{key}</p>
                        <p className="font-semibold">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Validation Message */}
              {execution?.validation_message && (
                <div className={`p-3 rounded-lg border ${
                  execution.validation_status === 'failed'
                    ? 'bg-destructive/10 border-destructive/30'
                    : 'bg-primary/10 border-primary/30'
                }`}>
                  <p className="text-sm font-medium mb-1">{language === 'nl' ? 'Validatie resultaat' : 'Validation result'}</p>
                  <p className="text-sm">{execution.validation_message}</p>
                </div>
              )}

              {/* Checklist Responses */}
              {checklistResponses.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    {t('checklist')}
                  </h4>
                  <div className="space-y-1.5">
                    {checklistResponses.map((item) => (
                      <div 
                        key={item.id} 
                        className={`flex items-center gap-2 p-2 rounded border text-sm ${
                          item.response?.checked 
                            ? 'bg-primary/10 border-primary/30' 
                            : 'bg-muted/30'
                        }`}
                      >
                        <div className={`h-4 w-4 rounded flex items-center justify-center shrink-0 ${
                          item.response?.checked 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted border'
                        }`}>
                          {item.response?.checked && <CheckCircle2 className="h-3 w-3" />}
                        </div>
                        <span>{getChecklistText(item)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Batch Materials */}
              {batchMaterials.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">{language === 'nl' ? 'Batch materialen' : 'Batch Materials'}</h4>
                  <div className="space-y-1.5">
                    {batchMaterials.map((material) => (
                      <div key={material.id} className="p-2 bg-accent/50 rounded border text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">{material.material_type}</span>
                          <span className="text-xs font-semibold tabular-nums tracking-wide">{material.batch_number}</span>
                        </div>
                        {material.opening_date && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {language === 'nl' ? 'Geopend' : 'Opened'}: {format(new Date(material.opening_date), 'dd/MM/yyyy')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {execution?.notes && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">{t('notes')}</h4>
                  <p className="text-sm p-2 bg-muted/30 rounded border">{execution.notes}</p>
                </div>
              )}

              {/* Edit Button - for admins only */}
              {isAdmin && (
                <div className="pt-3 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      onOpenChange(false);
                      if (onEdit) onEdit();
                    }}
                    className="w-full gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    {language === 'nl' ? 'Gegevens bewerken' : 'Edit Step Data'}
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
