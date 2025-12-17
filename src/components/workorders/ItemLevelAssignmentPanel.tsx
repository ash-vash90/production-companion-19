import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatProductType } from '@/lib/utils';
import { Package, Users, Loader2, AlertTriangle } from 'lucide-react';

interface Operator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  is_available: boolean;
}

interface ProductGroup {
  product_type: string;
  items: { id: string; serial_number: string; assigned_to: string | null }[];
  assigned_operator_id: string | null;
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
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [unavailableOperatorIds, setUnavailableOperatorIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [workOrderId, scheduledDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch work order items grouped by product type
      const { data: itemsData, error: itemsError } = await supabase
        .from('work_order_items')
        .select('id, serial_number, product_type, assigned_to')
        .eq('work_order_id', workOrderId);

      if (itemsError) throw itemsError;

      // Group items by product type
      const groupMap = new Map<string, ProductGroup>();
      (itemsData || []).forEach(item => {
        const productType = item.product_type || 'UNKNOWN';
        if (!groupMap.has(productType)) {
          groupMap.set(productType, {
            product_type: productType,
            items: [],
            assigned_operator_id: null,
          });
        }
        const group = groupMap.get(productType)!;
        group.items.push({
          id: item.id,
          serial_number: item.serial_number,
          assigned_to: item.assigned_to,
        });
        // Set assigned operator if all items have the same assignment
        if (item.assigned_to) {
          if (group.assigned_operator_id === null) {
            group.assigned_operator_id = item.assigned_to;
          } else if (group.assigned_operator_id !== item.assigned_to) {
            group.assigned_operator_id = 'mixed';
          }
        }
      });

      setProductGroups(Array.from(groupMap.values()));

      // Fetch operators from Production team
      const { data: teamMembers } = await supabase
        .from('user_teams')
        .select(`user_id, team:teams(name)`)
        .eq('team.name', 'Production');

      const userIds = (teamMembers || []).map((tm: any) => tm.user_id);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, is_available')
        .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

      setOperators(profilesData || []);

      // Check availability for the scheduled date
      if (scheduledDate) {
        const { data: availabilityData } = await (supabase
          .from('operator_availability' as any)
          .select('user_id, available_hours')
          .eq('date', scheduledDate)
          .eq('available_hours', 0) as any);

        const unavailable = new Set<string>((availabilityData || []).map((a: any) => a.user_id as string));
        setUnavailableOperatorIds(unavailable);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const assignOperatorToProductType = async (productType: string, operatorId: string | null) => {
    const group = productGroups.find(g => g.product_type === productType);
    if (!group) return;

    // Check if operator is unavailable
    if (operatorId && unavailableOperatorIds.has(operatorId)) {
      toast.error('This operator is not available on the scheduled date');
      return;
    }

    setSaving(productType);
    try {
      const itemIds = group.items.map(i => i.id);
      
      const { error } = await supabase
        .from('work_order_items')
        .update({ assigned_to: operatorId })
        .in('id', itemIds);

      if (error) throw error;

      toast.success(`Assigned ${formatProductType(productType)} items`);
      fetchData();
      onAssignmentChange?.();
    } catch (error: any) {
      console.error('Error assigning operator:', error);
      toast.error(error.message || 'Failed to assign operator');
    } finally {
      setSaving(null);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getOperatorById = (id: string | null) => {
    if (!id || id === 'mixed') return null;
    return operators.find(o => o.id === id);
  };

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

  if (productGroups.length <= 1) {
    return null; // Don't show for single product type orders
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5" />
          Item-Level Assignment
        </CardTitle>
        <CardDescription>
          Assign different operators to different product types
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {productGroups.map((group) => {
          const assignedOperator = getOperatorById(group.assigned_operator_id);
          const isUnavailable = group.assigned_operator_id && unavailableOperatorIds.has(group.assigned_operator_id);
          
          return (
            <div
              key={group.product_type}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono">
                  {formatProductType(group.product_type)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {isUnavailable && (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
                <Select
                  value={group.assigned_operator_id === 'mixed' ? '' : (group.assigned_operator_id || '')}
                  onValueChange={(value) => assignOperatorToProductType(group.product_type, value || null)}
                  disabled={saving === group.product_type}
                >
                  <SelectTrigger className="w-[180px] h-9">
                    {saving === group.product_type ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SelectValue placeholder="Select operator">
                        {assignedOperator ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              {assignedOperator.avatar_url && (
                                <AvatarImage src={assignedOperator.avatar_url} />
                              )}
                              <AvatarFallback className="text-[10px]">
                                {getInitials(assignedOperator.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{assignedOperator.full_name}</span>
                          </div>
                        ) : group.assigned_operator_id === 'mixed' ? (
                          <span className="text-muted-foreground">Mixed</span>
                        ) : (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </SelectValue>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">
                      <span className="text-muted-foreground">Unassigned</span>
                    </SelectItem>
                    {operators.map(op => {
                      const isOpUnavailable = unavailableOperatorIds.has(op.id);
                      return (
                        <SelectItem 
                          key={op.id} 
                          value={op.id}
                          disabled={isOpUnavailable}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                              <AvatarFallback className="text-[10px]">
                                {getInitials(op.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{op.full_name}</span>
                            {isOpUnavailable && (
                              <Badge variant="secondary" className="text-[10px] ml-1">Unavailable</Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ItemLevelAssignmentPanel;
