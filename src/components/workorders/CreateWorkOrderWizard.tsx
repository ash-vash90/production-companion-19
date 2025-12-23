import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Loader2, 
  Plus, 
  Trash2, 
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
import { formatProductType, cn } from '@/lib/utils';
import { SettingsService, SerialPrefixes } from '@/services/settingsService';
import { format } from 'date-fns';
import { triggerWebhook } from '@/lib/webhooks';
import { CustomerSelect } from './CustomerSelect';

type ProductType = 'SDM_ECO' | 'SENSOR' | 'MLA' | 'HMI' | 'TRANSMITTER';

interface ProductBatch {
  id: string;
  productType: ProductType;
  quantity: number;
}

interface CreateWorkOrderWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const PRODUCT_TYPES: ProductType[] = ['SDM_ECO', 'SENSOR', 'MLA', 'HMI', 'TRANSMITTER'];

type WizardStep = 'form' | 'sending' | 'waiting' | 'synced' | 'error';

// Sync polling config
const SYNC_POLL_INTERVAL = 3000; // 3 seconds
const SYNC_TIMEOUT = 120000; // 2 minutes

export function CreateWorkOrderWizard({ open, onOpenChange, onSuccess }: CreateWorkOrderWizardProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  
  // Form state
  const [shopOrderNumber, setShopOrderNumber] = useState('');
  const [serialPrefixes, setSerialPrefixes] = useState<SerialPrefixes | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [shippingDate, setShippingDate] = useState<Date | undefined>(undefined);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [externalOrderNumber, setExternalOrderNumber] = useState('');
  const [productBatches, setProductBatches] = useState<ProductBatch[]>([
    { id: crypto.randomUUID(), productType: 'SDM_ECO', quantity: 1 }
  ]);
  
  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>('form');
  const [createdWorkOrderId, setCreatedWorkOrderId] = useState<string | null>(null);
  const [exactShopOrderNumber, setExactShopOrderNumber] = useState<string | null>(null);
  const [exactShopOrderLink, setExactShopOrderLink] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncStartTime, setSyncStartTime] = useState<number | null>(null);
  
  // Validation errors
  const [errors, setErrors] = useState<{
    shopOrderNumber?: string;
    startDate?: string;
    shippingDate?: string;
    customerName?: string;
    externalOrderNumber?: string;
  }>({});

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      loadSerialPrefixes();
      setWizardStep('form');
      setShopOrderNumber('');
      setStartDate(undefined);
      setShippingDate(undefined);
      setCustomerId(null);
      setCustomerName('');
      setExternalOrderNumber('');
      setProductBatches([{ id: crypto.randomUUID(), productType: 'SDM_ECO', quantity: 1 }]);
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
          .select('sync_status, exact_shop_order_number, exact_shop_order_link, last_sync_error')
          .eq('id', createdWorkOrderId)
          .single();
        
        if (error) throw error;
        
        if (data.sync_status === 'synced') {
          setExactShopOrderNumber(data.exact_shop_order_number);
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

  const handleCustomerChange = (id: string | null, name: string | null) => {
    setCustomerId(id);
    setCustomerName(name || '');
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!shopOrderNumber.trim()) {
      newErrors.shopOrderNumber = language === 'nl' ? 'Werkordernummer is verplicht' : 'Shop order number is required';
    }

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
      newErrors.customerName = language === 'nl' ? 'Klant is verplicht' : 'Customer is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!validate()) return;

    setWizardStep('sending');
    
    try {
      const primaryProductType = productBatches[0].productType;
      const totalBatchSize = getTotalItems();

      // Create work order with sync_status = 'waiting_for_exact'
      const { data: workOrder, error: woError } = await supabase
        .from('work_orders')
        .insert({
          wo_number: shopOrderNumber.trim(),
          product_type: primaryProductType,
          batch_size: totalBatchSize,
          created_by: user.id,
          status: 'planned',
          start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
          shipping_date: shippingDate ? format(shippingDate, 'yyyy-MM-dd') : null,
          customer_name: customerName.trim(),
          customer_id: customerId,
          external_order_number: externalOrderNumber.trim() || null,
          sync_status: 'waiting_for_exact',
        })
        .select()
        .single();

      if (woError) throw woError;

      setCreatedWorkOrderId(workOrder.id);

      // Generate serial numbers for each product batch
      const prefixes = serialPrefixes || { SENSOR: 'Q', MLA: 'W', HMI: 'X', TRANSMITTER: 'T', SDM_ECO: 'SDM' };
      const serialFormat = await SettingsService.getSerialFormat();
      const items: any[] = [];
      let position = 1;
      
      const woSuffix = shopOrderNumber.replace(/[^0-9]/g, '').slice(-6) || Date.now().toString().slice(-6);

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
        }
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
          wo_number: shopOrderNumber.trim(), 
          product_batches: productBatches.map(b => ({ type: b.productType, quantity: b.quantity })),
          total_items: totalBatchSize 
        },
      });

      // Trigger webhook for work order creation (to Zapier → Exact)
      await triggerWebhook('shopOrder.create.requested', {
        work_order_id: workOrder.id,
        shop_order_number: shopOrderNumber.trim(),
        product_type: primaryProductType,
        batch_size: totalBatchSize,
        product_batches: productBatches.map(b => ({ type: b.productType, quantity: b.quantity })),
        customer_id: customerId,
        customer_name: customerName.trim(),
        external_order_number: externalOrderNumber.trim() || null,
        start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
        shipping_date: shippingDate ? format(shippingDate, 'yyyy-MM-dd') : null,
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
          sync_retry_count: supabase.rpc ? 1 : 1, // Increment would be ideal
        })
        .eq('id', createdWorkOrderId);
      
      // Re-trigger webhook
      const { data: workOrder } = await supabase
        .from('work_orders')
        .select('*, work_order_items(serial_number)')
        .eq('id', createdWorkOrderId)
        .single();
      
      if (workOrder) {
        await triggerWebhook('workOrder.create.requested', {
          work_order_id: workOrder.id,
          wo_number: workOrder.wo_number,
          product_type: workOrder.product_type,
          batch_size: workOrder.batch_size,
          customer_name: workOrder.customer_name,
          external_order_number: workOrder.external_order_number,
          start_date: workOrder.start_date,
          shipping_date: workOrder.shipping_date,
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
          {language === 'nl' ? 'Werkordernummer' : 'Shop Order Number'} <span className="text-destructive">*</span>
        </Label>
        <Input
          value={shopOrderNumber}
          onChange={(e) => setShopOrderNumber(e.target.value)}
          placeholder={language === 'nl' ? 'bijv. SO-2024-001234' : 'e.g. SO-2024-001234'}
          className={cn("font-mono text-base", errors.shopOrderNumber && "border-destructive")}
          maxLength={50}
        />
        {errors.shopOrderNumber && <p className="text-xs text-destructive">{errors.shopOrderNumber}</p>}
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
                {startDate ? format(startDate, "dd/MM/yyyy") : <span>{language === 'nl' ? 'Selecteer datum' : 'Select date'}</span>}
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
                {shippingDate ? format(shippingDate, "dd/MM/yyyy") : <span>{language === 'nl' ? 'Selecteer datum' : 'Select date'}</span>}
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
            {language === 'nl' ? 'Klant' : 'Customer'} <span className="text-destructive">*</span>
          </Label>
          <CustomerSelect
            value={customerId}
            onChange={handleCustomerChange}
            error={errors.customerName}
          />
          {errors.customerName && <p className="text-xs text-destructive">{errors.customerName}</p>}
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium">
            {language === 'nl' ? 'Ordernummer' : 'Order Number'} <span className="text-destructive">*</span>
          </Label>
          <Input
            value={externalOrderNumber}
            onChange={(e) => setExternalOrderNumber(e.target.value)}
            placeholder={language === 'nl' ? 'bijv. PO-12345' : 'e.g. PO-12345'}
            className={cn("text-base", errors.externalOrderNumber && "border-destructive")}
            maxLength={100}
          />
          {errors.externalOrderNumber && <p className="text-xs text-destructive">{errors.externalOrderNumber}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium uppercase tracking-wider">
            {language === 'nl' ? 'Productbatches' : 'Product Batches'}
          </Label>
          <Badge variant="secondary" className="font-mono">
            {getTotalItems()} {language === 'nl' ? 'items totaal' : 'items total'}
          </Badge>
        </div>
        
        <div className="space-y-2">
          {productBatches.map((batch, index) => (
            <div key={batch.id} className="flex items-center gap-2">
              <Select
                value={batch.productType}
                onValueChange={(value) => updateProductBatch(batch.id, 'productType', value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map(type => (
                    <SelectItem key={type} value={type}>
                      {formatProductType(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="1"
                max="1000"
                value={batch.quantity}
                onChange={(e) => updateProductBatch(batch.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-center"
              />
              {productBatches.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  onClick={() => removeProductBatch(batch.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addProductBatch}
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {language === 'nl' ? 'Product toevoegen' : 'Add Product'}
        </Button>
      </div>

      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {language === 'nl' ? 'Annuleren' : 'Cancel'}
        </Button>
        <Button type="submit" disabled={!shopOrderNumber.trim()}>
          <Send className="h-4 w-4 mr-2" />
          {language === 'nl' ? 'Aanmaken & Sync' : 'Create & Sync'}
        </Button>
      </DialogFooter>
    </form>
  );

  const renderSendingStep = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <div className="relative rounded-full bg-primary/10 p-4">
          <Send className="h-8 w-8 text-primary animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <h3 className="font-semibold">
          {language === 'nl' ? 'Verzoek verzenden...' : 'Sending Request...'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {language === 'nl' ? 'Werkorder wordt aangemaakt en naar Exact gestuurd' : 'Creating work order and sending to Exact'}
        </p>
      </div>
      <Progress value={33} className="w-48" />
    </div>
  );

  const renderWaitingStep = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <div className="rounded-full bg-yellow-500/10 p-4">
        <Clock className="h-8 w-8 text-yellow-600 animate-pulse" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="font-semibold">
          {language === 'nl' ? 'Wacht op Exact...' : 'Waiting for Exact...'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {language === 'nl' 
            ? 'Dit duurt meestal minder dan 30 seconden' 
            : 'This usually takes less than 30 seconds'}
        </p>
      </div>
      <Progress value={66} className="w-48" />
      <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
        {language === 'nl' ? 'Op achtergrond' : 'Run in Background'}
      </Button>
    </div>
  );

  const renderSyncedStep = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      <div className="rounded-full bg-green-500/10 p-4">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">
          {language === 'nl' ? 'Gesynchroniseerd!' : 'Synced Successfully!'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {language === 'nl' 
            ? 'Werkorder is aangemaakt in Exact' 
            : 'Work order has been created in Exact'}
        </p>
      </div>
      
      {exactShopOrderNumber && (
        <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {language === 'nl' ? 'Exact Werkorder Nummer' : 'Exact Shop Order Number'}
          </p>
          <p className="font-mono text-xl font-bold">{exactShopOrderNumber}</p>
        </div>
      )}
      
      <div className="flex gap-3">
        {exactShopOrderLink && (
          <Button variant="outline" asChild>
            <a href={exactShopOrderLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              {language === 'nl' ? 'Open in Exact' : 'Open in Exact'}
            </a>
          </Button>
        )}
        <Button onClick={handleClose}>
          <ArrowRight className="h-4 w-4 mr-2" />
          {language === 'nl' ? 'Bekijk in App' : 'View in App'}
        </Button>
      </div>
    </div>
  );

  const renderErrorStep = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">
          {language === 'nl' ? 'Synchronisatie Mislukt' : 'Sync Failed'}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {syncError || (language === 'nl' 
            ? 'Er is een fout opgetreden bij het synchroniseren met Exact' 
            : 'An error occurred while syncing with Exact')}
        </p>
      </div>
      
      <div className="flex gap-3">
        <Button variant="outline" onClick={handleClose}>
          {language === 'nl' ? 'Sluiten' : 'Close'}
        </Button>
        <Button onClick={handleRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {language === 'nl' ? 'Opnieuw proberen' : 'Retry'}
        </Button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (wizardStep) {
      case 'form':
        return renderFormStep();
      case 'sending':
        return renderSendingStep();
      case 'waiting':
        return renderWaitingStep();
      case 'synced':
        return renderSyncedStep();
      case 'error':
        return renderErrorStep();
      default:
        return renderFormStep();
    }
  };

  const getDialogTitle = () => {
    switch (wizardStep) {
      case 'sending':
      case 'waiting':
        return language === 'nl' ? 'Werkorder Aanmaken' : 'Creating Work Order';
      case 'synced':
        return language === 'nl' ? 'Werkorder Aangemaakt' : 'Work Order Created';
      case 'error':
        return language === 'nl' ? 'Fout' : 'Error';
      default:
        return language === 'nl' ? 'Nieuwe Werkorder' : 'New Work Order';
    }
  };

  return (
    <Dialog open={open} onOpenChange={wizardStep === 'form' || wizardStep === 'synced' || wizardStep === 'error' ? onOpenChange : undefined}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{getDialogTitle()}</DialogTitle>
          {wizardStep === 'form' && (
            <DialogDescription className="text-sm">
              {language === 'nl' 
                ? 'Maak een nieuwe werkorder aan die synchroniseert met Exact' 
                : 'Create a new work order that syncs with Exact'}
            </DialogDescription>
          )}
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}

export default CreateWorkOrderWizard;
