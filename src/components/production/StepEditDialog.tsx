import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { Loader2, Save, Edit2 } from 'lucide-react';

interface StepEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderItemId: string;
  stepNumber: number;
  productType: string;
  onSave?: () => void;
}

const StepEditDialog = ({ 
  open, 
  onOpenChange, 
  workOrderItemId, 
  stepNumber, 
  productType,
  onSave 
}: StepEditDialogProps) => {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stepData, setStepData] = useState<any>(null);
  const [execution, setExecution] = useState<any>(null);
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [checklistResponses, setChecklistResponses] = useState<Record<string, boolean>>({});

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
      
      // Set measurement values
      if (execData?.measurement_values) {
        const values: Record<string, string> = {};
        Object.entries(execData.measurement_values).forEach(([key, value]) => {
          values[key] = String(value);
        });
        setMeasurementValues(values);
      }

      // If step has checklist, fetch items and responses
      if (step.has_checklist && execData) {
        const { data: items } = await supabase
          .from('checklist_items')
          .select('*')
          .eq('production_step_id', step.id)
          .order('sort_order', { ascending: true });

        const { data: responses } = await supabase
          .from('checklist_responses')
          .select('*')
          .eq('step_execution_id', execData.id);

        if (items) {
          setChecklistItems(items);
          const resps: Record<string, boolean> = {};
          items.forEach(item => {
            const resp = responses?.find(r => r.checklist_item_id === item.id);
            resps[item.id] = resp?.checked || false;
          });
          setChecklistResponses(resps);
        }
      }
    } catch (error) {
      console.error('Error fetching step details:', error);
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!execution) return;
    
    setSaving(true);
    try {
      // Update measurement values
      if (Object.keys(measurementValues).length > 0) {
        const { error: execError } = await supabase
          .from('step_executions')
          .update({ measurement_values: measurementValues })
          .eq('id', execution.id);

        if (execError) throw execError;
      }

      // Update checklist responses
      if (checklistItems.length > 0) {
        for (const item of checklistItems) {
          const { data: existing } = await supabase
            .from('checklist_responses')
            .select('id')
            .eq('step_execution_id', execution.id)
            .eq('checklist_item_id', item.id)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('checklist_responses')
              .update({ checked: checklistResponses[item.id] || false })
              .eq('id', existing.id);
          }
        }
      }

      toast.success(language === 'nl' ? 'Wijzigingen opgeslagen' : 'Changes saved');
      onOpenChange(false);
      if (onSave) onSave();
    } catch (error: any) {
      console.error('Error saving step data:', error);
      toast.error(t('error'), { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const getChecklistText = (item: any) => {
    return language === 'nl' ? item.item_text_nl : item.item_text_en;
  };

  const getStepTitle = () => {
    if (!stepData) return '';
    return language === 'nl' ? stepData.title_nl : stepData.title_en;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5" />
            <span>{language === 'nl' ? 'Bewerk' : 'Edit'} {t('step')} {stepNumber}: {getStepTitle()}</span>
          </DialogTitle>
          <DialogDescription>
            {language === 'nl' ? 'Pas de geregistreerde gegevens aan' : 'Modify the recorded step data'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !execution ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>{language === 'nl' ? 'Geen gegevens gevonden' : 'No data found'}</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[55vh] pr-4">
            <div className="space-y-4">
              {/* Measurement Values */}
              {Object.keys(measurementValues).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">
                    {language === 'nl' ? 'Metingen' : 'Measurements'}
                  </h4>
                  {Object.entries(measurementValues).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <Label htmlFor={key}>{key}</Label>
                      <Input
                        id={key}
                        value={value}
                        onChange={(e) => setMeasurementValues(prev => ({
                          ...prev,
                          [key]: e.target.value
                        }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Checklist Items */}
              {checklistItems.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">{t('checklist')}</h4>
                  {checklistItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-2 rounded border">
                      <Checkbox
                        id={item.id}
                        checked={checklistResponses[item.id] || false}
                        onCheckedChange={(checked) => setChecklistResponses(prev => ({
                          ...prev,
                          [item.id]: checked === true
                        }))}
                      />
                      <label htmlFor={item.id} className="text-sm cursor-pointer">
                        {getChecklistText(item)}
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {/* Save Button */}
              <div className="pt-3 border-t">
                <Button 
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {language === 'nl' ? 'Wijzigingen opslaan' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StepEditDialog;