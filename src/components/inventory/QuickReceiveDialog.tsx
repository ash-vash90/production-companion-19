import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLanguage } from '@/contexts/LanguageContext';
import { useReceiveStock } from '@/hooks/useInventory';
import { Material } from '@/services/inventoryService';
import { Package, AlertTriangle, Loader2 } from 'lucide-react';

interface QuickReceiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: Material;
  batchNumber: string;
  onSuccess: () => void;
}

/**
 * Dialog for quickly adding a batch to inventory when it's scanned but not found.
 * Shown during production when operator scans an untracked batch.
 */
export function QuickReceiveDialog({
  open,
  onOpenChange,
  material,
  batchNumber,
  onSuccess,
}: QuickReceiveDialogProps) {
  const { language } = useLanguage();
  const [quantity, setQuantity] = useState('1');
  const [expiryDate, setExpiryDate] = useState('');

  const receiveStock = useReceiveStock();

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return;
    }

    try {
      await receiveStock.mutateAsync({
        materialId: material.id,
        batchNumber,
        quantity: qty,
        expiryDate: expiryDate || undefined,
        notes: language === 'nl'
          ? 'Snel toegevoegd tijdens productie'
          : 'Quick added during production',
      });
      onSuccess();
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {language === 'nl' ? 'Batch Toevoegen aan Voorraad' : 'Add Batch to Inventory'}
          </DialogTitle>
          <DialogDescription>
            {language === 'nl'
              ? 'Deze batch is niet gevonden in de voorraad. Voeg het toe om door te gaan.'
              : 'This batch was not found in inventory. Add it to continue.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{language === 'nl' ? 'Batch' : 'Batch'}:</strong> {batchNumber}
              <br />
              <strong>{language === 'nl' ? 'Materiaal' : 'Material'}:</strong>{' '}
              {language === 'nl' && material.name_nl ? material.name_nl : material.name}
            </AlertDescription>
          </Alert>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">
                {language === 'nl' ? 'Hoeveelheid' : 'Quantity'} ({material.unit_of_measure})
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
              />
            </div>

            {material.track_expiry && (
              <div className="space-y-2">
                <Label htmlFor="expiry">
                  {language === 'nl' ? 'Vervaldatum' : 'Expiry Date'}
                </Label>
                <Input
                  id="expiry"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {language === 'nl' ? 'Annuleren' : 'Cancel'}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={receiveStock.isPending || !quantity || parseFloat(quantity) <= 0}
          >
            {receiveStock.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {language === 'nl' ? 'Toevoegen...' : 'Adding...'}
              </>
            ) : (
              <>{language === 'nl' ? 'Toevoegen & Doorgaan' : 'Add & Continue'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
