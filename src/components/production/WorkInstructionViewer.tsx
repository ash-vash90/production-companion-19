import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Lightbulb,
  Clock,
  Wrench,
  CheckCircle2,
  Circle,
  HelpCircle,
  Loader2,
  X
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type ProductType = Database['public']['Enums']['product_type'];

// Type definitions for work instructions (until types are regenerated)
interface WorkInstruction {
  id: string;
  product_type: ProductType;
  production_step_id: string | null;
  title_en: string;
  title_nl: string | null;
  description_en: string | null;
  description_nl: string | null;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface InstructionStep {
  id: string;
  work_instruction_id: string;
  step_number: number;
  title_en: string;
  title_nl: string | null;
  content_en: string | null;
  content_nl: string | null;
  warning_text_en: string | null;
  warning_text_nl: string | null;
  tip_text_en: string | null;
  tip_text_nl: string | null;
  estimated_duration_minutes: number | null;
  required_tools: string[] | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface InstructionWithSteps extends WorkInstruction {
  instruction_steps: InstructionStep[];
}

interface WorkInstructionViewerProps {
  productType: ProductType;
  productionStepId?: string;
  productionStepNumber?: number;
  className?: string;
}

export function WorkInstructionViewer({
  productType,
  productionStepId,
  productionStepNumber,
  className
}: WorkInstructionViewerProps) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [instructions, setInstructions] = useState<InstructionWithSteps[]>([]);
  const [selectedInstruction, setSelectedInstruction] = useState<InstructionWithSteps | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      loadInstructions();
    }
  }, [open, productType, productionStepId]);

  const loadInstructions = async () => {
    try {
      setLoading(true);

      // Build query - get instructions for this product type
      let query = supabase
        .from('work_instructions' as any)
        .select(`
          *,
          instruction_steps (*)
        `)
        .eq('product_type', productType)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      // If we have a specific production step, filter for it or general instructions
      if (productionStepId) {
        query = query.or(`production_step_id.eq.${productionStepId},production_step_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;

      const instructionsData = (data as unknown as InstructionWithSteps[]) || [];
      setInstructions(instructionsData);

      // Auto-select the first instruction linked to the current step, or first available
      const linkedInstruction = instructionsData.find(i => i.production_step_id === productionStepId);
      const firstInstruction = linkedInstruction || instructionsData[0] || null;
      setSelectedInstruction(firstInstruction);
      setCurrentStepIndex(0);
    } catch (error) {
      console.error('Failed to load instructions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getText = (en: string | null, nl: string | null) => {
    if (language === 'nl' && nl) return nl;
    return en || '';
  };

  const currentStep = selectedInstruction?.instruction_steps
    .sort((a, b) => a.step_number - b.step_number)[currentStepIndex];

  const totalSteps = selectedInstruction?.instruction_steps.length || 0;

  const handlePreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      // Mark current step as completed when moving to next
      if (currentStep) {
        setCompletedSteps(prev => new Set([...prev, currentStep.id]));
      }
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleSelectInstruction = (instruction: InstructionWithSteps) => {
    setSelectedInstruction(instruction);
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
  };

  const toggleStepComplete = (stepId: string) => {
    setCompletedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
        >
          <HelpCircle className="h-4 w-4 mr-2" />
          {language === 'nl' ? 'Hulp Nodig?' : 'Need Help?'}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {language === 'nl' ? 'Werkinstructies' : 'Work Instructions'}
            </SheetTitle>
          </div>
          <SheetDescription>
            {productionStepNumber && (
              <span className="text-primary">
                {language === 'nl' ? `Stap ${productionStepNumber}` : `Step ${productionStepNumber}`}
              </span>
            )}
            {' - '}
            {language === 'nl'
              ? 'Bekijk gedetailleerde instructies voor deze stap'
              : 'View detailed instructions for this step'}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : instructions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">
              {language === 'nl' ? 'Geen instructies beschikbaar' : 'No instructions available'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {language === 'nl'
                ? 'Er zijn nog geen werkinstructies voor deze stap geconfigureerd.'
                : 'No work instructions have been configured for this step yet.'}
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Instruction selector (if multiple) */}
            {instructions.length > 1 && (
              <div className="px-4 py-2 border-b">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {instructions.map((instruction) => (
                    <Button
                      key={instruction.id}
                      variant={selectedInstruction?.id === instruction.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleSelectInstruction(instruction)}
                      className="shrink-0"
                    >
                      {getText(instruction.title_en, instruction.title_nl)}
                      {instruction.production_step_id === productionStepId && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {language === 'nl' ? 'Aanbevolen' : 'Recommended'}
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {selectedInstruction && (
              <>
                {/* Step progress indicator */}
                <div className="px-4 py-3 border-b bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      {getText(selectedInstruction.title_en, selectedInstruction.title_nl)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {currentStepIndex + 1} / {totalSteps}
                    </span>
                  </div>
                  {/* Progress dots */}
                  <div className="flex gap-1">
                    {selectedInstruction.instruction_steps
                      .sort((a, b) => a.step_number - b.step_number)
                      .map((step, idx) => (
                        <button
                          key={step.id}
                          onClick={() => setCurrentStepIndex(idx)}
                          className={`h-2 flex-1 rounded-full transition-colors ${
                            idx === currentStepIndex
                              ? 'bg-primary'
                              : completedSteps.has(step.id)
                                ? 'bg-primary/50'
                                : 'bg-muted-foreground/20'
                          }`}
                        />
                      ))}
                  </div>
                </div>

                {/* Current step content */}
                {currentStep && (
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-4">
                      {/* Step header */}
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                          {currentStep.step_number}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">
                            {getText(currentStep.title_en, currentStep.title_nl)}
                          </h3>
                          {currentStep.estimated_duration_minutes && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <Clock className="h-4 w-4" />
                              <span>
                                ~{currentStep.estimated_duration_minutes}{' '}
                                {language === 'nl' ? 'minuten' : 'minutes'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Warning box */}
                      {currentStep.warning_text_en && (
                        <div className="flex gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-amber-800 dark:text-amber-200 text-sm mb-1">
                              {language === 'nl' ? 'Waarschuwing' : 'Warning'}
                            </h4>
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                              {getText(currentStep.warning_text_en, currentStep.warning_text_nl)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Main content */}
                      {currentStep.content_en && (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <p className="whitespace-pre-wrap">
                            {getText(currentStep.content_en, currentStep.content_nl)}
                          </p>
                        </div>
                      )}

                      {/* Required tools */}
                      {currentStep.required_tools && currentStep.required_tools.length > 0 && (
                        <div className="p-3 rounded-lg bg-muted/50 border">
                          <div className="flex items-center gap-2 mb-2">
                            <Wrench className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {language === 'nl' ? 'Benodigd gereedschap' : 'Required Tools'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {currentStep.required_tools.map((tool, idx) => (
                              <Badge key={idx} variant="secondary">
                                {tool}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tip box */}
                      {currentStep.tip_text_en && (
                        <div className="flex gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                          <Lightbulb className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-blue-800 dark:text-blue-200 text-sm mb-1">
                              {language === 'nl' ? 'Tip' : 'Tip'}
                            </h4>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              {getText(currentStep.tip_text_en, currentStep.tip_text_nl)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Mark as understood button */}
                      <Button
                        variant={completedSteps.has(currentStep.id) ? 'secondary' : 'outline'}
                        className="w-full"
                        onClick={() => toggleStepComplete(currentStep.id)}
                      >
                        {completedSteps.has(currentStep.id) ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                            {language === 'nl' ? 'Begrepen!' : 'Understood!'}
                          </>
                        ) : (
                          <>
                            <Circle className="h-4 w-4 mr-2" />
                            {language === 'nl' ? 'Markeer als begrepen' : 'Mark as understood'}
                          </>
                        )}
                      </Button>
                    </div>
                  </ScrollArea>
                )}

                {/* Navigation footer */}
                <div className="p-4 border-t bg-background">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      onClick={handlePreviousStep}
                      disabled={currentStepIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      {language === 'nl' ? 'Vorige' : 'Previous'}
                    </Button>

                    <div className="text-sm text-muted-foreground">
                      {completedSteps.size} / {totalSteps}{' '}
                      {language === 'nl' ? 'voltooid' : 'completed'}
                    </div>

                    <Button
                      variant={currentStepIndex === totalSteps - 1 ? 'default' : 'outline'}
                      onClick={handleNextStep}
                      disabled={currentStepIndex === totalSteps - 1}
                    >
                      {language === 'nl' ? 'Volgende' : 'Next'}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default WorkInstructionViewer;
