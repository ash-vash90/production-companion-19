import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link2, CheckCircle2, AlertCircle, Loader2, ScanBarcode, Search, Star, Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

interface SubAssemblyLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentItemId: string;
  parentSerialNumber: string;
  expectedComponentType: 'SENSOR' | 'MLA' | 'HMI' | 'TRANSMITTER';
  stepExecutionId: string;
  onComplete: () => void;
  parentWorkOrderId?: string;
  parentCustomerName?: string;
}

interface AvailableComponent {
  id: string;
  serial_number: string;
  completed_at: string;
  work_order: {
    wo_number: string;
    customer_name: string | null;
    id: string;
  };
}

const COMPONENT_PREFIXES: Record<string, string> = {
  SENSOR: 'Q-',
  MLA: 'W-',
  HMI: 'X-',
  TRANSMITTER: 'T-',
};

const SubAssemblyLinkDialog: React.FC<SubAssemblyLinkDialogProps> = ({
  open,
  onOpenChange,
  parentItemId,
  parentSerialNumber,
  expectedComponentType,
  stepExecutionId,
  onComplete,
  parentWorkOrderId,
  parentCustomerName,
}) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [serialNumber, setSerialNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
    childItem?: any;
  } | null>(null);
  const [existingLink, setExistingLink] = useState<any>(null);
  const [availableComponents, setAvailableComponents] = useState<AvailableComponent[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Check for existing link and fetch available components on open
  useEffect(() => {
    if (open) {
      checkExistingLink();
      fetchAvailableComponents();
      setSerialNumber('');
      setValidationResult(null);
      setSearchFilter('');
    }
  }, [open, parentItemId, expectedComponentType]);

  const checkExistingLink = async () => {
    const { data } = await supabase
      .from('sub_assemblies')
      .select(`
        id,
        child_item:work_order_items!sub_assemblies_child_item_id_fkey(
          id,
          serial_number,
          status,
          product_type
        )
      `)
      .eq('parent_item_id', parentItemId)
      .eq('component_type', expectedComponentType)
      .maybeSingle();
    
    setExistingLink(data);
  };

  const fetchAvailableComponents = async () => {
    setLoadingAvailable(true);
    try {
      // Get all completed items of the expected type
      const { data: completedItems, error } = await supabase
        .from('work_order_items')
        .select(`
          id,
          serial_number,
          completed_at,
          work_order:work_orders!work_order_items_work_order_id_fkey(
            id,
            wo_number,
            customer_name
          )
        `)
        .eq('status', 'completed')
        .eq('product_type', expectedComponentType)
        .order('completed_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get all already-linked child items
      const { data: linkedItems } = await supabase
        .from('sub_assemblies')
        .select('child_item_id');

      const linkedIds = new Set(linkedItems?.map(l => l.child_item_id) || []);

      // Filter out already linked items
      const available = (completedItems || [])
        .filter(item => !linkedIds.has(item.id))
        .map(item => ({
          id: item.id,
          serial_number: item.serial_number,
          completed_at: item.completed_at || '',
          work_order: {
            id: item.work_order?.id || '',
            wo_number: item.work_order?.wo_number || '',
            customer_name: item.work_order?.customer_name || null,
          },
        }));

      setAvailableComponents(available);
    } catch (error) {
      console.error('Error fetching available components:', error);
    } finally {
      setLoadingAvailable(false);
    }
  };

  const validateSerialNumber = async (serial: string) => {
    if (!serial.trim()) {
      setValidationResult(null);
      return;
    }

    setValidating(true);
    try {
      // Check prefix matches expected component type
      const expectedPrefix = COMPONENT_PREFIXES[expectedComponentType];
      if (!serial.toUpperCase().startsWith(expectedPrefix)) {
        setValidationResult({
          valid: false,
          message: language === 'nl' 
            ? `Serienummer moet beginnen met ${expectedPrefix} voor ${expectedComponentType}` 
            : `Serial number must start with ${expectedPrefix} for ${expectedComponentType}`,
        });
        return;
      }

      // Find the item
      const { data: childItem, error } = await supabase
        .from('work_order_items')
        .select('*, work_order:work_orders!work_order_items_work_order_id_fkey(product_type)')
        .eq('serial_number', serial.toUpperCase())
        .maybeSingle();

      if (error) throw error;

      if (!childItem) {
        setValidationResult({
          valid: false,
          message: language === 'nl' ? 'Serienummer niet gevonden' : 'Serial number not found',
        });
        return;
      }

      // Check component is the right type
      const childProductType = childItem.product_type || childItem.work_order?.product_type;
      if (childProductType !== expectedComponentType) {
        setValidationResult({
          valid: false,
          message: language === 'nl'
            ? `Dit is een ${childProductType}, verwacht ${expectedComponentType}`
            : `This is a ${childProductType}, expected ${expectedComponentType}`,
        });
        return;
      }

      // Check component is completed
      if (childItem.status !== 'completed') {
        setValidationResult({
          valid: false,
          message: language === 'nl'
            ? `Component moet eerst voltooid zijn (huidige status: ${childItem.status})`
            : `Component must be completed first (current status: ${childItem.status})`,
        });
        return;
      }

      // Check not already linked to another parent
      const { data: existingLink } = await supabase
        .from('sub_assemblies')
        .select('parent_item:work_order_items!sub_assemblies_parent_item_id_fkey(serial_number)')
        .eq('child_item_id', childItem.id)
        .maybeSingle();

      if (existingLink) {
        setValidationResult({
          valid: false,
          message: language === 'nl'
            ? `Al gekoppeld aan ${existingLink.parent_item.serial_number}`
            : `Already linked to ${existingLink.parent_item.serial_number}`,
        });
        return;
      }

      setValidationResult({
        valid: true,
        message: language === 'nl' ? 'Klaar om te koppelen' : 'Ready to link',
        childItem,
      });
    } catch (error) {
      console.error('Validation error:', error);
      setValidationResult({
        valid: false,
        message: language === 'nl' ? 'Validatiefout' : 'Validation error',
      });
    } finally {
      setValidating(false);
    }
  };

  // Debounced validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (serialNumber.length >= 3) {
        validateSerialNumber(serialNumber);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [serialNumber]);

  const handleLink = async () => {
    if (!validationResult?.valid || !validationResult.childItem || !user) return;

    setLoading(true);
    try {
      // Create the sub-assembly link
      const { data: linkData, error: linkError } = await supabase
        .from('sub_assemblies')
        .insert({
          parent_item_id: parentItemId,
          child_item_id: validationResult.childItem.id,
          component_type: expectedComponentType,
          linked_by: user.id,
        })
        .select()
        .single();

      if (linkError) throw linkError;

      // Update step execution with the scanned barcode
      await supabase
        .from('step_executions')
        .update({ 
          barcode_scanned: serialNumber.toUpperCase(),
          validation_status: 'passed',
          validation_message: `Linked ${expectedComponentType}: ${serialNumber.toUpperCase()}`,
        })
        .eq('id', stepExecutionId);

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'link_subassembly',
        entity_type: 'sub_assembly',
        entity_id: linkData.id,
        details: {
          parent_serial: parentSerialNumber,
          child_serial: serialNumber.toUpperCase(),
          component_type: expectedComponentType,
        },
      });

      toast.success(
        language === 'nl' ? 'Component gekoppeld' : 'Component linked',
        { description: `${expectedComponentType}: ${serialNumber.toUpperCase()}` }
      );
      
      onComplete();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error linking component:', error);
      toast.error(t('error'), { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const selectComponent = (component: AvailableComponent) => {
    setSerialNumber(component.serial_number);
  };

  const componentLabel = {
    SENSOR: language === 'nl' ? 'Sensor' : 'Sensor',
    MLA: 'MLA',
    HMI: 'HMI',
    TRANSMITTER: language === 'nl' ? 'Transmitter' : 'Transmitter',
  }[expectedComponentType];

  // Filter and sort available components
  const filteredComponents = availableComponents
    .filter(c => 
      searchFilter === '' || 
      c.serial_number.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.work_order.wo_number.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (c.work_order.customer_name?.toLowerCase().includes(searchFilter.toLowerCase()))
    )
    .sort((a, b) => {
      // Prioritize same customer/work order
      const aIsRecommended = parentCustomerName && a.work_order.customer_name === parentCustomerName;
      const bIsRecommended = parentCustomerName && b.work_order.customer_name === parentCustomerName;
      if (aIsRecommended && !bIsRecommended) return -1;
      if (!aIsRecommended && bIsRecommended) return 1;
      return 0;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {language === 'nl' ? `Koppel ${componentLabel}` : `Link ${componentLabel}`}
          </DialogTitle>
          <DialogDescription>
            {language === 'nl' 
              ? `Scan of selecteer een ${componentLabel} om te koppelen aan ${parentSerialNumber}`
              : `Scan or select a ${componentLabel} to link to ${parentSerialNumber}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4 py-2">
          {existingLink ? (
            <div className="p-4 border rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium">
                  {language === 'nl' ? 'Al gekoppeld' : 'Already linked'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{expectedComponentType}</Badge>
                <span className="font-semibold">{existingLink.child_item.serial_number}</span>
                <Badge variant="success" className="text-xs">
                  {existingLink.child_item.status}
                </Badge>
              </div>
            </div>
          ) : (
            <>
              {/* Manual Input Section */}
              <div className="space-y-2">
                <Label htmlFor="serialInput" className="flex items-center gap-2">
                  <ScanBarcode className="h-4 w-4" />
                  {language === 'nl' ? 'Scan of type serienummer' : 'Scan or type serial number'}
                </Label>
                <Input
                  id="serialInput"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                  placeholder={`${COMPONENT_PREFIXES[expectedComponentType]}XXXX`}
                  className="font-semibold text-lg h-12"
                  autoFocus
                  autoComplete="off"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && validationResult?.valid) {
                      handleLink();
                    }
                  }}
                />
              </div>

              {validating && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{language === 'nl' ? 'Valideren...' : 'Validating...'}</span>
                </div>
              )}

              {validationResult && !validating && (
                <div className={`p-3 rounded-lg border ${
                  validationResult.valid 
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' 
                    : 'bg-destructive/10 border-destructive/30'
                }`}>
                  <div className="flex items-center gap-2">
                    {validationResult.valid ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className={`text-sm font-medium ${
                      validationResult.valid ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'
                    }`}>
                      {validationResult.message}
                    </span>
                  </div>
                </div>
              )}

              {/* Available Components Section */}
              <Separator />
              
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <Label className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {language === 'nl' ? 'Beschikbare componenten' : 'Available components'}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {filteredComponents.length} {language === 'nl' ? 'beschikbaar' : 'available'}
                  </span>
                </div>

                {/* Search filter */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder={language === 'nl' ? 'Zoeken...' : 'Search...'}
                    className="pl-9 h-9"
                  />
                </div>

                {loadingAvailable ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    {language === 'nl' ? 'Laden...' : 'Loading...'}
                  </div>
                ) : filteredComponents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {language === 'nl' 
                        ? 'Geen beschikbare componenten gevonden' 
                        : 'No available components found'}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="flex-1 -mx-1 px-1" style={{ maxHeight: '200px' }}>
                    <div className="space-y-2">
                      {filteredComponents.map((component) => {
                        const isRecommended = parentCustomerName && 
                          component.work_order.customer_name === parentCustomerName;
                        const isSelected = serialNumber === component.serial_number;

                        return (
                          <button
                            key={component.id}
                            onClick={() => selectComponent(component)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              isSelected 
                                ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                                : 'border-border hover:border-primary/50 hover:bg-accent/50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {isRecommended && (
                                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                  )}
                                  <span className="font-semibold text-sm truncate">
                                    {component.serial_number}
                                  </span>
                                  {isRecommended && (
                                    <Badge variant="warning" className="text-xs py-0">
                                      {language === 'nl' ? 'Aanbevolen' : 'Recommended'}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{component.work_order.wo_number}</span>
                                  {component.work_order.customer_name && (
                                    <>
                                      <span>•</span>
                                      <span className="truncate">{component.work_order.customer_name}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground whitespace-nowrap">
                                {component.completed_at && formatDistanceToNow(
                                  new Date(component.completed_at),
                                  { 
                                    addSuffix: true, 
                                    locale: language === 'nl' ? nl : enUS 
                                  }
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row pt-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            {existingLink ? (language === 'nl' ? 'Sluiten' : 'Close') : t('cancel')}
          </Button>
          {!existingLink && (
            <Button 
              onClick={handleLink} 
              disabled={!validationResult?.valid || loading}
              className="w-full sm:w-auto"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Link2 className="mr-2 h-4 w-4" />
              {language === 'nl' ? 'Koppelen' : 'Link Component'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SubAssemblyLinkDialog;
