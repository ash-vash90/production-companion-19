import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon, UserMinus, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Operator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  daily_capacity_hours: number;
}

interface QuickAvailabilityFormProps {
  onAvailabilityAdded?: () => void;
}

const QuickAvailabilityForm: React.FC<QuickAvailabilityFormProps> = ({ onAvailabilityAdded }) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [reasonType, setReasonType] = useState<string>('holiday');
  const [reason, setReason] = useState('');
  const [availableHours, setAvailableHours] = useState<number>(0);

  useEffect(() => {
    fetchOperators();
  }, []);

  const fetchOperators = async () => {
    setLoading(true);
    try {
      // Get production team members
      const { data: teamMembers } = await supabase
        .from('user_teams')
        .select('user_id, team:teams(name)')
        .eq('team.name', 'Production');

      const userIds = (teamMembers || []).map((tm: any) => tm.user_id);

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, daily_capacity_hours')
        .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
        .order('full_name');

      setOperators(data || []);
    } catch (error) {
      console.error('Error fetching operators:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedOperator || !selectedDate) {
      toast.error(language === 'nl' ? 'Selecteer operator en datum' : 'Select operator and date');
      return;
    }

    setSaving(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Check if entry already exists
      const { data: existing } = await supabase
        .from('operator_availability')
        .select('id')
        .eq('user_id', selectedOperator)
        .eq('date', dateStr)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('operator_availability')
          .update({
            available_hours: availableHours,
            reason_type: reasonType,
            reason: reason || null,
          })
          .eq('id', existing.id);

        if (error) throw error;
        toast.success(language === 'nl' ? 'Beschikbaarheid bijgewerkt' : 'Availability updated');
      } else {
        // Insert new
        const { error } = await supabase
          .from('operator_availability')
          .insert({
            user_id: selectedOperator,
            date: dateStr,
            available_hours: availableHours,
            reason_type: reasonType,
            reason: reason || null,
            created_by: user?.id,
          });

        if (error) throw error;
        toast.success(language === 'nl' ? 'Beschikbaarheid toegevoegd' : 'Availability added');
      }

      // Reset form
      setSelectedOperator('');
      setSelectedDate(undefined);
      setReasonType('holiday');
      setReason('');
      setAvailableHours(0);
      
      onAvailabilityAdded?.();
    } catch (error) {
      console.error('Error saving availability:', error);
      toast.error(language === 'nl' ? 'Opslaan mislukt' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const reasonTypes = [
    { value: 'holiday', label: language === 'nl' ? 'Vakantie' : 'Holiday' },
    { value: 'sick', label: language === 'nl' ? 'Ziek' : 'Sick' },
    { value: 'training', label: language === 'nl' ? 'Training' : 'Training' },
    { value: 'other', label: language === 'nl' ? 'Anders' : 'Other' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <UserMinus className="h-4 w-4" />
          {language === 'nl' ? 'Afwezigheid Toevoegen' : 'Add Unavailability'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Operator Select */}
          <div className="space-y-2">
            <Label className="text-xs">{language === 'nl' ? 'Operator' : 'Operator'}</Label>
            <Select value={selectedOperator} onValueChange={setSelectedOperator}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={language === 'nl' ? 'Selecteer operator' : 'Select operator'} />
              </SelectTrigger>
              <SelectContent>
                {operators.map(op => (
                  <SelectItem key={op.id} value={op.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                        <AvatarFallback className="text-[8px]">{getInitials(op.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{op.full_name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label className="text-xs">{language === 'nl' ? 'Datum' : 'Date'}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full h-9 justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP') : (language === 'nl' ? 'Kies datum' : 'Pick date')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Reason Type */}
          <div className="space-y-2">
            <Label className="text-xs">{language === 'nl' ? 'Reden' : 'Reason'}</Label>
            <Select value={reasonType} onValueChange={setReasonType}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reasonTypes.map(rt => (
                  <SelectItem key={rt.value} value={rt.value}>
                    {rt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Available Hours */}
          <div className="space-y-2">
            <Label className="text-xs">
              {language === 'nl' ? 'Beschikbare uren' : 'Available hours'}
              <span className="text-muted-foreground ml-1">(0 = hele dag afwezig)</span>
            </Label>
            <Input
              type="number"
              min={0}
              max={12}
              step={0.5}
              value={availableHours}
              onChange={(e) => setAvailableHours(parseFloat(e.target.value) || 0)}
              className="h-9"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-xs">{language === 'nl' ? 'Notitie (optioneel)' : 'Note (optional)'}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={language === 'nl' ? 'Bijv. ochtenddienst arts' : 'E.g. morning doctor appointment'}
              className="h-16 resize-none text-sm"
            />
          </div>

          <Button type="submit" className="w-full gap-2" disabled={saving || !selectedOperator || !selectedDate}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {language === 'nl' ? 'Toevoegen' : 'Add'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default QuickAvailabilityForm;
