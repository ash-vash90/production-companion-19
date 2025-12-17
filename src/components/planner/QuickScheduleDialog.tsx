import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';

interface QuickScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: string;
  woNumber: string;
  onScheduled: () => void;
}

const QuickScheduleDialog: React.FC<QuickScheduleDialogProps> = ({
  open,
  onOpenChange,
  workOrderId,
  woNumber,
  onScheduled,
}) => {
  const { language } = useLanguage();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [saving, setSaving] = useState(false);

  const handleSchedule = async () => {
    if (!selectedDate) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ start_date: format(selectedDate, 'yyyy-MM-dd') })
        .eq('id', workOrderId);

      if (error) throw error;

      toast.success(
        language === 'nl' 
          ? `${woNumber} ingepland voor ${format(selectedDate, 'd MMMM yyyy')}`
          : `${woNumber} scheduled for ${format(selectedDate, 'MMMM d, yyyy')}`
      );
      onScheduled();
      onOpenChange(false);
    } catch (error) {
      console.error('Error scheduling work order:', error);
      toast.error(language === 'nl' ? 'Fout bij inplannen' : 'Error scheduling');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            {language === 'nl' ? 'Werkorder inplannen' : 'Schedule Work Order'}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            {language === 'nl' 
              ? `Kies een startdatum voor ${woNumber}`
              : `Choose a start date for ${woNumber}`
            }
          </p>
          
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border mx-auto"
            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {language === 'nl' ? 'Annuleren' : 'Cancel'}
          </Button>
          <Button onClick={handleSchedule} disabled={!selectedDate || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {language === 'nl' ? 'Inplannen' : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QuickScheduleDialog;
