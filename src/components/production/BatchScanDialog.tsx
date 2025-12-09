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
import { ScanBarcode, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

interface BatchScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderItem: any;
  productionStep: any;
  onComplete: () => void;
}

const BatchScanDialog: React.FC<BatchScanDialogProps> = ({
  open,
  onOpenChange,
  workOrderItem,
  productionStep,
  onComplete,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [materialType, setMaterialType] = useState<string>('');
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [openingDate, setOpeningDate] = useState<string>('');
  const [scannedBatches, setScannedBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const materialTypes = [
    { value: 'epoxy', label: 'Epoxy', requiresDate: true },
    { value: 'piezo', label: 'Piezo', requiresDate: false },
    { value: 'pcb', label: 'Electronics PCB', requiresDate: false },
    { value: 'display', label: 'Display', requiresDate: false },
    { value: 'carrier_board', label: 'Carrier Board', requiresDate: false },
    { value: 'som', label: 'SOM', requiresDate: false },
    { value: 'io_board', label: 'I/O Board', requiresDate: false },
    { value: 'switch_board', label: 'Switch Board', requiresDate: false },
    { value: 'poe_board', label: 'POE Board', requiresDate: false },
    { value: 'sd_card', label: 'SD Card', requiresDate: false },
  ];

  useEffect(() => {
    if (open) {
      fetchScannedBatches();
    }
  }, [open]);

  const fetchScannedBatches = async () => {
    try {
      const { data, error } = await supabase
        .from('batch_materials')
        .select('*')
        .eq('work_order_item_id', workOrderItem.id)
        .eq('production_step_id', productionStep.id)
        .order('scanned_at', { ascending: false });

      if (error) throw error;
      setScannedBatches(data || []);
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScanBatch = async () => {
    if (!materialType || !batchNumber) {
      toast.error('Error', { description: 'Please select material type and enter batch number' });
      return;
    }

    const selectedMaterial = materialTypes.find(m => m.value === materialType);
    if (selectedMaterial?.requiresDate && !openingDate) {
      toast.error('Error', { description: 'Opening date is required for this material' });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('batch_materials')
        .insert({
          work_order_item_id: workOrderItem.id,
          production_step_id: productionStep.id,
          material_type: materialType,
          batch_number: batchNumber,
          opening_date: openingDate || null,
          scanned_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'scan_batch',
        entity_type: 'batch_material',
        entity_id: data.id,
        details: { material_type: materialType, batch_number: batchNumber, serial_number: workOrderItem.serial_number },
      });

      // Trigger webhook for batch scan
      const { triggerWebhook } = await import('@/lib/webhooks');
      await triggerWebhook('material_batch_scanned', {
        serial_number: workOrderItem.serial_number,
        material_type: materialType,
        batch_number: batchNumber,
        opening_date: openingDate,
      });

      setScannedBatches(prev => [data, ...prev]);
      setBatchNumber('');
      setOpeningDate('');
      toast.success('Success', { description: 'Batch scanned successfully' });
    } catch (error: any) {
      console.error('Error scanning batch:', error);
      toast.error('Error', { description: error.message });
    }
  };

  const handleRemoveBatch = async (batchId: string) => {
    try {
      const { error } = await supabase
        .from('batch_materials')
        .delete()
        .eq('id', batchId);

      if (error) throw error;

      setScannedBatches(prev => prev.filter(b => b.id !== batchId));
      toast.success('Success', { description: 'Batch removed' });
    } catch (error: any) {
      console.error('Error removing batch:', error);
      toast.error('Error', { description: error.message });
    }
  };

  const selectedMaterial = materialTypes.find(m => m.value === materialType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-ui">Scan Material Batches</DialogTitle>
          <DialogDescription className="text-base">
            Scan or enter batch numbers for materials used in this production step
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-4 p-5 border-2 rounded-lg bg-accent/20">
            <div className="space-y-3">
              <Label htmlFor="materialType" className="text-base font-data uppercase tracking-wider">Material Type *</Label>
              <Select value={materialType} onValueChange={setMaterialType}>
                <SelectTrigger className="h-12 text-base border-2">
                  <SelectValue placeholder="Select material type" />
                </SelectTrigger>
                <SelectContent>
                  {materialTypes.map(type => (
                    <SelectItem key={type.value} value={type.value} className="h-12 text-base">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="batchNumber" className="text-base font-data uppercase tracking-wider">Batch Number *</Label>
              <p className="text-sm text-muted-foreground mb-2">
                📷 {t('hidScannerSupport')} • ⌨️ {t('manualEntrySupport')}
              </p>
              <div className="flex gap-2">
                <Input
                  id="batchNumber"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder={t('scanOrEnterBatch')}
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleScanBatch();
                    }
                  }}
                />
                <Button type="button" onClick={handleScanBatch} size="icon" className="h-12 w-12">
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('batchInputHelp')}
              </p>
            </div>

            {selectedMaterial?.requiresDate && (
              <div className="space-y-3">
                <Label htmlFor="openingDate" className="text-base font-data uppercase tracking-wider">Opening Date *</Label>
                <Input
                  id="openingDate"
                  type="date"
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-base font-data uppercase tracking-wider">Scanned Batches ({scannedBatches.length})</Label>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground text-base">Loading...</div>
            ) : scannedBatches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 rounded-lg bg-muted/20">
                <ScanBarcode className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-base">No batches scanned yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {scannedBatches.map((batch) => {
                  const materialLabel = materialTypes.find(m => m.value === batch.material_type)?.label || batch.material_type;
                  return (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between p-4 border-2 rounded-lg hover:bg-accent/50 transition-all"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="h-8 px-3">{materialLabel}</Badge>
                          <span className="font-data font-medium text-base">{batch.batch_number}</span>
                        </div>
                        {batch.opening_date && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Opened: {formatDate(batch.opening_date)}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10"
                        onClick={() => handleRemoveBatch(batch.id)}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="default" size="lg" className="w-full">
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BatchScanDialog;
