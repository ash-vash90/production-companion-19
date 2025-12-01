import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface MeasurementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stepExecution: any;
  productionStep: any;
  onComplete: () => void;
}

const MeasurementDialog: React.FC<MeasurementDialogProps> = ({
  open,
  onOpenChange,
  stepExecution,
  productionStep,
  onComplete,
}) => {
  const { user } = useAuth();
  const [operatorInitials, setOperatorInitials] = useState<string>('');
  const [measurements, setMeasurements] = useState<Record<string, any>>({});
  const [validationResult, setValidationResult] = useState<{ passed: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Parse measurement fields from JSON
  const measurementFields = Array.isArray(productionStep.measurement_fields) 
    ? productionStep.measurement_fields 
    : [];
  const validationRules = productionStep.validation_rules || {};

  const handleMeasurementChange = (fieldName: string, value: any) => {
    setMeasurements(prev => ({ ...prev, [fieldName]: value }));
    setValidationResult(null);
  };

  const validateMeasurements = () => {
    if (!validationRules || Object.keys(validationRules).length === 0) {
      return { passed: true, message: 'Measurements recorded successfully' };
    }

    // Check pass/fail type
    if (validationRules.pass_fail) {
      const passFailField = measurementFields.find((f: any) => f.type === 'pass_fail');
      if (passFailField) {
        const passed = measurements[passFailField.name] === true || measurements[passFailField.name] === 'true';
        return {
          passed,
          message: passed ? 'Test PASSED ✓' : 'Test FAILED - Item marked for review',
        };
      }
    }

    // Check min/max validation for range
    if (validationRules.min !== undefined && validationRules.max !== undefined) {
      const field = measurementFields[0];
      const value = parseFloat(measurements[field.name]);
      
      if (isNaN(value)) {
        return { passed: false, message: 'Invalid value entered' };
      }

      const passed = value >= validationRules.min && value <= validationRules.max;
      return {
        passed,
        message: passed 
          ? `Value OK (${validationRules.min}-${validationRules.max})` 
          : `Value out of range (${validationRules.min}-${validationRules.max}). NOK - ${validationRules.restart ? `Restart from Step ${validationRules.restart}` : 'REJECT'}`,
      };
    }

    // Check min validation
    if (validationRules.min !== undefined) {
      const field = measurementFields[0];
      const value = parseFloat(measurements[field.name]);
      
      if (isNaN(value)) {
        return { passed: false, message: 'Invalid value entered' };
      }

      const passed = value >= validationRules.min;
      return {
        passed,
        message: passed
          ? `Value OK (≥ ${validationRules.min})`
          : `Value must be ≥ ${validationRules.min}. ${validationRules.restart ? `Restart from Step ${validationRules.restart}` : 'REJECT'}`,
      };
    }

    // Check max validation
    if (validationRules.max !== undefined) {
      // Check all fields if multiple (like RE and IE)
      for (const field of measurementFields) {
        const value = parseFloat(measurements[field.name]);
        if (!isNaN(value) && value >= validationRules.max) {
          return {
            passed: false,
            message: `${field.label} must be < ${validationRules.max}. REJECT`,
          };
        }
      }
      return { passed: true, message: 'All values OK' };
    }

    return { passed: true, message: 'Measurements recorded successfully' };
  };

  const handleSave = async () => {
    if (!operatorInitials) {
      toast.error('Error', { description: 'Please select operator initials' });
      return;
    }

    // Check if all required fields are filled
    const allFieldsFilled = measurementFields.every((field: any) => 
      measurements[field.name] !== undefined && measurements[field.name] !== ''
    );

    if (!allFieldsFilled) {
      toast.error('Error', { description: 'Please enter all required measurements' });
      return;
    }

    const validation = validateMeasurements();
    setValidationResult(validation);

    if (!validation.passed && productionStep.blocks_on_failure) {
      // Check if we need to restart from a specific step
      if (validationRules.restart) {
        toast.error('Validation Failed', { 
          description: `${validation.message}. You must restart from Step ${validationRules.restart}` 
        });
      } else {
        toast.error('Validation Failed', { description: validation.message });
      }
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('step_executions')
        .update({
          operator_initials: operatorInitials as 'MB' | 'HL' | 'AB' | 'EV',
          measurement_values: measurements,
          validation_status: validation.passed ? 'passed' : 'failed',
          validation_message: validation.message,
        })
        .eq('id', stepExecution.id);

      if (error) throw error;

      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'record_measurement',
        entity_type: 'step_execution',
        entity_id: stepExecution.id,
        details: { measurements, validation: validation.passed, operator: operatorInitials },
      });

      toast.success('Success', { 
        description: validation.message
      });
      
      onComplete();
      onOpenChange(false);
      
      setMeasurements({});
      setOperatorInitials('');
      setValidationResult(null);
    } catch (error: any) {
      console.error('Error saving measurements:', error);
      toast.error('Error', { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-logo">Record Measurements</DialogTitle>
          <DialogDescription className="text-base">
            {productionStep.description_en || 'Enter required measurement values'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-3">
            <Label htmlFor="operator" className="text-base font-data uppercase tracking-wider">Operator Initials *</Label>
            <Select value={operatorInitials} onValueChange={setOperatorInitials}>
              <SelectTrigger className="h-12 text-base border-2">
                <SelectValue placeholder="Select operator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MB" className="h-12 text-base">MB</SelectItem>
                <SelectItem value="HL" className="h-12 text-base">HL</SelectItem>
                <SelectItem value="AB" className="h-12 text-base">AB</SelectItem>
                <SelectItem value="EV" className="h-12 text-base">EV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {measurementFields.map((field: any) => (
            <div key={field.name} className="space-y-3">
              <Label htmlFor={field.name} className="text-base font-data uppercase tracking-wider">
                {field.label} {field.unit ? `(${field.unit})` : ''} *
              </Label>
              {field.type === 'pass_fail' ? (
                <Select
                  value={measurements[field.name]?.toString()}
                  onValueChange={(val) => handleMeasurementChange(field.name, val === 'true')}
                >
                  <SelectTrigger className="h-12 text-base border-2">
                    <SelectValue placeholder="Select result" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true" className="h-12 text-base">✓ PASS</SelectItem>
                    <SelectItem value="false" className="h-12 text-base">✗ NO PASS</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={field.name}
                  type="number"
                  step="0.01"
                  value={measurements[field.name] || ''}
                  onChange={(e) => handleMeasurementChange(field.name, e.target.value)}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                />
              )}
            </div>
          ))}

          {validationResult && (
            <div className={`flex items-start gap-3 p-4 rounded-lg border-2 ${
              validationResult.passed 
                ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20' 
                : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
            }`}>
              {validationResult.passed ? (
                <CheckCircle2 className="h-6 w-6 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-6 w-6 mt-0.5 flex-shrink-0" />
              )}
              <span className="text-base font-medium">{validationResult.message}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="lg" className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} variant="rhosonics" size="lg" className="flex-1">
            {saving ? 'Saving...' : 'Save Measurements'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MeasurementDialog;
