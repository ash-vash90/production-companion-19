import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatProductType, cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Package, Loader2, AlertTriangle } from 'lucide-react';

interface Operator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  is_available: boolean;
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
  assigned_operator_id: string | 'mixed' | null;
}

interface ItemLevelAssignmentPanelProps {
  workOrderId: string;
  scheduledDate?: string | null;
  onAssignmentChange?: () => void;
}

const ItemLevelAssignmentPanel: React.FC<ItemLevelAssignmentPanelProps> = ({
  workOrderId,
  scheduledDate,
  onAssignmentChange,
}) => {
  const { language } = useLanguage();
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [unavailableOperatorIds, setUnavailableOperatorIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [workOrderId, scheduledDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1) Items
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
            assigned_operator_id: null,
          });
        }
        groupMap.get(item.product_type)!.items.push(item);
      });

      // Derive group "assigned_operator_id" (single / mixed / null)
      groupMap.forEach((group) => {
        const assigned = group.items
          .map((i) => i.assigned_to)
          .filter((v): v is string => Boolean(v));

        if (assigned.length === 0) {
          group.assigned_operator_id = null;
          return;
        }

        const unique = new Set(assigned);
        group.assigned_operator_id = unique.size === 1 ? Array.from(unique)[0] : 'mixed';
      });

      // Sort items nicely
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

      // 2) Operators (Production team)
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

      // 3) Availability (unavailable = 0 hours)
      if (scheduledDate) {
        const { data: availabilityData } = await (supabase
          .from('operator_availability' as any)
          .select('user_id, available_hours')
          .eq('date', scheduledDate)
          .eq('available_hours', 0) as any);

        const unavailable = new Set<string>((availabilityData || []).map((a: any) => a.user_id as string));
        setUnavailableOperatorIds(unavailable);
      } else {
        setUnavailableOperatorIds(new Set());
      }
    } catch (error) {
      console.error('Error fetching item assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const getOperatorById = (id: string | null | 'mixed') => {
    if (!id || id === 'mixed') return null;
    return operators.find((o) => o.id === id) || null;
  };

  const assignToItemIds = async (itemIds: string[], operatorId: string | null, savingId: string) => {
    if (operatorId && unavailableOperatorIds.has(operatorId)) {
      toast.error(language === 'nl' ? 'Operator is niet beschikbaar op deze datum' : 'Operator is unavailable on this date');
      return;
    }

    setSavingKey(savingId);
    try {
      const { error } = await supabase
        .from('work_order_items')
        .update({ assigned_to: operatorId })
        .in('id', itemIds);

      if (error) throw error;

      toast.success(language === 'nl' ? 'Toewijzing opgeslagen' : 'Assignment saved');
      await fetchData();
      onAssignmentChange?.();
    } catch (e: any) {
      console.error('Error updating item assignments:', e);
      toast.error(e?.message || (language === 'nl' ? 'Opslaan mislukt' : 'Failed to save'));
    } finally {
      setSavingKey(null);
    }
  };

  const operatorOptions = useMemo(() => {
    return operators.map((op) => ({
      ...op,
      unavailable: unavailableOperatorIds.has(op.id),
    }));
  }, [operators, unavailableOperatorIds]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (productGroups.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4" />
          {language === 'nl' ? 'Item-toewijzingen' : 'Item Assignments'}
        </CardTitle>
        <CardDescription className="text-xs">
          {language === 'nl'
            ? 'Wijs operators toe per item (batch) of per productgroep.'
            : 'Assign operators per item (batch) or per product group.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {productGroups.map((group) => {
          const groupKey = `group:${group.product_type}`;
          const assignedOperator = getOperatorById(group.assigned_operator_id);

          return (
            <div key={group.product_type} className="rounded-lg border bg-card">
              <div className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="font-mono">
                      {formatProductType(group.product_type)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {group.items.length} {language === 'nl' ? 'items' : 'items'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {group.assigned_operator_id && group.assigned_operator_id !== 'mixed' && unavailableOperatorIds.has(group.assigned_operator_id) && (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    )}

                    <Select
                      value={group.assigned_operator_id && group.assigned_operator_id !== 'mixed' ? group.assigned_operator_id : 'unassigned'}
                      onValueChange={(value) => {
                        const next = value === 'unassigned' ? null : value;
                        assignToItemIds(group.items.map((i) => i.id), next, groupKey);
                      }}
                      disabled={savingKey === groupKey}
                    >
                      <SelectTrigger className="w-full sm:w-[220px] h-10">
                        {savingKey === groupKey ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">{language === 'nl' ? 'Opslaan…' : 'Saving…'}</span>
                          </div>
                        ) : assignedOperator ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-6 w-6">
                              {assignedOperator.avatar_url && <AvatarImage src={assignedOperator.avatar_url} />}
                              <AvatarFallback className="text-[10px]">{getInitials(assignedOperator.full_name)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm truncate">{assignedOperator.full_name}</span>
                          </div>
                        ) : group.assigned_operator_id === 'mixed' ? (
                          <span className="text-sm text-muted-foreground">{language === 'nl' ? 'Gemengd' : 'Mixed'}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">{language === 'nl' ? 'Niet toegewezen' : 'Unassigned'}</span>
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          <span className="text-muted-foreground">{language === 'nl' ? 'Niet toegewezen' : 'Unassigned'}</span>
                        </SelectItem>
                        {operatorOptions.map((op) => (
                          <SelectItem key={op.id} value={op.id} disabled={op.unavailable}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                                <AvatarFallback className="text-[10px]">{getInitials(op.full_name)}</AvatarFallback>
                              </Avatar>
                              <span className="truncate">{op.full_name}</span>
                              {op.unavailable && (
                                <Badge variant="secondary" className="text-[10px] ml-1">
                                  {language === 'nl' ? 'Afwezig' : 'Away'}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 sm:h-9 px-3 text-xs"
                      disabled={savingKey === groupKey}
                      onClick={() => assignToItemIds(group.items.map((i) => i.id), null, groupKey)}
                    >
                      {language === 'nl' ? 'Wis' : 'Clear'}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="p-3 sm:p-4 space-y-2">
                {group.items.map((item) => {
                  const itemKey = `item:${item.id}`;
                  const itemOperator = getOperatorById(item.assigned_to);

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3',
                        'rounded-lg border bg-muted/20 p-3'
                      )}
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs truncate">{item.serial_number}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {language === 'nl' ? 'Item' : 'Item'} {item.position_in_batch ?? ''}
                        </p>
                      </div>

                      <Select
                        value={item.assigned_to ? item.assigned_to : 'unassigned'}
                        onValueChange={(value) => {
                          const next = value === 'unassigned' ? null : value;
                          assignToItemIds([item.id], next, itemKey);
                        }}
                        disabled={savingKey === itemKey}
                      >
                        <SelectTrigger className="w-full sm:w-[220px] h-10">
                          {savingKey === itemKey ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-sm">{language === 'nl' ? 'Opslaan…' : 'Saving…'}</span>
                            </div>
                          ) : itemOperator ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar className="h-6 w-6">
                                {itemOperator.avatar_url && <AvatarImage src={itemOperator.avatar_url} />}
                                <AvatarFallback className="text-[10px]">{getInitials(itemOperator.full_name)}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm truncate">{itemOperator.full_name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">{language === 'nl' ? 'Niet toegewezen' : 'Unassigned'}</span>
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">
                            <span className="text-muted-foreground">{language === 'nl' ? 'Niet toegewezen' : 'Unassigned'}</span>
                          </SelectItem>
                          {operatorOptions.map((op) => (
                            <SelectItem key={op.id} value={op.id} disabled={op.unavailable}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                                  <AvatarFallback className="text-[10px]">{getInitials(op.full_name)}</AvatarFallback>
                                </Avatar>
                                <span className="truncate">{op.full_name}</span>
                                {op.unavailable && (
                                  <Badge variant="secondary" className="text-[10px] ml-1">
                                    {language === 'nl' ? 'Afwezig' : 'Away'}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ItemLevelAssignmentPanel;

