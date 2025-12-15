import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { uploadInstructionImage } from '@/services/instructionMediaService';
import { translateText } from '@/services/translationService';
import {
  Plus,
  Trash2,
  BookOpen,
  Loader2,
  GripVertical,
  AlertTriangle,
  Lightbulb,
  Clock,
  Wrench,
  ChevronDown,
  ChevronUp,
  Edit2,
  Eye,
  Copy,
  Languages,
  Sparkles
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type ProductType = Database['public']['Enums']['product_type'];
type WorkInstruction = Database['public']['Tables']['work_instructions']['Row'];
type InstructionStep = Database['public']['Tables']['instruction_steps']['Row'];

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: 'SDM_ECO', label: 'SDM ECO' },
  { value: 'SENSOR', label: 'Sensor' },
  { value: 'MLA', label: 'MLA' },
  { value: 'HMI', label: 'HMI' },
  { value: 'TRANSMITTER', label: 'Transmitter' },
];

interface InstructionWithSteps extends WorkInstruction {
  instruction_steps: InstructionStep[];
  production_steps?: { step_number: number; title_en: string } | null;
}

export function WorkInstructionsManager() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [instructions, setInstructions] = useState<InstructionWithSteps[]>([]);
  const [productionSteps, setProductionSteps] = useState<Record<string, { id: string; step_number: number; title_en: string; title_nl: string }[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedProductType, setSelectedProductType] = useState<ProductType>('SENSOR');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [selectedInstruction, setSelectedInstruction] = useState<InstructionWithSteps | null>(null);
  const [selectedStep, setSelectedStep] = useState<InstructionStep | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    title_en: '',
    title_nl: '',
    description_en: '',
    description_nl: '',
    production_step_id: '',
    is_active: true,
  });

  const [stepFormData, setStepFormData] = useState({
    step_number: 1,
    title_en: '',
    title_nl: '',
    content_en: '',
    content_nl: '',
    warning_text_en: '',
    warning_text_nl: '',
    tip_text_en: '',
    tip_text_nl: '',
    estimated_duration_minutes: '',
    required_tools: '',
  });

  // Translation state
  const [translating, setTranslating] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<'en' | 'nl'>('en');

  // Auto-translate content from one language to another
  const handleAutoTranslate = useCallback(async () => {
    const sourceLang = editingLanguage;
    const targetLang = editingLanguage === 'en' ? 'nl' : 'en';

    // Collect all content to translate
    const contentToTranslate = {
      title: sourceLang === 'en' ? stepFormData.title_en : stepFormData.title_nl,
      content: sourceLang === 'en' ? stepFormData.content_en : stepFormData.content_nl,
      warning: sourceLang === 'en' ? stepFormData.warning_text_en : stepFormData.warning_text_nl,
      tip: sourceLang === 'en' ? stepFormData.tip_text_en : stepFormData.tip_text_nl,
    };

    if (!contentToTranslate.title && !contentToTranslate.content) {
      toast.error('Nothing to translate', { description: 'Please enter some content first' });
      return;
    }

    setTranslating(true);
    try {
      const translations = await Promise.all([
        contentToTranslate.title ? translateText(contentToTranslate.title, { from: sourceLang, to: targetLang }) : { text: '' },
        contentToTranslate.content ? translateText(contentToTranslate.content, { from: sourceLang, to: targetLang, preserveHtml: true }) : { text: '' },
        contentToTranslate.warning ? translateText(contentToTranslate.warning, { from: sourceLang, to: targetLang, preserveHtml: true }) : { text: '' },
        contentToTranslate.tip ? translateText(contentToTranslate.tip, { from: sourceLang, to: targetLang, preserveHtml: true }) : { text: '' },
      ]);

      if (targetLang === 'nl') {
        setStepFormData(prev => ({
          ...prev,
          title_nl: translations[0].text || prev.title_nl,
          content_nl: translations[1].text || prev.content_nl,
          warning_text_nl: translations[2].text || prev.warning_text_nl,
          tip_text_nl: translations[3].text || prev.tip_text_nl,
        }));
      } else {
        setStepFormData(prev => ({
          ...prev,
          title_en: translations[0].text || prev.title_en,
          content_en: translations[1].text || prev.content_en,
          warning_text_en: translations[2].text || prev.warning_text_en,
          tip_text_en: translations[3].text || prev.tip_text_en,
        }));
      }

      toast.success('Translation complete', {
        description: `Content translated to ${targetLang === 'nl' ? 'Dutch' : 'English'}`,
      });
    } catch (error: any) {
      console.error('Translation error:', error);
      toast.error('Translation failed', {
        description: error.message || 'Could not translate content. Please try again.',
      });
    } finally {
      setTranslating(false);
    }
  }, [editingLanguage, stepFormData]);

  // Handle image upload for rich text editor
  const handleImageUpload = useCallback(async (file: File) => {
    return await uploadInstructionImage(file, selectedInstruction?.id);
  }, [selectedInstruction]);

  useEffect(() => {
    loadInstructions();
    loadProductionSteps();
  }, [selectedProductType]);

  const loadInstructions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('work_instructions')
        .select(`
          *,
          instruction_steps (*),
          production_steps (step_number, title_en)
        `)
        .eq('product_type', selectedProductType)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setInstructions((data as unknown as InstructionWithSteps[]) || []);
    } catch (error) {
      console.error('Failed to load instructions:', error);
      toast.error(t('error'), { description: 'Failed to load work instructions' });
    } finally {
      setLoading(false);
    }
  };

  const loadProductionSteps = async () => {
    try {
      const { data, error } = await supabase
        .from('production_steps')
        .select('id, step_number, title_en, title_nl, product_type')
        .order('step_number', { ascending: true });

      if (error) throw error;

      // Group by product type
      const grouped: Record<string, typeof data> = {};
      data?.forEach(step => {
        if (!grouped[step.product_type]) {
          grouped[step.product_type] = [];
        }
        grouped[step.product_type].push(step);
      });
      setProductionSteps(grouped);
    } catch (error) {
      console.error('Failed to load production steps:', error);
    }
  };

  const handleCreateInstruction = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('work_instructions')
        .insert({
          product_type: selectedProductType,
          title_en: formData.title_en,
          title_nl: formData.title_nl || null,
          description_en: formData.description_en || null,
          description_nl: formData.description_nl || null,
          production_step_id: formData.production_step_id || null,
          is_active: formData.is_active,
          sort_order: instructions.length,
          created_by: user.id,
          updated_by: user.id,
        });

      if (error) throw error;

      toast.success(t('success'), { description: 'Work instruction created' });
      setCreateDialogOpen(false);
      resetForm();
      loadInstructions();
    } catch (error: any) {
      console.error('Failed to create instruction:', error);
      toast.error(t('error'), { description: error.message });
    }
  };

  const handleUpdateInstruction = async () => {
    if (!user || !selectedInstruction) return;

    try {
      const { error } = await supabase
        .from('work_instructions')
        .update({
          title_en: formData.title_en,
          title_nl: formData.title_nl || null,
          description_en: formData.description_en || null,
          description_nl: formData.description_nl || null,
          production_step_id: formData.production_step_id || null,
          is_active: formData.is_active,
          updated_by: user.id,
        })
        .eq('id', selectedInstruction.id);

      if (error) throw error;

      toast.success(t('success'), { description: 'Work instruction updated' });
      setEditDialogOpen(false);
      setSelectedInstruction(null);
      resetForm();
      loadInstructions();
    } catch (error: any) {
      console.error('Failed to update instruction:', error);
      toast.error(t('error'), { description: error.message });
    }
  };

  const handleDeleteInstruction = async (id: string) => {
    if (!confirm('Are you sure you want to delete this work instruction and all its steps?')) return;

    try {
      const { error } = await supabase
        .from('work_instructions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(t('success'), { description: 'Work instruction deleted' });
      loadInstructions();
    } catch (error: any) {
      console.error('Failed to delete instruction:', error);
      toast.error(t('error'), { description: error.message });
    }
  };

  const handleToggleActive = async (instruction: InstructionWithSteps) => {
    try {
      const { error } = await supabase
        .from('work_instructions')
        .update({ is_active: !instruction.is_active })
        .eq('id', instruction.id);

      if (error) throw error;

      setInstructions(prev => prev.map(i =>
        i.id === instruction.id ? { ...i, is_active: !i.is_active } : i
      ));
    } catch (error: any) {
      console.error('Failed to toggle instruction:', error);
      toast.error(t('error'), { description: error.message });
    }
  };

  const handleCreateStep = async () => {
    if (!selectedInstruction) return;

    try {
      const toolsArray = stepFormData.required_tools
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const { error } = await supabase
        .from('instruction_steps')
        .insert({
          work_instruction_id: selectedInstruction.id,
          step_number: stepFormData.step_number,
          title_en: stepFormData.title_en,
          title_nl: stepFormData.title_nl || null,
          content_en: stepFormData.content_en || null,
          content_nl: stepFormData.content_nl || null,
          warning_text_en: stepFormData.warning_text_en || null,
          warning_text_nl: stepFormData.warning_text_nl || null,
          tip_text_en: stepFormData.tip_text_en || null,
          tip_text_nl: stepFormData.tip_text_nl || null,
          estimated_duration_minutes: stepFormData.estimated_duration_minutes
            ? parseInt(stepFormData.estimated_duration_minutes)
            : null,
          required_tools: toolsArray.length > 0 ? toolsArray : null,
          sort_order: selectedInstruction.instruction_steps.length,
        });

      if (error) throw error;

      toast.success(t('success'), { description: 'Instruction step added' });
      setStepDialogOpen(false);
      setSelectedStep(null);
      resetStepForm();
      loadInstructions();
    } catch (error: any) {
      console.error('Failed to create step:', error);
      toast.error(t('error'), { description: error.message });
    }
  };

  const handleUpdateStep = async () => {
    if (!selectedStep) return;

    try {
      const toolsArray = stepFormData.required_tools
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const { error } = await supabase
        .from('instruction_steps')
        .update({
          step_number: stepFormData.step_number,
          title_en: stepFormData.title_en,
          title_nl: stepFormData.title_nl || null,
          content_en: stepFormData.content_en || null,
          content_nl: stepFormData.content_nl || null,
          warning_text_en: stepFormData.warning_text_en || null,
          warning_text_nl: stepFormData.warning_text_nl || null,
          tip_text_en: stepFormData.tip_text_en || null,
          tip_text_nl: stepFormData.tip_text_nl || null,
          estimated_duration_minutes: stepFormData.estimated_duration_minutes
            ? parseInt(stepFormData.estimated_duration_minutes)
            : null,
          required_tools: toolsArray.length > 0 ? toolsArray : null,
        })
        .eq('id', selectedStep.id);

      if (error) throw error;

      toast.success(t('success'), { description: 'Instruction step updated' });
      setStepDialogOpen(false);
      setSelectedStep(null);
      resetStepForm();
      loadInstructions();
    } catch (error: any) {
      console.error('Failed to update step:', error);
      toast.error(t('error'), { description: error.message });
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('Are you sure you want to delete this step?')) return;

    try {
      const { error } = await supabase
        .from('instruction_steps')
        .delete()
        .eq('id', stepId);

      if (error) throw error;

      toast.success(t('success'), { description: 'Instruction step deleted' });
      loadInstructions();
    } catch (error: any) {
      console.error('Failed to delete step:', error);
      toast.error(t('error'), { description: error.message });
    }
  };

  const resetForm = () => {
    setFormData({
      title_en: '',
      title_nl: '',
      description_en: '',
      description_nl: '',
      production_step_id: '',
      is_active: true,
    });
  };

  const resetStepForm = () => {
    setStepFormData({
      step_number: 1,
      title_en: '',
      title_nl: '',
      content_en: '',
      content_nl: '',
      warning_text_en: '',
      warning_text_nl: '',
      tip_text_en: '',
      tip_text_nl: '',
      estimated_duration_minutes: '',
      required_tools: '',
    });
  };

  const openEditDialog = (instruction: InstructionWithSteps) => {
    setSelectedInstruction(instruction);
    setFormData({
      title_en: instruction.title_en,
      title_nl: instruction.title_nl || '',
      description_en: instruction.description_en || '',
      description_nl: instruction.description_nl || '',
      production_step_id: instruction.production_step_id || '',
      is_active: instruction.is_active,
    });
    setEditDialogOpen(true);
  };

  const openStepDialog = (instruction: InstructionWithSteps, step?: InstructionStep) => {
    setSelectedInstruction(instruction);
    if (step) {
      setSelectedStep(step);
      setStepFormData({
        step_number: step.step_number,
        title_en: step.title_en,
        title_nl: step.title_nl || '',
        content_en: step.content_en || '',
        content_nl: step.content_nl || '',
        warning_text_en: step.warning_text_en || '',
        warning_text_nl: step.warning_text_nl || '',
        tip_text_en: step.tip_text_en || '',
        tip_text_nl: step.tip_text_nl || '',
        estimated_duration_minutes: step.estimated_duration_minutes?.toString() || '',
        required_tools: step.required_tools?.join(', ') || '',
      });
    } else {
      setSelectedStep(null);
      resetStepForm();
      setStepFormData(prev => ({
        ...prev,
        step_number: instruction.instruction_steps.length + 1,
      }));
    }
    setStepDialogOpen(true);
  };

  const currentProductionSteps = productionSteps[selectedProductType] || [];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Work Instructions
            </CardTitle>
            <CardDescription className="text-sm">
              Create and manage step-by-step work instructions for operators
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={selectedProductType}
              onValueChange={(value) => setSelectedProductType(value as ProductType)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Instruction
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Work Instruction</DialogTitle>
                  <DialogDescription>
                    Add a new work instruction for {PRODUCT_TYPES.find(t => t.value === selectedProductType)?.label}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Title (English) *</Label>
                    <Input
                      value={formData.title_en}
                      onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                      placeholder="e.g., PCB Assembly Guide"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Title (Dutch)</Label>
                    <Input
                      value={formData.title_nl}
                      onChange={(e) => setFormData({ ...formData, title_nl: e.target.value })}
                      placeholder="e.g., PCB Montage Handleiding"
                    />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Description (English)</Label>
                    <Textarea
                      value={formData.description_en}
                      onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                      placeholder="Brief overview of this instruction..."
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description (Dutch)</Label>
                    <Textarea
                      value={formData.description_nl}
                      onChange={(e) => setFormData({ ...formData, description_nl: e.target.value })}
                      placeholder="Kort overzicht van deze instructie..."
                      rows={2}
                    />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Link to Production Step (Optional)</Label>
                    <Select
                      value={formData.production_step_id || 'none'}
                      onValueChange={(value) => setFormData({ ...formData, production_step_id: value === 'none' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a production step..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No specific step (general instruction)</SelectItem>
                        {currentProductionSteps.map(step => (
                          <SelectItem key={step.id} value={step.id}>
                            Step {step.step_number}: {language === 'nl' ? step.title_nl : step.title_en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Link this instruction to a specific production step to show it automatically
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Active</Label>
                      <p className="text-xs text-muted-foreground">
                        Show this instruction to operators
                      </p>
                    </div>
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button onClick={handleCreateInstruction} disabled={!formData.title_en}>
                    Create Instruction
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : instructions.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No work instructions yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first work instruction for {PRODUCT_TYPES.find(t => t.value === selectedProductType)?.label}
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Instruction
            </Button>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {instructions.map((instruction) => (
              <AccordionItem
                key={instruction.id}
                value={instruction.id}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {language === 'nl' && instruction.title_nl ? instruction.title_nl : instruction.title_en}
                        </span>
                        <Badge variant={instruction.is_active ? 'default' : 'secondary'}>
                          {instruction.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {instruction.production_steps && (
                          <Badge variant="outline">
                            Step {instruction.production_steps.step_number}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {instruction.instruction_steps.length} instruction step{instruction.instruction_steps.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-4">
                    {instruction.description_en && (
                      <p className="text-sm text-muted-foreground">
                        {language === 'nl' && instruction.description_nl ? instruction.description_nl : instruction.description_en}
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(instruction)}
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openStepDialog(instruction)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Step
                      </Button>
                      <Switch
                        checked={instruction.is_active}
                        onCheckedChange={() => handleToggleActive(instruction)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {instruction.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteInstruction(instruction.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {instruction.instruction_steps.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <h4 className="text-sm font-medium">Instruction Steps</h4>
                        <div className="space-y-2">
                          {instruction.instruction_steps
                            .sort((a, b) => a.step_number - b.step_number)
                            .map((step) => (
                              <div
                                key={step.id}
                                className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30"
                              >
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0 mt-0.5">
                                  {step.step_number}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm">
                                    {language === 'nl' && step.title_nl ? step.title_nl : step.title_en}
                                  </div>
                                  {step.content_en && (
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                      {language === 'nl' && step.content_nl ? step.content_nl : step.content_en}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                                    {step.estimated_duration_minutes && (
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {step.estimated_duration_minutes} min
                                      </span>
                                    )}
                                    {step.warning_text_en && (
                                      <span className="text-xs text-amber-600 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        Warning
                                      </span>
                                    )}
                                    {step.tip_text_en && (
                                      <span className="text-xs text-blue-600 flex items-center gap-1">
                                        <Lightbulb className="h-3 w-3" />
                                        Tip
                                      </span>
                                    )}
                                    {step.required_tools && step.required_tools.length > 0 && (
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Wrench className="h-3 w-3" />
                                        {step.required_tools.length} tool{step.required_tools.length !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openStepDialog(instruction, step)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleDeleteStep(step.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>

      {/* Edit Instruction Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Work Instruction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title (English) *</Label>
              <Input
                value={formData.title_en}
                onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Title (Dutch)</Label>
              <Input
                value={formData.title_nl}
                onChange={(e) => setFormData({ ...formData, title_nl: e.target.value })}
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Description (English)</Label>
              <Textarea
                value={formData.description_en}
                onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (Dutch)</Label>
              <Textarea
                value={formData.description_nl}
                onChange={(e) => setFormData({ ...formData, description_nl: e.target.value })}
                rows={2}
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Link to Production Step</Label>
              <Select
                value={formData.production_step_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, production_step_id: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a production step..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific step</SelectItem>
                  {currentProductionSteps.map(step => (
                    <SelectItem key={step.id} value={step.id}>
                      Step {step.step_number}: {language === 'nl' ? step.title_nl : step.title_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleUpdateInstruction} disabled={!formData.title_en}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Step Dialog */}
      <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedStep ? 'Edit Instruction Step' : 'Add Instruction Step'}
            </DialogTitle>
            <DialogDescription>
              {selectedInstruction && (
                <>For: {selectedInstruction.title_en}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Step Number *</Label>
                <Input
                  type="number"
                  min={1}
                  value={stepFormData.step_number}
                  onChange={(e) => setStepFormData({ ...stepFormData, step_number: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Estimated Duration (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g., 5"
                  value={stepFormData.estimated_duration_minutes}
                  onChange={(e) => setStepFormData({ ...stepFormData, estimated_duration_minutes: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Required Tools
              </Label>
              <Input
                value={stepFormData.required_tools}
                onChange={(e) => setStepFormData({ ...stepFormData, required_tools: e.target.value })}
                placeholder="e.g., Soldering iron, Multimeter, ESD strap (comma-separated)"
              />
            </div>

            <Separator />

            {/* Language Tabs with Rich Text */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  Content
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoTranslate}
                  disabled={translating}
                >
                  {translating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Auto-translate to {editingLanguage === 'en' ? 'Dutch' : 'English'}
                </Button>
              </div>

              <Tabs value={editingLanguage} onValueChange={(v) => setEditingLanguage(v as 'en' | 'nl')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="en">
                    🇬🇧 English
                    {stepFormData.title_en && <Badge variant="secondary" className="ml-2 text-xs">has content</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="nl">
                    🇳🇱 Dutch
                    {stepFormData.title_nl && <Badge variant="secondary" className="ml-2 text-xs">has content</Badge>}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="en" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Step Title *</Label>
                    <Input
                      value={stepFormData.title_en}
                      onChange={(e) => setStepFormData({ ...stepFormData, title_en: e.target.value })}
                      placeholder="e.g., Install PCB"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Instructions</Label>
                    <RichTextEditor
                      content={stepFormData.content_en}
                      onChange={(html) => setStepFormData({ ...stepFormData, content_en: html })}
                      placeholder="Enter detailed instructions with formatting, images, and videos..."
                      onImageUpload={handleImageUpload}
                      minHeight="150px"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Warning
                    </Label>
                    <RichTextEditor
                      content={stepFormData.warning_text_en}
                      onChange={(html) => setStepFormData({ ...stepFormData, warning_text_en: html })}
                      placeholder="Safety warnings or critical notes..."
                      onImageUpload={handleImageUpload}
                      minHeight="80px"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-blue-500" />
                      Tip
                    </Label>
                    <RichTextEditor
                      content={stepFormData.tip_text_en}
                      onChange={(html) => setStepFormData({ ...stepFormData, tip_text_en: html })}
                      placeholder="Helpful tips for this step..."
                      onImageUpload={handleImageUpload}
                      minHeight="80px"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="nl" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Stap Titel *</Label>
                    <Input
                      value={stepFormData.title_nl}
                      onChange={(e) => setStepFormData({ ...stepFormData, title_nl: e.target.value })}
                      placeholder="bijv., Installeer PCB"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Instructies</Label>
                    <RichTextEditor
                      content={stepFormData.content_nl}
                      onChange={(html) => setStepFormData({ ...stepFormData, content_nl: html })}
                      placeholder="Voer gedetailleerde instructies in met opmaak, afbeeldingen en video's..."
                      onImageUpload={handleImageUpload}
                      minHeight="150px"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Waarschuwing
                    </Label>
                    <RichTextEditor
                      content={stepFormData.warning_text_nl}
                      onChange={(html) => setStepFormData({ ...stepFormData, warning_text_nl: html })}
                      placeholder="Veiligheidswaarschuwingen of kritieke opmerkingen..."
                      onImageUpload={handleImageUpload}
                      minHeight="80px"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-blue-500" />
                      Tip
                    </Label>
                    <RichTextEditor
                      content={stepFormData.tip_text_nl}
                      onChange={(html) => setStepFormData({ ...stepFormData, tip_text_nl: html })}
                      placeholder="Handige tips voor deze stap..."
                      onImageUpload={handleImageUpload}
                      minHeight="80px"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStepDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={selectedStep ? handleUpdateStep : handleCreateStep}
              disabled={!stepFormData.title_en}
            >
              {selectedStep ? 'Save Changes' : 'Add Step'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default WorkInstructionsManager;
