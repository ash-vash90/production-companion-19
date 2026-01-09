import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon, CheckCircle2, Loader2, Users, X, UserPlus } from 'lucide-react';
import { cn, formatProductType } from '@/lib/utils';

interface WorkOrder {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  scheduled_date: string | null;
  start_date: string | null;
  customer_name: string | null;
}

interface Operator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  is_available: boolean;
}

interface Availability {
  user_id: string;
  available_hours: number;
  reason_type: string;
}

interface ProductAssignmentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder: WorkOrder | null;
  initialDate?: string | null;
  onComplete?: () => void;
}

const ProductAssignmentSheet: React.FC<ProductAssignmentSheetProps> = ({
  open,
  onOpenChange,
  workOrder,
  initialDate,
  onComplete,
}) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    initialDate ? new Date(initialDate) : undefined
  );
  const [availability, setAvailability] = useState<Map<string, Availability>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    if (open && workOrder) {
      fetchOperators();
      if (initialDate) {
        setSelectedDate(new Date(initialDate));
      } else if (workOrder.start_date) {
        setSelectedDate(new Date(workOrder.start_date));
      } else if (workOrder.scheduled_date) {
        setSelectedDate(new Date(workOrder.scheduled_date));
      } else {
        setSelectedDate(new Date());
      }
    }
  }, [open, workOrder, initialDate]);

  useEffect(() => {
    if (selectedDate) {
      fetchAvailability();
    }
  }, [selectedDate]);

  const fetchOperators = async () => {
    setLoading(true);
    try {
      // Fetch production team operators
      const { data: teamMembers } = await supabase
        .from('user_teams')
        .select('user_id, team:teams(name)')
        .eq('team.name', 'Production');

      const userIds = (teamMembers || []).map((tm: any) => tm.user_id);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, is_available')
        .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
        .order('full_name');

      setOperators(profilesData || []);
    } catch (error) {
      console.error('Error fetching operators:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailability = async () => {
    if (!selectedDate) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    try {
      const { data: availData } = await supabase
        .from('operator_availability')
        .select('user_id, available_hours, reason_type')
        .eq('date', dateStr);

      const availMap = new Map<string, Availability>();
      (availData || []).forEach((a: any) => {
        availMap.set(a.user_id, a);
      });
      setAvailability(availMap);
    } catch (error) {
      console.error('Error fetching availability:', error);
    }
  };

  const handleAssign = async () => {
    if (!workOrder || !selectedOperator || !selectedDate) return;
    
    setSaving(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // Create operator assignment
      await supabase
        .from('operator_assignments')
        .upsert({
          work_order_id: workOrder.id,
          operator_id: selectedOperator,
          assigned_date: dateStr,
        }, {
          onConflict: 'work_order_id,operator_id,assigned_date'
        });

      // Update work order
      await supabase
        .from('work_orders')
        .update({ 
          start_date: dateStr,
          assigned_to: selectedOperator,
        })
        .eq('id', workOrder.id);

      // Apply to the whole batch (all items in the work order)
      await supabase
        .from('work_order_items')
        .update({ assigned_to: selectedOperator })
        .eq('work_order_id', workOrder.id);

      toast.success(language === 'nl' ? 'Werkorder toegewezen' : 'Work order assigned');
      onComplete?.();
    } catch (error: any) {
      console.error('Error assigning work order:', error);
      toast.error(error.message || 'Failed to assign');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isOperatorUnavailable = (operatorId: string) => {
    const avail = availability.get(operatorId);
    return avail && avail.available_hours === 0;
  };

  const getUnavailableReason = (operatorId: string) => {
    const avail = availability.get(operatorId);
    return avail?.reason_type || '';
  };

  if (!workOrder) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] sm:h-auto sm:max-h-[80vh] rounded-t-xl">
        <SheetHeader className="text-left pb-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
                <span className="font-semibold">{workOrder.wo_number}</span>
                <Badge variant="outline" className="text-xs">
                  {formatProductType(workOrder.product_type)}
                </Badge>
              </SheetTitle>
              <SheetDescription className="mt-1">
                {workOrder.customer_name || (language === 'nl' ? 'Geen klant' : 'No customer')}
                {' • '}
                {workOrder.batch_size} {language === 'nl' ? 'items' : 'items'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Separator className="mb-4" />

        <ScrollArea className="h-[calc(85vh-200px)] sm:h-auto sm:max-h-[calc(80vh-220px)] pr-2">
          <div className="space-y-6">
            {/* Date Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {language === 'nl' ? 'Plandatum' : 'Scheduled Date'}
              </label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-11",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : (
                      language === 'nl' ? 'Selecteer datum' : 'Select date'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Operator Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                {language === 'nl' ? 'Toewijzen aan' : 'Assign to'}
              </label>

              {loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : operators.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {language === 'nl' 
                      ? 'Geen operators beschikbaar' 
                      : 'No operators available'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {operators.map(operator => {
                    const isUnavailable = isOperatorUnavailable(operator.id);
                    const unavailableReason = getUnavailableReason(operator.id);
                    const isSelected = selectedOperator === operator.id;

                    return (
                      <button
                        key={operator.id}
                        type="button"
                        disabled={isUnavailable}
                        onClick={() => setSelectedOperator(isSelected ? null : operator.id)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                          "hover:bg-muted/50 active:scale-[0.98]",
                          isSelected && "border-primary bg-primary/5 ring-1 ring-primary",
                          isUnavailable && "opacity-50 cursor-not-allowed bg-muted/30",
                          !isSelected && !isUnavailable && "border-border"
                        )}
                      >
                        <Avatar className="h-10 w-10">
                          {operator.avatar_url && <AvatarImage src={operator.avatar_url} />}
                          <AvatarFallback className="text-sm">
                            {getInitials(operator.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{operator.full_name}</p>
                          {isUnavailable ? (
                            <p className="text-xs text-destructive truncate">
                              {unavailableReason || (language === 'nl' ? 'Niet beschikbaar' : 'Unavailable')}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {language === 'nl' ? 'Beschikbaar' : 'Available'}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="flex gap-3 pt-4 mt-4 border-t">
          <Button
            variant="outline"
            className="flex-1 h-11"
            onClick={() => onOpenChange(false)}
          >
            {language === 'nl' ? 'Annuleren' : 'Cancel'}
          </Button>
          <Button
            className="flex-1 h-11"
            disabled={!selectedOperator || !selectedDate || saving}
            onClick={handleAssign}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            {language === 'nl' ? 'Toewijzen' : 'Assign'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ProductAssignmentSheet;
