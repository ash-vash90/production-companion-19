import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, addDays, differenceInDays } from 'date-fns';
import { CalendarDays, Loader2, Plus, Trash2, Palmtree, Stethoscope, GraduationCap, HelpCircle, CalendarRange, Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';

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

interface DateRangeAvailabilityPickerProps {
  userId: string;
  canEdit: boolean;
}

const REASON_TYPES = [
  { value: 'holiday', label: 'Holiday', labelNl: 'Vakantie', icon: Palmtree, color: 'bg-sky-500', textColor: 'text-sky-600 dark:text-sky-400' },
  { value: 'sick', label: 'Sick Leave', labelNl: 'Ziek', icon: Stethoscope, color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400' },
  { value: 'training', label: 'Training', labelNl: 'Training', icon: GraduationCap, color: 'bg-purple-500', textColor: 'text-purple-600 dark:text-purple-400' },
  { value: 'other', label: 'Other', labelNl: 'Anders', icon: HelpCircle, color: 'bg-gray-500', textColor: 'text-gray-600 dark:text-gray-400' },
];

const DateRangeAvailabilityPicker: React.FC<DateRangeAvailabilityPickerProps> = ({ userId, canEdit }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectionMode, setSelectionMode] = useState<'single' | 'range'>('range');
  
  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [reasonType, setReasonType] = useState('holiday');
  const [reason, setReason] = useState('');
  const [availableHours, setAvailableHours] = useState('0');

  useEffect(() => {
    fetchAvailability();
  }, [userId, currentMonth]);

  const fetchAvailability = async () => {
    setLoading(true);
    try {
      // Fetch 3 months of data for better visibility
      const start = format(startOfMonth(addDays(currentMonth, -31)), 'yyyy-MM-dd');
      const end = format(endOfMonth(addDays(currentMonth, 62)), 'yyyy-MM-dd');

      const { data, error } = await (supabase
        .from('operator_availability' as any)
        .select('*')
        .eq('user_id', userId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true }) as any);

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

  const openAddDialog = () => {
    setSelectedDate(undefined);
    setDateRange(undefined);
    setReasonType('holiday');
    setReason('');
    setAvailableHours('0');
    setDialogOpen(true);
  };

  const handleSaveRange = async () => {
    if (!user) return;
    
    let datesToSave: Date[] = [];
    
    if (selectionMode === 'single' && selectedDate) {
      datesToSave = [selectedDate];
    } else if (selectionMode === 'range' && dateRange?.from) {
      const endDate = dateRange.to || dateRange.from;
      datesToSave = eachDayOfInterval({ start: dateRange.from, end: endDate });
    }

    if (datesToSave.length === 0) {
      toast.error(language === 'nl' ? 'Selecteer een datum' : 'Please select a date');
      return;
    }

    setSaving(true);
    try {
      // Delete existing entries for these dates first
      const dateStrings = datesToSave.map(d => format(d, 'yyyy-MM-dd'));
      
      await (supabase
        .from('operator_availability' as any)
        .delete()
        .eq('user_id', userId)
        .in('date', dateStrings) as any);

      // Insert new entries
      const entries = datesToSave.map(date => ({
        user_id: userId,
        date: format(date, 'yyyy-MM-dd'),
        available_hours: parseFloat(availableHours) || 0,
        reason: reason || null,
        reason_type: reasonType,
        created_by: user.id,
      }));

      const { error } = await (supabase
        .from('operator_availability' as any)
        .insert(entries) as any);
      
      if (error) throw error;

      const daysText = datesToSave.length === 1 
        ? (language === 'nl' ? '1 dag' : '1 day')
        : (language === 'nl' ? `${datesToSave.length} dagen` : `${datesToSave.length} days`);
      
      toast.success(language === 'nl' ? `${daysText} toegevoegd` : `${daysText} added`);
      fetchAvailability();
      setDialogOpen(false);
    } catch (error: any) {
      console.error('Error saving availability:', error);
      toast.error(error.message || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (entry: AvailabilityEntry) => {
    try {
      const { error } = await (supabase
        .from('operator_availability' as any)
        .delete()
        .eq('id', entry.id) as any);
      
      if (error) throw error;
      
      toast.success(language === 'nl' ? 'Verwijderd' : 'Removed');
      fetchAvailability();
    } catch (error: any) {
      console.error('Error deleting availability:', error);
      toast.error(error.message || 'Failed to delete');
    }
  };

  // Group consecutive dates for display
  const groupedAvailability = React.useMemo(() => {
    if (availability.length === 0) return [];
    
    const sorted = [...availability].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const groups: { 
      entries: AvailabilityEntry[]; 
      startDate: Date; 
      endDate: Date; 
      reasonType: string;
      reason: string | null;
    }[] = [];
    
    let currentGroup: AvailabilityEntry[] = [];
    
    sorted.forEach((entry, index) => {
      const entryDate = new Date(entry.date);
      const prevEntry = sorted[index - 1];
      
      if (currentGroup.length === 0) {
        currentGroup.push(entry);
      } else {
        const prevDate = new Date(prevEntry.date);
        const daysDiff = differenceInDays(entryDate, prevDate);
        
        // Group if consecutive day and same reason type
        if (daysDiff === 1 && entry.reason_type === prevEntry.reason_type) {
          currentGroup.push(entry);
        } else {
          // Finish current group and start new one
          groups.push({
            entries: currentGroup,
            startDate: new Date(currentGroup[0].date),
            endDate: new Date(currentGroup[currentGroup.length - 1].date),
            reasonType: currentGroup[0].reason_type,
            reason: currentGroup[0].reason,
          });
          currentGroup = [entry];
        }
      }
    });
    
    // Don't forget the last group
    if (currentGroup.length > 0) {
      groups.push({
        entries: currentGroup,
        startDate: new Date(currentGroup[0].date),
        endDate: new Date(currentGroup[currentGroup.length - 1].date),
        reasonType: currentGroup[0].reason_type,
        reason: currentGroup[0].reason,
      });
    }
    
    return groups;
  }, [availability]);

  // Calendar modifiers
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

  const selectedDaysCount = selectionMode === 'range' && dateRange?.from
    ? dateRange.to 
      ? differenceInDays(dateRange.to, dateRange.from) + 1
      : 1
    : selectedDate ? 1 : 0;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5" />
              {language === 'nl' ? 'Beschikbaarheid' : 'Availability'}
            </CardTitle>
            <CardDescription>
              {canEdit 
                ? (language === 'nl' ? 'Beheer je vrije dagen en beschikbaarheid' : 'Manage your time off and availability')
                : (language === 'nl' ? 'Bekijk geplande afwezigheid' : 'View scheduled time off')
              }
            </CardDescription>
          </div>
          {canEdit && (
            <Button onClick={openAddDialog} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              {language === 'nl' ? 'Toevoegen' : 'Add'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Calendar
              mode="single"
              selected={undefined}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              className="rounded-md border"
              disabled={!canEdit}
            />
            
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-destructive/20 border border-destructive/30" />
                <span className="text-muted-foreground">
                  {language === 'nl' ? 'Afwezig' : 'Unavailable'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30" />
                <span className="text-muted-foreground">
                  {language === 'nl' ? 'Gedeeltelijk' : 'Partial'}
                </span>
              </div>
            </div>

            {/* Grouped time off list */}
            {groupedAvailability.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">
                  {language === 'nl' ? 'Geplande Afwezigheid' : 'Scheduled Time Off'}
                </h4>
                <div className="space-y-2">
                  {groupedAvailability.map((group, index) => {
                    const typeInfo = REASON_TYPES.find(r => r.value === group.reasonType);
                    const Icon = typeInfo?.icon || HelpCircle;
                    const isSingleDay = isSameDay(group.startDate, group.endDate);
                    const daysCount = group.entries.length;
                    
                    return (
                      <div 
                        key={index} 
                        className="flex items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-full ${typeInfo?.color || 'bg-gray-500'} text-white`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {isSingleDay 
                                  ? format(group.startDate, 'EEE, MMM d')
                                  : `${format(group.startDate, 'MMM d')} - ${format(group.endDate, 'MMM d')}`
                                }
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {daysCount === 1 
                                  ? (language === 'nl' ? '1 dag' : '1 day')
                                  : (language === 'nl' ? `${daysCount} dagen` : `${daysCount} days`)
                                }
                              </Badge>
                            </div>
                            <p className={`text-xs ${typeInfo?.textColor || 'text-muted-foreground'}`}>
                              {language === 'nl' ? typeInfo?.labelNl : typeInfo?.label}
                              {group.reason && ` • ${group.reason}`}
                            </p>
                          </div>
                        </div>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Delete all entries in this group
                              group.entries.forEach(entry => handleDeleteEntry(entry));
                            }}
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {language === 'nl' ? 'Afwezigheid Toevoegen' : 'Add Time Off'}
              </DialogTitle>
              <DialogDescription>
                {language === 'nl' 
                  ? 'Selecteer een dag of periode' 
                  : 'Select a single day or date range'
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              {/* Selection mode tabs */}
              <Tabs value={selectionMode} onValueChange={(v) => setSelectionMode(v as 'single' | 'range')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="single" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {language === 'nl' ? 'Enkele dag' : 'Single Day'}
                  </TabsTrigger>
                  <TabsTrigger value="range" className="gap-2">
                    <CalendarRange className="h-4 w-4" />
                    {language === 'nl' ? 'Periode' : 'Date Range'}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="single" className="mt-4">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border mx-auto"
                  />
                </TabsContent>

                <TabsContent value="range" className="mt-4">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={1}
                    className="rounded-md border mx-auto"
                  />
                </TabsContent>
              </Tabs>

              {selectedDaysCount > 0 && (
                <p className="text-sm text-center text-muted-foreground">
                  {selectedDaysCount === 1 
                    ? (language === 'nl' ? '1 dag geselecteerd' : '1 day selected')
                    : (language === 'nl' ? `${selectedDaysCount} dagen geselecteerd` : `${selectedDaysCount} days selected`)
                  }
                </p>
              )}

              <div className="space-y-2">
                <Label>{language === 'nl' ? 'Type' : 'Type'}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {REASON_TYPES.map(type => {
                    const Icon = type.icon;
                    const isSelected = reasonType === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setReasonType(type.value)}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          isSelected 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-muted-foreground/50'
                        }`}
                      >
                        <div className={`p-1.5 rounded-full ${type.color} text-white`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm font-medium">
                          {language === 'nl' ? type.labelNl : type.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{language === 'nl' ? 'Beschikbare uren (0 = volledig afwezig)' : 'Available hours (0 = fully unavailable)'}</Label>
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
                <Label>{language === 'nl' ? 'Opmerking (optioneel)' : 'Note (optional)'}</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={language === 'nl' ? 'bijv. Vakantie Spanje' : 'e.g., Summer vacation'}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                {language === 'nl' ? 'Annuleren' : 'Cancel'}
              </Button>
              <Button onClick={handleSaveRange} disabled={saving || selectedDaysCount === 0}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {language === 'nl' ? 'Opslaan' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default DateRangeAvailabilityPicker;
