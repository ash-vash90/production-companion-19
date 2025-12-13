import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Upload, 
  FileText, 
  Trash2, 
  Eye, 
  Settings2, 
  Star, 
  StarOff,
  Download,
  Loader2
} from 'lucide-react';
import {
  CertificateTemplate,
  DATA_SOURCES,
  uploadTemplate,
  updateFieldMappings,
  setDefaultTemplate,
  deleteTemplate,
  getAllTemplates,
  previewTemplate,
  detectPdfFields,
  TemplateField
} from '@/services/pdfTemplateService';

const PRODUCT_TYPES = [
  { value: '', label: 'All Products (Default)' },
  { value: 'SDM_ECO', label: 'SDM ECO' },
  { value: 'SENSOR', label: 'Sensor' },
  { value: 'MLA', label: 'MLA' },
  { value: 'HMI', label: 'HMI' },
  { value: 'TRANSMITTER', label: 'Transmitter' },
];

export function CertificateTemplateManager() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CertificateTemplate | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadProductType, setUploadProductType] = useState('');
  const [detectedFields, setDetectedFields] = useState<TemplateField[]>([]);

  // Mapping state
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await getAllTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load certificate templates',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid file',
        description: 'Please select a PDF file',
        variant: 'destructive'
      });
      return;
    }

    setUploadFile(file);
    setUploadName(file.name.replace('.pdf', ''));

    // Detect fields
    try {
      const arrayBuffer = await file.arrayBuffer();
      const fields = await detectPdfFields(arrayBuffer);
      setDetectedFields(fields);
      
      if (fields.length === 0) {
        toast({
          title: 'No form fields detected',
          description: 'This PDF has no fillable form fields. Create a PDF with form fields in Adobe Acrobat or similar.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Fields detected',
          description: `Found ${fields.length} fillable field(s) in the PDF`,
        });
      }
    } catch (error) {
      console.error('Failed to detect fields:', error);
      toast({
        title: 'Error',
        description: 'Failed to analyze PDF. Make sure it\'s a valid PDF file.',
        variant: 'destructive'
      });
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadName) return;

    setUploading(true);
    try {
      await uploadTemplate(
        uploadFile,
        uploadName,
        uploadDescription,
        uploadProductType || null
      );
      
      toast({
        title: 'Template uploaded',
        description: 'Now configure the field mappings',
      });
      
      setUploadDialogOpen(false);
      resetUploadForm();
      loadTemplates();
    } catch (error: any) {
      console.error('Upload failed:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload template',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadName('');
    setUploadDescription('');
    setUploadProductType('');
    setDetectedFields([]);
  };

  const openMappingDialog = (template: CertificateTemplate) => {
    setSelectedTemplate(template);
    setFieldMappings(template.field_mappings as Record<string, string> || {});
    setMappingDialogOpen(true);
  };

  const handleSaveMappings = async () => {
    if (!selectedTemplate) return;

    try {
      await updateFieldMappings(selectedTemplate.id, fieldMappings);
      toast({
        title: 'Mappings saved',
        description: 'Field mappings have been updated',
      });
      setMappingDialogOpen(false);
      loadTemplates();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save mappings',
        variant: 'destructive'
      });
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      await setDefaultTemplate(templateId);
      toast({
        title: 'Default set',
        description: 'This template is now the default',
      });
      loadTemplates();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to set default template',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await deleteTemplate(templateId);
      toast({
        title: 'Template deleted',
        description: 'The template has been removed',
      });
      loadTemplates();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        variant: 'destructive'
      });
    }
  };

  const handlePreview = async (templateId: string) => {
    setPreviewing(templateId);
    try {
      const pdfBytes = await previewTemplate(templateId);
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error: any) {
      toast({
        title: 'Preview failed',
        description: error.message || 'Failed to generate preview',
        variant: 'destructive'
      });
    } finally {
      setPreviewing(null);
    }
  };

  const groupedDataSources = DATA_SOURCES.reduce((acc, source) => {
    if (!acc[source.category]) {
      acc[source.category] = [];
    }
    acc[source.category].push(source);
    return acc;
  }, {} as Record<string, typeof DATA_SOURCES>);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 shrink-0" />
              Certificate Templates
            </CardTitle>
            <CardDescription className="text-sm">
              Upload PDF templates with form fields to generate professional certificates
            </CardDescription>
          </div>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full sm:w-auto">
                <Upload className="h-4 w-4 mr-2" />
                Upload Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Upload PDF Template</DialogTitle>
                <DialogDescription>
                  Upload a PDF with fillable form fields. Create form fields in Adobe Acrobat or similar.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="pdf-file">PDF File</Label>
                  <Input
                    id="pdf-file"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="mt-1"
                  />
                </div>
                
                {detectedFields.length > 0 && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Detected Fields ({detectedFields.length}):</p>
                    <div className="flex flex-wrap gap-1">
                      {detectedFields.map((field) => (
                        <Badge key={field.name} variant="secondary" className="text-xs">
                          {field.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    placeholder="e.g., Sensor Quality Certificate"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="template-description">Description (optional)</Label>
                  <Textarea
                    id="template-description"
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="Brief description of this template..."
                    className="mt-1"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="product-type">Product Type</Label>
                  <Select value={uploadProductType} onValueChange={setUploadProductType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select product type (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map((pt) => (
                        <SelectItem key={pt.value} value={pt.value || 'all'}>
                          {pt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to use as default template for all products
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleUpload} 
                    disabled={!uploadFile || !uploadName || uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      'Upload'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No templates uploaded yet</p>
            <p className="text-sm">Upload a PDF template to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Product Type</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>Mapped</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => {
                const mappedCount = Object.keys(template.field_mappings || {}).length;
                const totalFields = template.detected_fields?.length || 0;
                
                return (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{template.name}</span>
                        {template.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-xs text-muted-foreground">{template.description}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {template.product_type ? (
                        <Badge variant="outline">{template.product_type.replace('_', ' ')}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">All</span>
                      )}
                    </TableCell>
                    <TableCell>{totalFields}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={mappedCount === totalFields && totalFields > 0 ? 'default' : 'secondary'}
                      >
                        {mappedCount}/{totalFields}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openMappingDialog(template)}
                          title="Configure field mappings"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePreview(template.id)}
                          disabled={previewing === template.id}
                          title="Preview with sample data"
                        >
                          {previewing === template.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        {!template.is_default && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSetDefault(template.id)}
                            title="Set as default"
                          >
                            <StarOff className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(template.id)}
                          className="text-destructive hover:text-destructive"
                          title="Delete template"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Field Mapping Dialog */}
        <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
          <DialogContent className="max-w-2xl w-[calc(100%-2rem)] max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Configure Field Mappings</DialogTitle>
              <DialogDescription>
                Map PDF form fields to data sources from the system
              </DialogDescription>
            </DialogHeader>
            {selectedTemplate && (
              <ScrollArea className="max-h-[50vh]">
                <div className="space-y-3 pr-4">
                  {selectedTemplate.detected_fields?.map((fieldName) => (
                    <div key={fieldName} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                      <div className="sm:flex-1">
                        <Label className="text-sm font-mono bg-muted px-2 py-1 rounded">{fieldName}</Label>
                      </div>
                      <div className="sm:flex-1">
                        <Select
                          value={fieldMappings[fieldName] || ''}
                          onValueChange={(value) => {
                            setFieldMappings(prev => ({
                              ...prev,
                              [fieldName]: value
                            }));
                          }}
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Select data source" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">-- Not mapped --</SelectItem>
                            {Object.entries(groupedDataSources).map(([category, sources]) => (
                              <div key={category}>
                                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted">
                                  {category}
                                </div>
                                {sources.map((source) => (
                                  <SelectItem key={source.id} value={source.id}>
                                    {source.label}
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            <div className="flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setMappingDialogOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={handleSaveMappings} className="w-full sm:w-auto">
                Save Mappings
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
