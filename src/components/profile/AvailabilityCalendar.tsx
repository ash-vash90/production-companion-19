import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { CalendarDays, Loader2, Plus, Trash2, Palmtree, Stethoscope, GraduationCap, HelpCircle } from 'lucide-react';

interface AvailabilityEntry {
  id: string;
  user_id: string;
  date: string;
  available_hours: number;
  reason: string | null;
  reason_type: string;
  created_by: string;
  created_at: string;
}

interface AvailabilityCalendarProps {
  userId: string;
  canEdit: boolean;
}

const REASON_TYPES = [
  { value: 'holiday', label: 'Holiday', icon: Palmtree, color: 'bg-blue-500' },
  { value: 'sick', label: 'Sick Leave', icon: Stethoscope, color: 'bg-red-500' },
  { value: 'training', label: 'Training', icon: GraduationCap, color: 'bg-purple-500' },
  { value: 'other', label: 'Other', icon: HelpCircle, color: 'bg-gray-500' },
];

const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({ userId, canEdit }) => {
  const { user } = useAuth();
  const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Form state
  const [reasonType, setReasonType] = useState('holiday');
  const [reason, setReason] = useState('');
  const [availableHours, setAvailableHours] = useState('0');

  useEffect(() => {
    fetchAvailability();
  }, [userId, currentMonth]);

  const fetchAvailability = async () => {
    setLoading(true);
    try {
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const { data, error } = await (supabase
        .from('operator_availability' as any)
        .select('*')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', end) as any);

      if (error) throw error;
      setAvailability((data as AvailabilityEntry[]) || []);
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailabilityForDate = (date: Date): AvailabilityEntry | undefined => {
    return availability.find(a => isSameDay(new Date(a.date), date));
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date || !canEdit) return;
    setSelectedDate(date);
    
    const existing = getAvailabilityForDate(date);
    if (existing) {
      setReasonType(existing.reason_type || 'holiday');
      setReason(existing.reason || '');
      setAvailableHours(existing.available_hours.toString());
    } else {
      setReasonType('holiday');
      setReason('');
      setAvailableHours('0');
    }
    
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedDate || !user) return;
    
    setSaving(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const existing = getAvailabilityForDate(selectedDate);

      if (existing) {
        // Update existing
        const { error } = await (supabase
          .from('operator_availability' as any)
          .update({
            available_hours: parseFloat(availableHours) || 0,
            reason: reason || null,
            reason_type: reasonType,
          })
          .eq('id', existing.id) as any);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await (supabase
          .from('operator_availability' as any)
          .insert({
            user_id: userId,
            date: dateStr,
            available_hours: parseFloat(availableHours) || 0,
            reason: reason || null,
            reason_type: reasonType,
            created_by: user.id,
          }) as any);
        
        if (error) throw error;
      }

      toast.success('Availability updated');
      fetchAvailability();
      setDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving availability:', error);
      toast.error(error.message || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDate) return;
    
    const existing = getAvailabilityForDate(selectedDate);
    if (!existing) return;

    setSaving(true);
    try {
      const { error } = await (supabase
        .from('operator_availability' as any)
        .delete()
        .eq('id', existing.id) as any);
      
      if (error) throw error;
      
      toast.success('Availability entry removed');
      fetchAvailability();
      setDialogOpen(false);
    } catch (error: any) {
      console.error('Error deleting availability:', error);
      toast.error(error.message || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  // Custom day renderer for calendar
  const modifiers = {
    unavailable: availability.filter(a => a.available_hours === 0).map(a => new Date(a.date)),
    partial: availability.filter(a => a.available_hours > 0 && a.available_hours < 8).map(a => new Date(a.date)),
  };

  const modifiersStyles = {
    unavailable: {
      backgroundColor: 'hsl(var(--destructive) / 0.2)',
      color: 'hsl(var(--destructive))',
    },
    partial: {
      backgroundColor: 'hsl(45 93% 47% / 0.2)',
      color: 'hsl(45 93% 47%)',
    },
  };

  const existingEntry = selectedDate ? getAvailabilityForDate(selectedDate) : undefined;
  const reasonTypeInfo = REASON_TYPES.find(r => r.value === reasonType);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="h-5 w-5" />
          Availability Calendar
        </CardTitle>
        <CardDescription>
          {canEdit ? 'Click on a date to mark unavailability or reduced hours' : 'View scheduled time off and availability'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={canEdit ? handleDateSelect : undefined}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              className="rounded-md border"
            />
            
            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-destructive/20 border border-destructive/30" />
                <span className="text-muted-foreground">Unavailable</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30" />
                <span className="text-muted-foreground">Partial</span>
              </div>
            </div>

            {/* Upcoming time off */}
            {availability.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium">This Month's Time Off</h4>
                <div className="space-y-1.5">
                  {availability.map(entry => {
                    const typeInfo = REASON_TYPES.find(r => r.value === entry.reason_type);
                    const Icon = typeInfo?.icon || HelpCircle;
                    return (
                      <div key={entry.id} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{format(new Date(entry.date), 'MMM d')}</span>
                        <Badge variant="outline" className="text-xs">
                          {entry.available_hours === 0 ? 'Off' : `${entry.available_hours}h`}
                        </Badge>
                        {entry.reason && (
                          <span className="text-muted-foreground truncate">{entry.reason}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </DialogTitle>
              <DialogDescription>
                Set availability for this date
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Reason Type</Label>
                <Select value={reasonType} onValueChange={setReasonType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REASON_TYPES.map(type => {
                      const Icon = type.icon;
                      return (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Available Hours (0 = fully unavailable)</Label>
                <Input
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                  value={availableHours}
                  onChange={(e) => setAvailableHours(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Doctor's appointment"
                />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              {existingEntry && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={saving}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              )}
              <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving} className="flex-1 sm:flex-none">
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AvailabilityCalendar;
