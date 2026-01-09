import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Loader2, 
  CalendarIcon, 
  CheckCircle, 
  Clock, 
  ExternalLink,
  AlertCircle,
  Send,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { SettingsService, SerialPrefixes } from '@/services/settingsService';
import { format } from 'date-fns';
import { triggerWebhook } from '@/lib/webhooks';
import { ProductSelect } from './ProductSelect';

interface Product {
  id: string;
  exact_item_id: string;
  item_code: string;
  name: string;
  name_nl: string | null;
  product_type: string;
}

interface CreateWorkOrderWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type WizardStep = 'form' | 'sending' | 'waiting' | 'synced' | 'error';

// Sync polling config
const SYNC_POLL_INTERVAL = 3000; // 3 seconds
const SYNC_TIMEOUT = 120000; // 2 minutes

export function CreateWorkOrderWizard({ open, onOpenChange, onSuccess }: CreateWorkOrderWizardProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  
  // Form state
  const [serialPrefixes, setSerialPrefixes] = useState<SerialPrefixes | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [plannedStartDate, setPlannedStartDate] = useState<Date | undefined>(undefined);
  const [plannedEndDate, setPlannedEndDate] = useState<Date | undefined>(undefined);
  
  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>('form');
  const [createdWorkOrderId, setCreatedWorkOrderId] = useState<string | null>(null);
  const [exactShopOrderNumber, setExactShopOrderNumber] = useState<string | null>(null);
  const [exactShopOrderLink, setExactShopOrderLink] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncStartTime, setSyncStartTime] = useState<number | null>(null);
  
  // Validation errors
  const [errors, setErrors] = useState<{
    product?: string;
    quantity?: string;
    plannedStartDate?: string;
    plannedEndDate?: string;
  }>({});

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      loadSerialPrefixes();
      setWizardStep('form');
      setProductId(null);
      setSelectedProduct(null);
      setQuantity(1);
      setPlannedStartDate(undefined);
      setPlannedEndDate(undefined);
      setErrors({});
      setCreatedWorkOrderId(null);
      setExactShopOrderNumber(null);
      setExactShopOrderLink(null);
      setSyncError(null);
      setSyncStartTime(null);
    }
  }, [open]);

  // Poll for sync status when waiting
  useEffect(() => {
    if (wizardStep !== 'waiting' || !createdWorkOrderId) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('work_orders')
          .select('sync_status, exact_shop_order_number, exact_shop_order_link, last_sync_error, wo_number')
          .eq('id', createdWorkOrderId)
          .single();
        
        if (error) throw error;
        
        if (data.sync_status === 'synced') {
          setExactShopOrderNumber(data.exact_shop_order_number || data.wo_number);
          setExactShopOrderLink(data.exact_shop_order_link);
          setWizardStep('synced');
          clearInterval(pollInterval);
        } else if (data.sync_status === 'sync_failed') {
          setSyncError(data.last_sync_error || 'Sync failed');
          setWizardStep('error');
          clearInterval(pollInterval);
        }
        
        // Check timeout
        if (syncStartTime && Date.now() - syncStartTime > SYNC_TIMEOUT) {
          setSyncError(language === 'nl' 
            ? 'Synchronisatie timeout - probeer opnieuw' 
            : 'Sync timeout - please retry'
          );
          setWizardStep('error');
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Error polling sync status:', err);
      }
    }, SYNC_POLL_INTERVAL);
    
    return () => clearInterval(pollInterval);
  }, [wizardStep, createdWorkOrderId, syncStartTime, language]);

  const loadSerialPrefixes = async () => {
    const prefixes = await SettingsService.getSerialPrefixes();
    setSerialPrefixes(prefixes);
  };

  const handleProductChange = (id: string | null, product: Product | null) => {
    setProductId(id);
    setSelectedProduct(product);
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!productId || !selectedProduct) {
      newErrors.product = language === 'nl' ? 'Item is verplicht' : 'Item is required';
    }

    if (!quantity || quantity < 1) {
      newErrors.quantity = language === 'nl' ? 'Aantal moet minimaal 1 zijn' : 'Quantity must be at least 1';
    }

    if (!plannedStartDate) {
      newErrors.plannedStartDate = language === 'nl' ? 'Geplande startdatum is verplicht' : 'Planned start date is required';
    }

    if (!plannedEndDate) {
      newErrors.plannedEndDate = language === 'nl' ? 'Geplande einddatum is verplicht' : 'Planned end date is required';
    }

    if (plannedStartDate && plannedEndDate && plannedStartDate > plannedEndDate) {
      newErrors.plannedEndDate = language === 'nl' ? 'Einddatum moet na startdatum zijn' : 'End date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProduct) return;

    if (!validate()) return;

    setWizardStep('sending');
    
    try {
      const productType = selectedProduct.product_type as any;
      
      // Generate a temporary WO number (will be replaced by Exact sync)
      const tempWoNumber = `PENDING-${Date.now()}`;

      // Create work order with sync_status = 'waiting_for_exact'
      const { data: workOrder, error: woError } = await supabase
        .from('work_orders')
        .insert({
          wo_number: tempWoNumber,
          product_type: productType,
          batch_size: quantity,
          created_by: user.id,
          status: 'planned',
          start_date: plannedStartDate ? format(plannedStartDate, 'yyyy-MM-dd') : null,
          shipping_date: plannedEndDate ? format(plannedEndDate, 'yyyy-MM-dd') : null,
          product_id: productId,
          sync_status: 'waiting_for_exact',
        })
        .select()
        .single();

      if (woError) throw woError;

      setCreatedWorkOrderId(workOrder.id);

      // Generate serial numbers
      const prefixes = serialPrefixes || { SENSOR: 'Q', MLA: 'W', HMI: 'X', TRANSMITTER: 'T', SDM_ECO: 'SDM' };
      const serialFormat = await SettingsService.getSerialFormat();
      const items: any[] = [];
      
      const woSuffix = Date.now().toString().slice(-6);
      const prefix = prefixes[productType as keyof typeof prefixes] || productType.charAt(0);

      for (let i = 1; i <= quantity; i++) {
        const paddedPosition = String(i).padStart(serialFormat.padLength, '0');
        const serialNumber = `${prefix}${serialFormat.separator}${woSuffix}${serialFormat.separator}${paddedPosition}`;
        items.push({
          work_order_id: workOrder.id,
          serial_number: serialNumber,
          position_in_batch: i,
          status: 'planned',
          assigned_to: user.id,
          product_type: productType,
        });
      }

      // Insert items in batches
      const BATCH_SIZE = 100;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const { error: itemsError } = await supabase
          .from('work_order_items')
          .insert(batch);
        if (itemsError) throw itemsError;
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'create_work_order',
        entity_type: 'work_order',
        entity_id: workOrder.id,
        details: { 
          product_id: productId,
          item_code: selectedProduct.item_code,
          product_name: selectedProduct.name,
          quantity,
        },
      });

      // Trigger webhook for work order creation (to Zapier → Exact)
      await triggerWebhook('shopOrder.create.requested', {
        work_order_id: workOrder.id,
        product_id: productId,
        exact_item_id: selectedProduct.exact_item_id,
        item_code: selectedProduct.item_code,
        product_name: selectedProduct.name,
        product_type: productType,
        quantity: quantity,
        planned_start_date: plannedStartDate ? format(plannedStartDate, 'yyyy-MM-dd') : null,
        planned_end_date: plannedEndDate ? format(plannedEndDate, 'yyyy-MM-dd') : null,
        serial_numbers: items.map(i => i.serial_number),
      });

      // Move to waiting step
      setSyncStartTime(Date.now());
      setWizardStep('waiting');

    } catch (error: any) {
      console.error('Error creating work order:', error);
      setSyncError(error.message);
      setWizardStep('error');
    }
  };

  const handleRetry = async () => {
    if (!createdWorkOrderId) return;
    
    setWizardStep('sending');
    setSyncError(null);
    
    try {
      // Update sync status and retry
      await supabase
        .from('work_orders')
        .update({ 
          sync_status: 'waiting_for_exact',
          last_sync_error: null,
        })
        .eq('id', createdWorkOrderId);
      
      // Re-trigger webhook
      const { data: workOrder } = await supabase
        .from('work_orders')
        .select('*, work_order_items(serial_number), products!product_id(exact_item_id, item_code, name)')
        .eq('id', createdWorkOrderId)
        .single();
      
      if (workOrder) {
        const product = (workOrder as any).products;
        await triggerWebhook('shopOrder.create.requested', {
          work_order_id: workOrder.id,
          product_id: workOrder.product_id,
          exact_item_id: product?.exact_item_id,
          item_code: product?.item_code,
          product_name: product?.name,
          product_type: workOrder.product_type,
          quantity: workOrder.batch_size,
          planned_start_date: workOrder.start_date,
          planned_end_date: workOrder.shipping_date,
          serial_numbers: workOrder.work_order_items?.map((i: any) => i.serial_number) || [],
          retry: true,
        });
      }
      
      setSyncStartTime(Date.now());
      setWizardStep('waiting');
    } catch (error: any) {
      setSyncError(error.message);
      setWizardStep('error');
    }
  };

  const handleClose = () => {
    if (wizardStep === 'synced') {
      onSuccess();
    }
    onOpenChange(false);
  };

  const renderFormStep = () => (
    <form onSubmit={handleCreate} className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-wider">
          {language === 'nl' ? 'Item' : 'Item'} <span className="text-destructive">*</span>
        </Label>
        <ProductSelect
          value={productId}
          onChange={handleProductChange}
          error={errors.product}
        />
        {errors.product && <p className="text-xs text-destructive">{errors.product}</p>}
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-wider">
          {language === 'nl' ? 'Gepland aantal' : 'Planned Quantity'} <span className="text-destructive">*</span>
        </Label>
        <Input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          className={cn("text-base", errors.quantity && "border-destructive")}
        />
        {errors.quantity && <p className="text-xs text-destructive">{errors.quantity}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs font-medium">
            {language === 'nl' ? 'Geplande startdatum' : 'Planned Start Date'} <span className="text-destructive">*</span>
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full h-10 px-3 text-base leading-5 font-normal flex items-center gap-2 justify-start text-left",
                  !plannedStartDate && "text-muted-foreground",
                  errors.plannedStartDate && "border-destructive",
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                {plannedStartDate ? format(plannedStartDate, "dd/MM/yyyy") : <span>{language === 'nl' ? 'Selecteer datum' : 'Select date'}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={plannedStartDate}
                onSelect={setPlannedStartDate}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {errors.plannedStartDate && <p className="text-xs text-destructive">{errors.plannedStartDate}</p>}
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium">
            {language === 'nl' ? 'Geplande einddatum' : 'Planned End Date'} <span className="text-destructive">*</span>
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full h-10 px-3 text-base leading-5 font-normal flex items-center gap-2 justify-start text-left",
                  !plannedEndDate && "text-muted-foreground",
                  errors.plannedEndDate && "border-destructive",
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                {plannedEndDate ? format(plannedEndDate, "dd/MM/yyyy") : <span>{language === 'nl' ? 'Selecteer datum' : 'Select date'}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={plannedEndDate}
                onSelect={setPlannedEndDate}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {errors.plannedEndDate && <p className="text-xs text-destructive">{errors.plannedEndDate}</p>}
        </div>
      </div>

      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {language === 'nl' ? 'Annuleren' : 'Cancel'}
        </Button>
        <Button type="submit" disabled={!productId}>
          <Send className="mr-2 h-4 w-4" />
          {language === 'nl' ? 'Aanmaken & Sync naar Exact' : 'Create & Sync to Exact'}
        </Button>
      </DialogFooter>
    </form>
  );

  const renderSendingStep = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="text-lg font-medium">
        {language === 'nl' ? 'Werkorder aanmaken...' : 'Creating shop order...'}
      </p>
      <p className="text-sm text-muted-foreground">
        {language === 'nl' ? 'Even geduld...' : 'Please wait...'}
      </p>
    </div>
  );

  const renderWaitingStep = () => {
    const elapsed = syncStartTime ? Math.floor((Date.now() - syncStartTime) / 1000) : 0;
    const progress = Math.min((elapsed / (SYNC_TIMEOUT / 1000)) * 100, 95);
    
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-6">
        <div className="relative">
          <Clock className="h-16 w-16 text-primary animate-pulse" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">
            {language === 'nl' ? 'Wachten op Exact...' : 'Waiting for Exact...'}
          </p>
          <p className="text-sm text-muted-foreground max-w-md">
            {language === 'nl' 
              ? 'De werkorder wordt gesynchroniseerd met Exact. Dit kan even duren.'
              : 'The shop order is being synced with Exact. This may take a moment.'}
          </p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            {elapsed}s / {SYNC_TIMEOUT / 1000}s
          </p>
        </div>
      </div>
    );
  };

  const renderSyncedStep = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
        <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
      </div>
      <div className="text-center space-y-2">
        <p className="text-lg font-medium">
          {language === 'nl' ? 'Werkorder gesynchroniseerd!' : 'Shop Order Synced!'}
        </p>
        {exactShopOrderNumber && (
          <p className="text-2xl font-bold text-primary">
            {exactShopOrderNumber}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {language === 'nl' 
            ? 'Ga naar Exact om materialen te selecteren.'
            : 'Go to Exact to pick materials.'}
        </p>
      </div>
      
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {exactShopOrderLink && (
          <Button asChild className="w-full">
            <a href={exactShopOrderLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              {language === 'nl' ? 'Openen in Exact' : 'Open in Exact'}
            </a>
          </Button>
        )}
        <Button variant="outline" onClick={handleClose} className="w-full">
          {language === 'nl' ? 'Sluiten' : 'Close'}
        </Button>
      </div>
    </div>
  );

  const renderErrorStep = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
      </div>
      <div className="text-center space-y-2">
        <p className="text-lg font-medium">
          {language === 'nl' ? 'Synchronisatie mislukt' : 'Sync Failed'}
        </p>
        <p className="text-sm text-muted-foreground max-w-md">
          {syncError || (language === 'nl' ? 'Er is een fout opgetreden' : 'An error occurred')}
        </p>
      </div>
      
      <div className="flex gap-3">
        <Button variant="outline" onClick={handleClose}>
          {language === 'nl' ? 'Sluiten' : 'Close'}
        </Button>
        <Button onClick={handleRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {language === 'nl' ? 'Opnieuw proberen' : 'Retry'}
        </Button>
      </div>
    </div>
  );

  const getDialogTitle = () => {
    switch (wizardStep) {
      case 'form':
        return language === 'nl' ? 'Nieuwe werkorder' : 'New Shop Order';
      case 'sending':
        return language === 'nl' ? 'Aanmaken...' : 'Creating...';
      case 'waiting':
        return language === 'nl' ? 'Synchroniseren' : 'Syncing';
      case 'synced':
        return language === 'nl' ? 'Voltooid' : 'Complete';
      case 'error':
        return language === 'nl' ? 'Fout' : 'Error';
    }
  };

  return (
    <Dialog open={open} onOpenChange={wizardStep === 'form' || wizardStep === 'synced' || wizardStep === 'error' ? onOpenChange : undefined}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          {wizardStep === 'form' && (
            <DialogDescription>
              {language === 'nl' 
                ? 'Selecteer het item en de hoeveelheid. De werkorder wordt gesynchroniseerd met Exact.'
                : 'Select the item and quantity. The shop order will be synced with Exact.'}
            </DialogDescription>
          )}
        </DialogHeader>

        {wizardStep === 'form' && renderFormStep()}
        {wizardStep === 'sending' && renderSendingStep()}
        {wizardStep === 'waiting' && renderWaitingStep()}
        {wizardStep === 'synced' && renderSyncedStep()}
        {wizardStep === 'error' && renderErrorStep()}
      </DialogContent>
    </Dialog>
  );
}
