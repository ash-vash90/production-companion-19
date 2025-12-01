import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stepExecution: any;
  productionStep: any;
  onComplete: () => void;
}

const ChecklistDialog: React.FC<ChecklistDialogProps> = ({
  open,
  onOpenChange,
  stepExecution,
  productionStep,
  onComplete,
}) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [operatorInitials, setOperatorInitials] = useState<string>('');
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [responses, setResponses] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && productionStep) {
      fetchChecklistItems();
    }
  }, [open, productionStep]);

  const fetchChecklistItems = async () => {
    try {
      const { data, error } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('production_step_id', productionStep.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setChecklistItems(data || []);

      // Check for existing responses
      const { data: existingResponses } = await supabase
        .from('checklist_responses')
        .select('*')
        .eq('step_execution_id', stepExecution.id);

      if (existingResponses) {
        const responseMap: Record<string, boolean> = {};
        existingResponses.forEach(r => {
          responseMap[r.checklist_item_id] = r.checked;
        });
        setResponses(responseMap);
      }
    } catch (error) {
      console.error('Error fetching checklist items:', error);
      toast.error('Error', { description: 'Failed to load checklist' });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckItem = (itemId: string, checked: boolean) => {
    setResponses(prev => ({ ...prev, [itemId]: checked }));
  };

  const handleSave = async () => {
    if (!operatorInitials) {
      toast.error('Error', { description: 'Please select operator initials' });
      return;
    }

    // Check if all required items are checked
    const allRequiredChecked = checklistItems
      .filter(item => item.required)
      .every(item => responses[item.id] === true);

    if (!allRequiredChecked) {
      toast.error('Error', { description: 'Please complete all required checklist items' });
      return;
    }

    setSaving(true);
    try {
      // Save or update checklist responses
      const responsesToSave = checklistItems.map(item => ({
        step_execution_id: stepExecution.id,
        checklist_item_id: item.id,
        checked: responses[item.id] || false,
        checked_by: user?.id,
        checked_at: new Date().toISOString(),
      }));

      // Delete existing responses
      await supabase
        .from('checklist_responses')
        .delete()
        .eq('step_execution_id', stepExecution.id);

      // Insert new responses
      const { error: responseError } = await supabase
        .from('checklist_responses')
        .insert(responsesToSave);

      if (responseError) throw responseError;

      // Update step execution with operator initials
      const { error: execError } = await supabase
        .from('step_executions')
        .update({
          operator_initials: operatorInitials as 'MB' | 'HL' | 'AB' | 'EV',
        })
        .eq('id', stepExecution.id);

      if (execError) throw execError;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'complete_checklist',
        entity_type: 'step_execution',
        entity_id: stepExecution.id,
        details: { operator: operatorInitials, items_checked: Object.values(responses).filter(Boolean).length },
      });

      toast.success('Success', { description: 'Checklist saved successfully' });
      onComplete();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving checklist:', error);
      toast.error('Error', { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Checklist</DialogTitle>
          <DialogDescription>
            Review and check all items in the production checklist
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="operator">Operator Initials *</Label>
            <Select value={operatorInitials} onValueChange={setOperatorInitials}>
              <SelectTrigger>
                <SelectValue placeholder="Select operator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MB">MB</SelectItem>
                <SelectItem value="HL">HL</SelectItem>
                <SelectItem value="AB">AB</SelectItem>
                <SelectItem value="EV">EV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading checklist...</div>
          ) : checklistItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No checklist items found</div>
          ) : (
            <div className="space-y-3">
              {checklistItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    responses[item.id] ? 'bg-accent/50 border-primary' : 'border-border'
                  }`}
                >
                  <Checkbox
                    id={item.id}
                    checked={responses[item.id] || false}
                    onCheckedChange={(checked) => handleCheckItem(item.id, checked as boolean)}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={item.id}
                      className="cursor-pointer text-sm font-medium leading-relaxed"
                    >
                      {language === 'nl' ? item.item_text_nl : item.item_text_en}
                      {item.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving...' : 'Save Checklist'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChecklistDialog;
