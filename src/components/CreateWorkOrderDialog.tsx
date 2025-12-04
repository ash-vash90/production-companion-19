import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, RefreshCw, CalendarIcon } from 'lucide-react';
import { formatProductType, cn } from '@/lib/utils';
import { SettingsService, SerialPrefixes } from '@/services/settingsService';
import { format } from 'date-fns';

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

export function CreateWorkOrderDialog({ open, onOpenChange, onSuccess, trigger }: CreateWorkOrderDialogProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [creating, setCreating] = useState(false);
  const [woNumber, setWoNumber] = useState('');
  const [generatingWO, setGeneratingWO] = useState(false);
  const [serialPrefixes, setSerialPrefixes] = useState<SerialPrefixes | null>(null);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [productBatches, setProductBatches] = useState<ProductBatch[]>([
    { id: crypto.randomUUID(), productType: 'SDM_ECO', quantity: 1 }
  ]);

  // Generate WO number when dialog opens
  useEffect(() => {
    if (open) {
      generateWONumber();
      loadSerialPrefixes();
    }
  }, [open]);

  const generateWONumber = async () => {
    setGeneratingWO(true);
    try {
      const generatedNumber = await SettingsService.generateWorkOrderNumber();
      setWoNumber(generatedNumber);
    } catch (error) {
      console.error('Error generating WO number:', error);
      // Fallback to simple format
      const fallback = `WO-${Date.now()}`;
      setWoNumber(fallback);
    } finally {
      setGeneratingWO(false);
    }
  };

  const loadSerialPrefixes = async () => {
    const prefixes = await SettingsService.getSerialPrefixes();
    setSerialPrefixes(prefixes);
  };

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
          scheduled_date: scheduledDate ? format(scheduledDate, 'yyyy-MM-dd') : null,
        })
        .select()
        .single();

      if (woError) throw woError;

      // Generate serial numbers for each product batch using configured prefixes
      const prefixes = serialPrefixes || { SENSOR: 'Q', MLA: 'W', HMI: 'X', TRANSMITTER: 'T', SDM_ECO: 'SDM' };
      const serialFormat = await SettingsService.getSerialFormat();
      const items: any[] = [];
      let position = 1;

      for (const batch of productBatches) {
        const prefix = prefixes[batch.productType] || batch.productType.charAt(0);
        for (let i = 1; i <= batch.quantity; i++) {
          const paddedPosition = String(position).padStart(serialFormat.padLength, '0');
          const serialNumber = `${prefix}${serialFormat.separator}${paddedPosition}`;
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
      setScheduledDate(undefined);
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
            <Label className="text-base font-data uppercase tracking-wider">{t('workOrderNumber')}</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 rounded-lg border bg-muted/50 font-mono font-semibold">
                {generatingWO ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </span>
                ) : (
                  woNumber
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={generateWONumber}
                disabled={generatingWO}
                title="Regenerate"
              >
                <RefreshCw className={`h-4 w-4 ${generatingWO ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Auto-generated based on settings format</p>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-data uppercase tracking-wider">{t('scheduledDate')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !scheduledDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, "PPP") : <span>{t('selectDate')}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={setScheduledDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">{t('scheduledDateHint')}</p>
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
