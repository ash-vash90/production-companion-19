import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link2, CheckCircle2, AlertCircle, Loader2, ScanBarcode } from 'lucide-react';

interface SubAssemblyLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentItemId: string;
  parentSerialNumber: string;
  expectedComponentType: 'SENSOR' | 'MLA' | 'HMI' | 'TRANSMITTER';
  stepExecutionId: string;
  onComplete: () => void;
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

  // Check for existing link on open
  useEffect(() => {
    if (open) {
      checkExistingLink();
      setSerialNumber('');
      setValidationResult(null);
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

  const componentLabel = {
    SENSOR: language === 'nl' ? 'Sensor' : 'Sensor',
    MLA: 'MLA',
    HMI: 'HMI',
    TRANSMITTER: language === 'nl' ? 'Transmitter' : 'Transmitter',
  }[expectedComponentType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {language === 'nl' ? `Koppel ${componentLabel}` : `Link ${componentLabel}`}
          </DialogTitle>
          <DialogDescription>
            {language === 'nl' 
              ? `Scan of voer het serienummer in van de ${componentLabel} om te koppelen aan ${parentSerialNumber}`
              : `Scan or enter the serial number of the ${componentLabel} to link to ${parentSerialNumber}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {existingLink ? (
            <div className="p-4 border rounded-lg bg-success/10 border-success/30">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="font-medium">
                  {language === 'nl' ? 'Al gekoppeld' : 'Already linked'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{expectedComponentType}</Badge>
                <span className="font-mono font-medium">{existingLink.child_item.serial_number}</span>
                <Badge className="bg-success text-success-foreground text-xs">
                  {existingLink.child_item.status}
                </Badge>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="serialInput" className="flex items-center gap-2">
                  <ScanBarcode className="h-4 w-4" />
                  {language === 'nl' ? 'Serienummer' : 'Serial Number'}
                </Label>
                <Input
                  id="serialInput"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                  placeholder={`${COMPONENT_PREFIXES[expectedComponentType]}XXXXXXXX-XXX`}
                  className="font-mono text-lg h-12"
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
                    ? 'bg-success/10 border-success/30' 
                    : 'bg-destructive/10 border-destructive/30'
                }`}>
                  <div className="flex items-center gap-2">
                    {validationResult.valid ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className={`text-sm font-medium ${
                      validationResult.valid ? 'text-success' : 'text-destructive'
                    }`}>
                      {validationResult.message}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
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
