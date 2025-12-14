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
import { Loader2, Plus, Trash2, RefreshCw, CalendarIcon, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
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
  const { t, language } = useLanguage();
  const [creating, setCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState(0);
  const [creationStatus, setCreationStatus] = useState('');
  const [woNumber, setWoNumber] = useState('');
  const [generatingWO, setGeneratingWO] = useState(false);
  const [serialPrefixes, setSerialPrefixes] = useState<SerialPrefixes | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [shippingDate, setShippingDate] = useState<Date | undefined>(undefined);
  const [customerName, setCustomerName] = useState('');
  const [externalOrderNumber, setExternalOrderNumber] = useState('');
  const [orderValue, setOrderValue] = useState('');
  const [productBatches, setProductBatches] = useState<ProductBatch[]>([
    { id: crypto.randomUUID(), productType: 'SDM_ECO', quantity: 1 }
  ]);

  // Validation errors
  const [errors, setErrors] = useState<{
    startDate?: string;
    shippingDate?: string;
    customerName?: string;
    externalOrderNumber?: string;
    orderValue?: string;
  }>({});

  // Generate WO number when dialog opens
  useEffect(() => {
    if (open) {
      generateWONumber();
      loadSerialPrefixes();
      // Reset form
      setStartDate(undefined);
      setShippingDate(undefined);
      setCustomerName('');
      setExternalOrderNumber('');
      setOrderValue('');
      setProductBatches([{ id: crypto.randomUUID(), productType: 'SDM_ECO', quantity: 1 }]);
      setErrors({});
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

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!startDate) {
      newErrors.startDate = language === 'nl' ? 'Startdatum is verplicht' : 'Start date is required';
    }

    if (!shippingDate) {
      newErrors.shippingDate = language === 'nl' ? 'Verzenddatum is verplicht' : 'Shipping date is required';
    }

    if (startDate && shippingDate && startDate > shippingDate) {
      newErrors.shippingDate = language === 'nl' ? 'Verzenddatum moet na startdatum zijn' : 'Shipping date must be after start date';
    }

    if (!customerName.trim()) {
      newErrors.customerName = language === 'nl' ? 'Klantnaam is verplicht' : 'Customer name is required';
    }

    if (!externalOrderNumber.trim()) {
      newErrors.externalOrderNumber = language === 'nl' ? 'Ordernummer is verplicht' : 'Order number is required';
    }

    if (!orderValue.trim() || isNaN(parseFloat(orderValue)) || parseFloat(orderValue) <= 0) {
      newErrors.orderValue = language === 'nl' ? 'Geldige orderwaarde is verplicht' : 'Valid order value is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!validate()) {
      return;
    }

    setCreating(true);
    setCreationProgress(0);
    setCreationStatus(language === 'nl' ? 'Werkorder aanmaken...' : 'Creating work order...');
    
    // Retry logic for duplicate WO numbers
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        // Regenerate WO number on retry
        let currentWoNumber = woNumber;
        if (attempts > 0) {
          currentWoNumber = await SettingsService.generateWorkOrderNumber();
          setWoNumber(currentWoNumber);
        }
        
        // Get the primary product type (first in list) for the work order
        const primaryProductType = productBatches[0].productType;
        const totalBatchSize = getTotalItems();

        const { data: workOrder, error: woError } = await supabase
          .from('work_orders')
          .insert({
            wo_number: currentWoNumber,
            product_type: primaryProductType,
            batch_size: totalBatchSize,
            created_by: user.id,
            status: 'planned',
            start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
            shipping_date: shippingDate ? format(shippingDate, 'yyyy-MM-dd') : null,
            customer_name: customerName.trim(),
            external_order_number: externalOrderNumber.trim(),
            order_value: parseFloat(orderValue),
          })
          .select()
          .single();

        if (woError) {
          if (woError.code === '23505' && attempts < maxAttempts - 1) {
            attempts++;
            continue; // Retry with new WO number
          }
          throw woError;
        }

        // Generate serial numbers for each product batch using configured prefixes
        setCreationProgress(20);
        setCreationStatus(language === 'nl' ? 'Serienummers genereren...' : 'Generating serial numbers...');
        
        const prefixes = serialPrefixes || { SENSOR: 'Q', MLA: 'W', HMI: 'X', TRANSMITTER: 'T', SDM_ECO: 'SDM' };
        const serialFormat = await SettingsService.getSerialFormat();
        const items: any[] = [];
        let position = 1;
        
        // Extract just the sequence part from WO number for shorter serial numbers
        const woSuffix = currentWoNumber.replace(/[^0-9]/g, '').slice(-6) || Date.now().toString().slice(-6);

        for (const batch of productBatches) {
          const prefix = prefixes[batch.productType] || batch.productType.charAt(0);
          for (let i = 1; i <= batch.quantity; i++) {
            const paddedPosition = String(position).padStart(serialFormat.padLength, '0');
            const serialNumber = `${prefix}${serialFormat.separator}${woSuffix}${serialFormat.separator}${paddedPosition}`;
            items.push({
              work_order_id: workOrder.id,
              serial_number: serialNumber,
              position_in_batch: position,
              status: 'planned',
              assigned_to: user.id,
              product_type: batch.productType,
            });
            position++;
            
            // Update progress during generation for large batches
            if (totalBatchSize > 50 && position % 25 === 0) {
              setCreationProgress(20 + Math.floor((position / totalBatchSize) * 40));
            }
          }
        }

        setCreationProgress(60);
        setCreationStatus(language === 'nl' ? 'Items opslaan...' : 'Saving items...');

        // Insert items in batches of 100 for large orders
        const BATCH_SIZE = 100;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const batch = items.slice(i, i + BATCH_SIZE);
          const { error: itemsError } = await supabase
            .from('work_order_items')
            .insert(batch);

          if (itemsError) throw itemsError;
          
          // Update progress during insert
          setCreationProgress(60 + Math.floor(((i + batch.length) / items.length) * 30));
        }

        setCreationProgress(95);
        setCreationStatus(language === 'nl' ? 'Afronden...' : 'Finalizing...');

        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'create_work_order',
          entity_type: 'work_order',
          entity_id: workOrder.id,
          details: { 
            wo_number: currentWoNumber, 
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

        setCreationProgress(100);
        toast.success(t('success'), { description: `${t('workOrderNumber')} ${currentWoNumber} ${t('workOrderCreated')}` });
        onOpenChange(false);
        onSuccess();
        return;
        
      } catch (error: any) {
        if (error.code === '23505' && attempts < maxAttempts - 1) {
          attempts++;
          continue;
        }
        
        console.error('Error creating work order:', error);
        toast.error(t('error'), { description: error.message });
        break;
      }
    }
    
    setCreating(false);
    setCreationProgress(0);
    setCreationStatus('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{t('createWorkOrder')}</DialogTitle>
          <DialogDescription className="text-sm">{t('createWorkOrderDesc')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider">{t('workOrderNumber')}</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-2.5 rounded-md border bg-muted/50 font-mono text-sm font-semibold">
                {generatingWO ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
                className="h-9 w-9"
                onClick={generateWONumber}
                disabled={generatingWO}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${generatingWO ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {language === 'nl' ? 'Startdatum' : 'Start Date'} <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-10 px-3 text-base leading-5 font-normal flex items-center gap-2 justify-start text-left",
                      !startDate && "text-muted-foreground",
                      errors.startDate && "border-destructive",
                    )}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : <span>{t('selectDate')}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {language === 'nl' ? 'Verzenddatum' : 'Shipping Date'} <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-10 px-3 text-base leading-5 font-normal flex items-center gap-2 justify-start text-left",
                      !shippingDate && "text-muted-foreground",
                      errors.shippingDate && "border-destructive",
                    )}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {shippingDate ? format(shippingDate, "dd/MM/yyyy") : <span>{t('selectDate')}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={shippingDate}
                    onSelect={setShippingDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {errors.shippingDate && <p className="text-xs text-destructive">{errors.shippingDate}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {t('customer')} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t('customerPlaceholder')}
                className={cn("text-base", errors.customerName && "border-destructive")}
                maxLength={255}
              />
              {errors.customerName && <p className="text-xs text-destructive">{errors.customerName}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {t('orderNumber')} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={externalOrderNumber}
                onChange={(e) => setExternalOrderNumber(e.target.value)}
                placeholder={t('orderNumberPlaceholder')}
                className={cn("text-base", errors.externalOrderNumber && "border-destructive")}
                maxLength={100}
              />
              {errors.externalOrderNumber && <p className="text-xs text-destructive">{errors.externalOrderNumber}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">
              {t('value')} (€) <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={orderValue}
              onChange={(e) => setOrderValue(e.target.value)}
              placeholder="0.00"
              className={cn("text-base", errors.orderValue && "border-destructive")}
            />
            {errors.orderValue && <p className="text-xs text-destructive">{errors.orderValue}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium uppercase tracking-wider">{t('productBatches')}</Label>
              <Badge variant="secondary" className="text-[10px]">
                {getTotalItems()} {t('items')}
              </Badge>
            </div>
            
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {productBatches.map((batch) => (
                <div key={batch.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                  <div className="flex-1">
                    <Select
                      value={batch.productType}
                      onValueChange={(value: ProductType) => updateProductBatch(batch.id, 'productType', value)}
                    >
                      <SelectTrigger className="h-8 text-xs border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_TYPES.map(type => (
                          <SelectItem key={type} value={type} className="text-xs">
                            {formatProductType(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-16">
                    <Input
                      type="number"
                      min="1"
                      max="500"
                      value={batch.quantity}
                      onChange={(e) => updateProductBatch(batch.id, 'quantity', Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="h-8 text-center text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeProductBatch(batch.id)}
                    disabled={productBatches.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={addProductBatch}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t('addProductBatch')}
            </Button>

            {/* Large batch warning */}
            {getTotalItems() > 100 && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {language === 'nl' 
                    ? `Grote batch: ${getTotalItems()} items. Dit kan enige tijd duren om aan te maken.`
                    : `Large batch: ${getTotalItems()} items. This may take a moment to create.`
                  }
                </p>
              </div>
            )}
          </div>

          {/* Progress indicator during creation */}
          {creating && (
            <div className="space-y-2 p-3 rounded-md border bg-muted/30">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{creationStatus}</span>
                <span className="font-medium">{creationProgress}%</span>
              </div>
              <Progress value={creationProgress} className="h-2" />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} size="sm" className="flex-1">
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={creating} variant="default" size="sm" className="flex-1">
              {creating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}