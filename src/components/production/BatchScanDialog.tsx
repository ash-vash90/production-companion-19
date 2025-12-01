import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ScanBarcode, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Scan Material Batches</DialogTitle>
          <DialogDescription>
            Scan or enter batch numbers for materials used in this production step
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3 p-4 border rounded-lg bg-accent/20">
            <div className="space-y-2">
              <Label htmlFor="materialType">Material Type *</Label>
              <Select value={materialType} onValueChange={setMaterialType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select material type" />
                </SelectTrigger>
                <SelectContent>
                  {materialTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batchNumber">Batch Number *</Label>
              <div className="flex gap-2">
                <Input
                  id="batchNumber"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="Scan or enter batch number"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleScanBatch();
                    }
                  }}
                />
                <Button type="button" onClick={handleScanBatch} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {selectedMaterial?.requiresDate && (
              <div className="space-y-2">
                <Label htmlFor="openingDate">Opening Date *</Label>
                <Input
                  id="openingDate"
                  type="date"
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Scanned Batches ({scannedBatches.length})</Label>
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : scannedBatches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <ScanBarcode className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No batches scanned yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {scannedBatches.map((batch) => {
                  const materialLabel = materialTypes.find(m => m.value === batch.material_type)?.label || batch.material_type;
                  return (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{materialLabel}</Badge>
                          <span className="font-mono font-medium">{batch.batch_number}</span>
                        </div>
                        {batch.opening_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Opened: {new Date(batch.opening_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveBatch(batch.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BatchScanDialog;
