import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { formatProductType } from '@/lib/utils';

type ProductType = 'SDM_ECO' | 'SENSOR' | 'MLA' | 'HMI' | 'TRANSMITTER';

interface ProductBatch {
  id: string;
  productType: ProductType;
  quantity: number;
}

interface CreateWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  trigger?: React.ReactNode;
}

const PRODUCT_TYPES: ProductType[] = ['SDM_ECO', 'SENSOR', 'MLA', 'HMI', 'TRANSMITTER'];

const PREFIXES: Record<ProductType, string> = {
  'SENSOR': 'Q',
  'MLA': 'W',
  'HMI': 'X',
  'TRANSMITTER': 'T',
  'SDM_ECO': 'SDM'
};

export function CreateWorkOrderDialog({ open, onOpenChange, onSuccess, trigger }: CreateWorkOrderDialogProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [creating, setCreating] = useState(false);
  const [woNumber, setWoNumber] = useState('');
  const [productBatches, setProductBatches] = useState<ProductBatch[]>([
    { id: crypto.randomUUID(), productType: 'SDM_ECO', quantity: 1 }
  ]);

  const addProductBatch = () => {
    setProductBatches([
      ...productBatches,
      { id: crypto.randomUUID(), productType: 'SENSOR', quantity: 1 }
    ]);
  };

  const removeProductBatch = (id: string) => {
    if (productBatches.length > 1) {
      setProductBatches(productBatches.filter(b => b.id !== id));
    }
  };

  const updateProductBatch = (id: string, field: 'productType' | 'quantity', value: any) => {
    setProductBatches(productBatches.map(b => 
      b.id === id ? { ...b, [field]: value } : b
    ));
  };

  const getTotalItems = () => productBatches.reduce((sum, b) => sum + b.quantity, 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setCreating(true);
    try {
      // Get the primary product type (first in list) for the work order
      const primaryProductType = productBatches[0].productType;
      const totalBatchSize = getTotalItems();

      const { data: workOrder, error: woError } = await supabase
        .from('work_orders')
        .insert({
          wo_number: woNumber,
          product_type: primaryProductType,
          batch_size: totalBatchSize,
          created_by: user.id,
          status: 'planned',
        })
        .select()
        .single();

      if (woError) throw woError;

      // Generate serial numbers for each product batch
      const woSuffix = woNumber.replace(/[^a-zA-Z0-9]/g, '').slice(-6);
      const items: any[] = [];
      let position = 1;

      for (const batch of productBatches) {
        const prefix = PREFIXES[batch.productType];
        for (let i = 1; i <= batch.quantity; i++) {
          const serialNumber = `${prefix}-${woSuffix}-${String(position).padStart(3, '0')}`;
          items.push({
            work_order_id: workOrder.id,
            serial_number: serialNumber,
            position_in_batch: position,
            status: 'planned',
            assigned_to: user.id,
          });
          position++;
        }
      }

      const { error: itemsError } = await supabase
        .from('work_order_items')
        .insert(items);

      if (itemsError) throw itemsError;

      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'create_work_order',
        entity_type: 'work_order',
        entity_id: workOrder.id,
        details: { 
          wo_number: woNumber, 
          product_batches: productBatches.map(b => ({ type: b.productType, quantity: b.quantity })),
          total_items: totalBatchSize 
        },
      });

      // Trigger webhook for work order creation
      const { triggerWebhook } = await import('@/lib/webhooks');
      await triggerWebhook('work_order_created', {
        work_order: workOrder,
        batch_size: totalBatchSize,
        product_batches: productBatches,
      });

      toast.success(t('success'), { description: `${t('workOrderNumber')} ${woNumber} ${t('workOrderCreated')}` });
      onOpenChange(false);
      setWoNumber('');
      setProductBatches([{ id: crypto.randomUUID(), productType: 'SDM_ECO', quantity: 1 }]);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating work order:', error);
      
      let errorMessage = error.message;
      if (error.code === '23505') {
        errorMessage = `${t('workOrderNumber')} ${woNumber} ${t('workOrderExists')}`;
      }
      
      toast.error(t('error'), { description: errorMessage });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('createWorkOrder')}</DialogTitle>
          <DialogDescription className="text-base">{t('createWorkOrderDesc')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="space-y-3">
            <Label htmlFor="woNumber" className="text-base font-data uppercase tracking-wider">{t('workOrderNumber')}</Label>
            <Input
              id="woNumber"
              value={woNumber}
              onChange={(e) => setWoNumber(e.target.value)}
              placeholder="WO-2024-001"
              required
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-data uppercase tracking-wider">{t('productBatches')}</Label>
              <Badge variant="secondary" className="text-xs">
                {getTotalItems()} {t('items')}
              </Badge>
            </div>
            
            <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
              {productBatches.map((batch, index) => (
                <div key={batch.id} className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                  <div className="flex-1">
                    <Select
                      value={batch.productType}
                      onValueChange={(value: ProductType) => updateProductBatch(batch.id, 'productType', value)}
                    >
                      <SelectTrigger className="h-10 text-sm border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_TYPES.map(type => (
                          <SelectItem key={type} value={type} className="h-10 text-sm">
                            {formatProductType(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      value={batch.quantity}
                      onChange={(e) => updateProductBatch(batch.id, 'quantity', parseInt(e.target.value) || 1)}
                      className="h-10 text-center"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:text-destructive"
                    onClick={() => removeProductBatch(batch.id)}
                    disabled={productBatches.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={addProductBatch}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('addProductBatch')}
            </Button>
          </div>

          <DialogFooter className="gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} size="lg" className="flex-1">
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={creating} variant="default" size="lg" className="flex-1">
              {creating && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
