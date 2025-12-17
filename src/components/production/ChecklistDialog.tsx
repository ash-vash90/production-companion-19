import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [responses, setResponses] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name: string } | null>(null);

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setUserProfile(data));
    }
  }, [user]);

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
      toast.error('Failed to load checklist', { description: 'Please try again' });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckItem = (itemId: string, checked: boolean) => {
    setResponses(prev => ({ ...prev, [itemId]: checked }));
  };

  const handleSave = async () => {
    // Check if all required items are checked
    const allRequiredChecked = checklistItems
      .filter(item => item.required)
      .every(item => responses[item.id] === true);

    if (!allRequiredChecked) {
      toast.warning('Incomplete checklist', { description: 'Please check all required items before saving' });
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

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'complete_checklist',
        entity_type: 'step_execution',
        entity_id: stepExecution.id,
        details: { operator: userProfile?.full_name, items_checked: Object.values(responses).filter(Boolean).length },
      });

      const checkedCount = Object.values(responses).filter(Boolean).length;
      toast.success('Checklist completed', { description: `${checkedCount} of ${checklistItems.length} items checked` });
      onComplete();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving checklist:', error);
      toast.error('Failed to save checklist', { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-ui">Complete Checklist</DialogTitle>
          <DialogDescription className="text-base">
            Review and check all items in the production checklist
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Show current operator */}
          {userProfile && (
            <div className="p-3 bg-accent/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">Recording as:</p>
              <p className="font-semibold">{userProfile.full_name}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-base">Loading checklist...</div>
          ) : checklistItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-base border rounded-lg">No checklist items found</div>
          ) : (
            <div className="space-y-3">
              {checklistItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-all ${
                    responses[item.id] ? 'bg-accent/50 border-primary' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Checkbox
                    id={item.id}
                    checked={responses[item.id] || false}
                    onCheckedChange={(checked) => handleCheckItem(item.id, checked as boolean)}
                    className="mt-1 h-6 w-6"
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={item.id}
                      className="cursor-pointer text-base font-medium leading-relaxed"
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

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="lg" className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading} variant="default" size="lg" className="flex-1">
            {saving ? 'Saving...' : 'Save Checklist'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChecklistDialog;
