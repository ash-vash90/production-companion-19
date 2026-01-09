import React, { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { formatProductType, cn } from '@/lib/utils';
import { 
  ChevronLeft, 
  Check, 
  Loader2, 
  AlertTriangle,
  Users,
  Package
} from 'lucide-react';

interface Operator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  is_available: boolean;
  unavailable?: boolean;
  dayCount?: number;
}

interface WorkOrderItem {
  id: string;
  serial_number: string;
  product_type: string;
  position_in_batch: number | null;
  assigned_to: string | null;
}

interface ProductGroup {
  product_type: string;
  items: WorkOrderItem[];
}

interface MobileItemAssignmentPageProps {
  workOrderId: string;
  scheduledDate?: string | null;
  onBack: () => void;
  onUpdate: () => void;
}

const MobileItemAssignmentPage: React.FC<MobileItemAssignmentPageProps> = ({
  workOrderId,
  scheduledDate,
  onBack,
  onUpdate,
}) => {
  const { language } = useLanguage();
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedGroupType, setSelectedGroupType] = useState<string | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [workOrderId, scheduledDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch items
      const { data: itemsData, error: itemsError } = await supabase
        .from('work_order_items')
        .select('id, serial_number, product_type, position_in_batch, assigned_to')
        .eq('work_order_id', workOrderId);

      if (itemsError) throw itemsError;

      const items: WorkOrderItem[] = (itemsData || []).map((i: any) => ({
        id: i.id,
        serial_number: i.serial_number,
        product_type: i.product_type || 'UNKNOWN',
        position_in_batch: i.position_in_batch ?? null,
        assigned_to: i.assigned_to ?? null,
      }));

      // Group by product type
      const groupMap = new Map<string, ProductGroup>();
      items.forEach((item) => {
        if (!groupMap.has(item.product_type)) {
          groupMap.set(item.product_type, {
            product_type: item.product_type,
            items: [],
          });
        }
        groupMap.get(item.product_type)!.items.push(item);
      });

      const groups = Array.from(groupMap.values())
        .map((g) => ({
          ...g,
          items: [...g.items].sort((a, b) => {
            const pa = a.position_in_batch ?? 999999;
            const pb = b.position_in_batch ?? 999999;
            if (pa !== pb) return pa - pb;
            return a.serial_number.localeCompare(b.serial_number);
          }),
        }))
        .sort((a, b) => a.product_type.localeCompare(b.product_type));

      setProductGroups(groups);
      if (groups.length > 0 && !selectedGroupType) {
        setSelectedGroupType(groups[0].product_type);
      }

      // Fetch operators (Production team)
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

      // Check availability
      let unavailableSet = new Set<string>();
      let dayCounts = new Map<string, number>();

      if (scheduledDate) {
        const { data: availabilityData } = await supabase
          .from('operator_availability')
          .select('user_id, available_hours')
          .eq('date', scheduledDate)
          .eq('available_hours', 0);

        unavailableSet = new Set((availabilityData || []).map((a: any) => a.user_id));

        const { data: dayAssignments } = await supabase
          .from('operator_assignments')
          .select('operator_id')
          .eq('assigned_date', scheduledDate);

        (dayAssignments || []).forEach((a: any) => {
          const current = dayCounts.get(a.operator_id) || 0;
          dayCounts.set(a.operator_id, current + 1);
        });
      }

      setOperators((profilesData || []).map((op: any) => ({
        ...op,
        unavailable: unavailableSet.has(op.id),
        dayCount: dayCounts.get(op.id) || 0,
      })));
    } catch (error) {
      console.error('Error fetching item assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const currentGroup = productGroups.find(g => g.product_type === selectedGroupType);
  
  const assignmentStats = useMemo(() => {
    if (!currentGroup) return { assigned: 0, total: 0 };
    const assigned = currentGroup.items.filter(i => i.assigned_to).length;
    return { assigned, total: currentGroup.items.length };
  }, [currentGroup]);

  const handleAssignAll = async () => {
    if (!selectedOperator || !currentGroup) return;
    
    const operator = operators.find(o => o.id === selectedOperator);
    if (operator?.unavailable) {
      toast.error(language === 'nl' ? 'Operator is niet beschikbaar' : 'Operator is unavailable');
      return;
    }

    setSavingId('all');
    try {
      const itemIds = currentGroup.items.map(i => i.id);
      const { error } = await supabase
        .from('work_order_items')
        .update({ assigned_to: selectedOperator })
        .in('id', itemIds);

      if (error) throw error;

      toast.success(language === 'nl' ? 'Alle items toegewezen' : 'All items assigned');
      await fetchData();
      onUpdate();
    } catch (e: any) {
      console.error('Error assigning items:', e);
      toast.error(e?.message || (language === 'nl' ? 'Opslaan mislukt' : 'Failed to save'));
    } finally {
      setSavingId(null);
      setSelectedOperator(null);
    }
  };

  const handleAssignItem = async (itemId: string, operatorId: string | null) => {
    const operator = operatorId ? operators.find(o => o.id === operatorId) : null;
    if (operator?.unavailable) {
      toast.error(language === 'nl' ? 'Operator is niet beschikbaar' : 'Operator is unavailable');
      return;
    }

    setSavingId(itemId);
    try {
      const { error } = await supabase
        .from('work_order_items')
        .update({ assigned_to: operatorId })
        .eq('id', itemId);

      if (error) throw error;

      toast.success(language === 'nl' ? 'Item toegewezen' : 'Item assigned');
      await fetchData();
      onUpdate();
    } catch (e: any) {
      console.error('Error assigning item:', e);
      toast.error(e?.message || (language === 'nl' ? 'Opslaan mislukt' : 'Failed to save'));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-none p-4 border-b">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-none p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 -ml-2">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold">
              {language === 'nl' ? 'Items toewijzen' : 'Assign Items'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {assignmentStats.assigned}/{assignmentStats.total} {language === 'nl' ? 'toegewezen' : 'assigned'}
            </p>
          </div>
        </div>
      </div>

      {/* Product Type Tabs */}
      {productGroups.length > 1 && (
        <div className="flex-none p-4 border-b overflow-x-auto">
          <div className="flex gap-2">
            {productGroups.map((group) => (
              <Button
                key={group.product_type}
                variant={selectedGroupType === group.product_type ? 'default' : 'outline'}
                size="sm"
                className="shrink-0"
                onClick={() => setSelectedGroupType(group.product_type)}
              >
                {formatProductType(group.product_type)}
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {group.items.length}
                </Badge>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Bulk Assign Section */}
      <div className="flex-none p-4 border-b bg-muted/30">
        <p className="text-sm font-medium mb-3">
          {language === 'nl' ? 'Wijs alle items toe aan:' : 'Assign all items to:'}
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {operators.map((op) => (
            <button
              key={op.id}
              onClick={() => setSelectedOperator(selectedOperator === op.id ? null : op.id)}
              disabled={op.unavailable}
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg border transition-colors min-h-[44px]',
                selectedOperator === op.id 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary/50',
                op.unavailable && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Avatar className="h-8 w-8">
                {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                <AvatarFallback className="text-xs">{getInitials(op.full_name)}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="text-sm font-medium">{op.full_name}</p>
                {op.unavailable ? (
                  <p className="text-xs text-destructive">{language === 'nl' ? 'Afwezig' : 'Away'}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{op.dayCount} orders</p>
                )}
              </div>
              {selectedOperator === op.id && (
                <Check className="h-4 w-4 text-primary ml-auto" />
              )}
            </button>
          ))}
        </div>
        <Button 
          onClick={handleAssignAll} 
          disabled={!selectedOperator || savingId === 'all'}
          className="w-full h-11"
        >
          {savingId === 'all' ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Users className="h-4 w-4 mr-2" />
          )}
          {language === 'nl' ? 'Wijs alle items toe' : 'Assign All Items'}
        </Button>
      </div>

      {/* Items List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          <p className="text-xs text-muted-foreground mb-3">
            {language === 'nl' ? 'Of wijs individuele items toe:' : 'Or assign individual items:'}
          </p>
          
          {currentGroup?.items.map((item) => {
            const assignedOperator = operators.find(o => o.id === item.assigned_to);
            
            return (
              <Card key={item.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{item.serial_number}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      #{item.position_in_batch}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {operators.map((op) => (
                      <button
                        key={op.id}
                        onClick={() => handleAssignItem(item.id, item.assigned_to === op.id ? null : op.id)}
                        disabled={op.unavailable || savingId === item.id}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs transition-colors min-h-[36px]',
                          item.assigned_to === op.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/50',
                          op.unavailable && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {savingId === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Avatar className="h-5 w-5">
                            {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                            <AvatarFallback className="text-[8px]">{getInitials(op.full_name)}</AvatarFallback>
                          </Avatar>
                        )}
                        <span className="truncate max-w-[80px]">{op.full_name.split(' ')[0]}</span>
                        {item.assigned_to === op.id && <Check className="h-3 w-3" />}
                      </button>
                    ))}
                  </div>
                  
                  {item.assigned_to && assignedOperator?.unavailable && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      {language === 'nl' ? 'Toegewezen operator is afwezig' : 'Assigned operator is away'}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default MobileItemAssignmentPage;
