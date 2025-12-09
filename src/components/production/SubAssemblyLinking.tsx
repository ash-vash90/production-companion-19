import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link2, X, ScanBarcode } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';

interface SubAssemblyLinkingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentItem: any;
  onComplete: () => void;
}

const SubAssemblyLinking: React.FC<SubAssemblyLinkingProps> = ({
  open,
  onOpenChange,
  parentItem,
  onComplete,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [componentType, setComponentType] = useState<string>('');
  const [serialNumber, setSerialNumber] = useState<string>('');
  const [linkedComponents, setLinkedComponents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const componentTypes = [
    { value: 'SENSOR', label: 'Sensor (Q-####)' },
    { value: 'MLA', label: 'MLA (W-####)' },
    { value: 'HMI', label: 'HMI (X-####)' },
    { value: 'TRANSMITTER', label: 'Transmitter (T-####)' },
  ];

  useEffect(() => {
    if (open) {
      fetchLinkedComponents();
    }
  }, [open]);

  const fetchLinkedComponents = async () => {
    try {
      const { data, error } = await supabase
        .from('sub_assemblies')
        .select(`
          id,
          component_type,
          linked_at,
          child_item:work_order_items!sub_assemblies_child_item_id_fkey(
            id,
            serial_number,
            status
          )
        `)
        .eq('parent_item_id', parentItem.id)
        .order('linked_at', { ascending: false });

      if (error) throw error;
      setLinkedComponents(data || []);
    } catch (error) {
      console.error('Error fetching linked components:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkComponent = async () => {
    if (!componentType || !serialNumber) {
      toast.error('Error', { description: 'Please select component type and scan serial number' });
      return;
    }

    try {
      // Find the child item by serial number and component type
      const { data: childItem, error: findError } = await supabase
        .from('work_order_items')
        .select('*, work_order:work_orders!work_order_items_work_order_id_fkey(product_type)')
        .eq('serial_number', serialNumber)
        .maybeSingle();

      if (findError) throw findError;

      if (!childItem) {
        toast.error('Error', { description: 'Serial number not found' });
        return;
      }

      if (childItem.work_order.product_type !== componentType) {
        toast.error('Error', { 
          description: `This serial number is for ${childItem.work_order.product_type}, not ${componentType}` 
        });
        return;
      }

      // Check if already linked
      const { data: existing } = await supabase
        .from('sub_assemblies')
        .select('id')
        .eq('parent_item_id', parentItem.id)
        .eq('child_item_id', childItem.id)
        .maybeSingle();

      if (existing) {
        toast.error('Error', { description: 'This component is already linked' });
        return;
      }

      // Create the link
      const { data, error } = await supabase
        .from('sub_assemblies')
        .insert({
          parent_item_id: parentItem.id,
          child_item_id: childItem.id,
          component_type: componentType as any,
          linked_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'link_subassembly',
        entity_type: 'sub_assembly',
        entity_id: data.id,
        details: { 
          parent_serial: parentItem.serial_number, 
          child_serial: serialNumber, 
          component_type: componentType 
        },
      });

      toast.success('Success', { description: 'Component linked successfully' });
      setSerialNumber('');
      fetchLinkedComponents();
    } catch (error: any) {
      console.error('Error linking component:', error);
      toast.error('Error', { description: error.message });
    }
  };

  const handleUnlinkComponent = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('sub_assemblies')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      setLinkedComponents(prev => prev.filter(c => c.id !== linkId));
      toast.success('Success', { description: 'Component unlinked' });
    } catch (error: any) {
      console.error('Error unlinking component:', error);
      toast.error('Error', { description: error.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Sub-Assemblies</DialogTitle>
          <DialogDescription>
            Link component serial numbers to {parentItem.serial_number}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3 p-4 border rounded-lg bg-accent/20">
            <div className="space-y-2">
              <Label htmlFor="componentType">Component Type *</Label>
              <Select value={componentType} onValueChange={setComponentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select component type" />
                </SelectTrigger>
                <SelectContent>
                  {componentTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serialNumber">Component Serial Number *</Label>
              <div className="flex gap-2">
                <Input
                  id="serialNumber"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="Scan component serial number"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleLinkComponent();
                    }
                  }}
                />
                <Button type="button" onClick={handleLinkComponent}>
                  <Link2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Linked Components ({linkedComponents.length})</Label>
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : linkedComponents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <ScanBarcode className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No components linked yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {linkedComponents.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{link.component_type}</Badge>
                        <span className="font-mono font-medium">{link.child_item.serial_number}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Linked: {formatDateTime(link.linked_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleUnlinkComponent(link.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SubAssemblyLinking;
