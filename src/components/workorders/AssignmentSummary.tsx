import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Users, CheckCircle2 } from 'lucide-react';

interface AssignedOperator {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface AssignmentSummaryProps {
  workOrderId: string;
}

const AssignmentSummary: React.FC<AssignmentSummaryProps> = ({ workOrderId }) => {
  const { language } = useLanguage();
  const [assignedOperators, setAssignedOperators] = useState<AssignedOperator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssignments();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`assignments_${workOrderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'operator_assignments',
          filter: `work_order_id=eq.${workOrderId}`,
        },
        () => {
          fetchAssignments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workOrderId]);

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('operator_assignments')
        .select(`
          operator_id,
          profiles!operator_assignments_operator_id_fkey(id, full_name, avatar_url)
        `)
        .eq('work_order_id', workOrderId);

      if (error) {
        console.error('Error fetching assignments:', error);
        return;
      }

      const operators: AssignedOperator[] = (data || [])
        .filter((a: any) => a.profiles)
        .map((a: any) => ({
          id: a.profiles.id,
          full_name: a.profiles.full_name,
          avatar_url: a.profiles.avatar_url,
        }));

      setAssignedOperators(operators);
    } catch (error) {
      console.error('Error fetching assignment summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (assignedOperators.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {language === 'nl' ? 'Geen operators toegewezen' : 'No operators assigned'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          {language === 'nl' ? 'Toegewezen Operators' : 'Assigned Operators'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {assignedOperators.map((operator) => (
          <div 
            key={operator.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
          >
            <Avatar className="h-10 w-10">
              {operator.avatar_url && <AvatarImage src={operator.avatar_url} />}
              <AvatarFallback className="text-sm">
                {getInitials(operator.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{operator.full_name}</p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {language === 'nl' ? 'Toegewezen' : 'Assigned'}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AssignmentSummary;
