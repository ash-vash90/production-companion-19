import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileText, Eye, Download, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { 
  MockCertificateData, 
  generateMockCertificateData, 
  previewCertificate, 
  downloadCertificatePDF 
} from '@/services/mockCertificateService';
import { toast } from 'sonner';

interface CertificatePreviewDialogProps {
  trigger?: React.ReactNode;
}

const CertificatePreviewDialog: React.FC<CertificatePreviewDialogProps> = ({ trigger }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState<MockCertificateData>(generateMockCertificateData());

  const handleRandomize = () => {
    setData(generateMockCertificateData());
    toast.success('Generated new mock data');
  };

  const handlePreview = () => {
    previewCertificate(data);
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await downloadCertificatePDF(data);
      toast.success('Certificate downloaded');
    } catch (error: any) {
      toast.error('Failed to generate PDF', { description: error.message });
    } finally {
      setGenerating(false);
    }
  };

  const addMeasurement = () => {
    setData(prev => ({
      ...prev,
      measurements: [
        ...prev.measurements,
        {
          stepNumber: prev.measurements.length + 1,
          stepTitle: 'New Test Step',
          values: { 'Value': '0' },
          status: 'passed' as const,
          operator: 'MB',
          completedAt: new Date().toISOString(),
        }
      ]
    }));
  };

  const removeMeasurement = (index: number) => {
    setData(prev => ({
      ...prev,
      measurements: prev.measurements.filter((_, i) => i !== index)
    }));
  };

  const addMaterial = () => {
    setData(prev => ({
      ...prev,
      batchMaterials: [
        ...prev.batchMaterials,
        { materialType: 'New Material', batchNumber: `BATCH-${Date.now().toString().slice(-6)}` }
      ]
    }));
  };

  const removeMaterial = (index: number) => {
    setData(prev => ({
      ...prev,
      batchMaterials: prev.batchMaterials.filter((_, i) => i !== index)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <FileText className="mr-2 h-4 w-4" />
            Preview Certificate
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Certificate Preview & Testing
          </DialogTitle>
          <DialogDescription>
            Generate and preview quality certificates with mock or custom data
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Product Information</Label>
                <Button variant="ghost" size="sm" onClick={handleRandomize}>
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Randomize
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Serial Number</Label>
                  <Input
                    value={data.serialNumber}
                    onChange={(e) => setData(prev => ({ ...prev, serialNumber: e.target.value }))}
                    className="font-semibold text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Work Order</Label>
                  <Input
                    value={data.workOrderNumber}
                    onChange={(e) => setData(prev => ({ ...prev, workOrderNumber: e.target.value }))}
                    className="font-semibold text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Product Type</Label>
                  <Select
                    value={data.productType}
                    onValueChange={(value) => setData(prev => ({ ...prev, productType: value }))}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SDM_ECO">SDM ECO</SelectItem>
                      <SelectItem value="SENSOR">Sensor</SelectItem>
                      <SelectItem value="MLA">MLA</SelectItem>
                      <SelectItem value="HMI">HMI</SelectItem>
                      <SelectItem value="TRANSMITTER">Transmitter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <Input
                    value={data.customerName || ''}
                    onChange={(e) => setData(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder="Optional"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Measurements */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Test Measurements ({data.measurements.length})</Label>
                <Button variant="outline" size="sm" onClick={addMeasurement}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add
                </Button>
              </div>
              
              {data.measurements.map((m, index) => (
                <div key={index} className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">Step {m.stepNumber}</span>
                      <Input
                        value={m.stepTitle}
                        onChange={(e) => {
                          const newMeasurements = [...data.measurements];
                          newMeasurements[index].stepTitle = e.target.value;
                          setData(prev => ({ ...prev, measurements: newMeasurements }));
                        }}
                        className="h-7 text-sm w-40"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={m.status}
                        onValueChange={(value) => {
                          const newMeasurements = [...data.measurements];
                          newMeasurements[index].status = value as 'passed' | 'failed' | 'pending';
                          setData(prev => ({ ...prev, measurements: newMeasurements }));
                        }}
                      >
                        <SelectTrigger className="h-7 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="passed">Passed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMeasurement(index)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">
                    {Object.entries(m.values).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Batch Materials */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Batch Materials ({data.batchMaterials.length})</Label>
                <Button variant="outline" size="sm" onClick={addMaterial}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add
                </Button>
              </div>
              
              {data.batchMaterials.map((m, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={m.materialType}
                    onChange={(e) => {
                      const newMaterials = [...data.batchMaterials];
                      newMaterials[index].materialType = e.target.value;
                      setData(prev => ({ ...prev, batchMaterials: newMaterials }));
                    }}
                    placeholder="Material type"
                    className="flex-1 h-8 text-sm"
                  />
                  <Input
                    value={m.batchNumber}
                    onChange={(e) => {
                      const newMaterials = [...data.batchMaterials];
                      newMaterials[index].batchNumber = e.target.value;
                      setData(prev => ({ ...prev, batchMaterials: newMaterials }));
                    }}
                    placeholder="Batch number"
                    className="flex-1 h-8 text-sm font-semibold"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeMaterial(index)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handlePreview}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button onClick={handleDownload} disabled={generating}>
            {generating ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CertificatePreviewDialog;
