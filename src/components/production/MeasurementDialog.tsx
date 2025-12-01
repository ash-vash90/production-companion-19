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

  const measurementFields = productionStep.measurement_fields || {};
  const validationRules = productionStep.validation_rules || {};

  const handleMeasurementChange = (fieldName: string, value: any) => {
    setMeasurements(prev => ({ ...prev, [fieldName]: value }));
    setValidationResult(null);
  };

  const validateMeasurements = () => {
    if (!validationRules) return { passed: true, message: '' };

    // Check for pass/fail type
    if (validationRules.type === 'pass_fail') {
      const passed = measurements.pressure_test === true;
      return {
        passed,
        message: passed ? 'Test passed' : 'Test failed - mark as NO PASS',
      };
    }

    // Check for min/max value validations
    if (validationRules.min_value !== undefined || validationRules.max_value !== undefined) {
      const firstField = Object.keys(measurementFields)[0];
      const value = parseFloat(measurements[firstField]);

      if (isNaN(value)) {
        return { passed: false, message: 'Invalid value entered' };
      }

      if (validationRules.min_value !== undefined && validationRules.max_value !== undefined) {
        // Range check (e.g., PT100 resistance)
        const passed = value >= validationRules.min_value && value <= validationRules.max_value;
        return {
          passed,
          message: passed 
            ? 'Value within acceptable range - OK' 
            : `Value outside acceptable range (${validationRules.min_value}-${validationRules.max_value}${validationRules.unit || ''}) - NOK`,
        };
      }

      if (validationRules.min_value !== undefined) {
        const operator = validationRules.operator || '>=';
        const passed = operator === '>=' ? value >= validationRules.min_value : value > validationRules.min_value;
        return {
          passed,
          message: passed
            ? 'Measurement passed validation'
            : `Value must be ${operator} ${validationRules.min_value}. ${validationRules.fail_action || 'Please retry.'}`,
        };
      }

      if (validationRules.max_value !== undefined) {
        const operator = validationRules.operator || '<';
        const passed = operator === '<' ? value < validationRules.max_value : value <= validationRules.max_value;
        return {
          passed,
          message: passed
            ? 'Measurement passed validation'
            : `Value must be ${operator} ${validationRules.max_value}. ${validationRules.fail_action === 'reject' ? 'Item marked as REJECT' : ''}`,
        };
      }
    }

    return { passed: true, message: 'Measurements recorded' };
  };

  const handleSave = async () => {
    if (!operatorInitials) {
      toast.error('Error', { description: 'Please select operator initials' });
      return;
    }

    if (Object.keys(measurements).length === 0) {
      toast.error('Error', { description: 'Please enter all required measurements' });
      return;
    }

    const validation = validateMeasurements();
    setValidationResult(validation);

    if (!validation.passed && productionStep.blocks_on_failure) {
      toast.error('Validation Failed', { description: validation.message });
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
          value_recorded: JSON.stringify(measurements),
        })
        .eq('id', stepExecution.id);

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'record_measurement',
        entity_type: 'step_execution',
        entity_id: stepExecution.id,
        details: { measurements, validation: validation.passed, operator: operatorInitials },
      });

      toast.success('Success', { 
        description: validation.passed ? 'Measurements saved successfully' : validation.message 
      });
      
      onComplete();
      onOpenChange(false);
      
      // Reset form
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
          <DialogTitle>Record Measurements</DialogTitle>
          <DialogDescription>
            Enter the required measurement values for this production step
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="operator">Operator Initials *</Label>
            <Select value={operatorInitials} onValueChange={setOperatorInitials}>
              <SelectTrigger>
                <SelectValue placeholder="Select operator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MB">MB</SelectItem>
                <SelectItem value="HL">HL</SelectItem>
                <SelectItem value="AB">AB</SelectItem>
                <SelectItem value="EV">EV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {Object.entries(measurementFields).map(([fieldName, fieldConfig]: [string, any]) => (
            <div key={fieldName} className="space-y-2">
              <Label htmlFor={fieldName}>
                {fieldConfig.label} {fieldConfig.unit ? `(${fieldConfig.unit})` : ''} *
              </Label>
              {fieldConfig.type === 'boolean' ? (
                <Select
                  value={measurements[fieldName]?.toString()}
                  onValueChange={(val) => handleMeasurementChange(fieldName, val === 'true')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select result" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">PASS</SelectItem>
                    <SelectItem value="false">NO PASS</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={fieldName}
                  type="number"
                  step="0.01"
                  value={measurements[fieldName] || ''}
                  onChange={(e) => handleMeasurementChange(fieldName, e.target.value)}
                  placeholder={`Enter ${fieldConfig.label.toLowerCase()}`}
                />
              )}
            </div>
          ))}

          {validationResult && (
            <div className={`flex items-start gap-2 p-3 rounded-lg ${
              validationResult.passed ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-red-500/10 text-red-700 dark:text-red-400'
            }`}>
              {validationResult.passed ? (
                <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              )}
              <span className="text-sm">{validationResult.message}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Measurements'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MeasurementDialog;
