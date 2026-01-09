import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Copy, Eye, CheckCircle, AlertTriangle } from 'lucide-react';

interface PayloadPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleName: string;
  actionType: string;
  fieldMappings: Record<string, string>;
  conditions?: { field: string; operator: string; value: string } | null;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  create_work_order: 'Create Work Order',
  update_work_order_status: 'Update Work Order Status',
  update_item_status: 'Update Item Status',
  log_activity: 'Log Activity',
  trigger_outgoing_webhook: 'Forward to Webhook',
};

/**
 * Extract value from JSON using dot notation path
 */
function getValueByPath(obj: any, path: string): any {
  if (!path || path === '$') return obj;
  
  let cleanPath = path;
  if (cleanPath.startsWith('$.')) {
    cleanPath = cleanPath.slice(2);
  } else if (cleanPath.startsWith('$')) {
    cleanPath = cleanPath.slice(1);
  }
  
  if (!cleanPath) return obj;
  
  const parts = cleanPath.split('.');
  let value = obj;
  
  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      value = value[arrayMatch[1]];
      if (Array.isArray(value)) {
        value = value[parseInt(arrayMatch[2])];
      } else {
        return undefined;
      }
    } else {
      value = value[part];
    }
  }
  
  return value;
}

const PayloadPreviewDialog: React.FC<PayloadPreviewDialogProps> = ({
  open,
  onOpenChange,
  ruleName,
  actionType,
  fieldMappings,
  conditions,
}) => {
  const [sampleJson, setSampleJson] = useState(JSON.stringify({
    order: {
      number: 'WO-2024-001',
      productType: 'SDM_ECO',
      quantity: 10,
      customerName: 'Acme Corp',
      externalId: 'EXT-12345',
      startDate: '2024-01-15',
      shippingDate: '2024-01-22',
      notes: 'Rush order',
    },
    item: {
      serialNumber: 'S-12345678-001',
      status: 'completed',
      stepNumber: 5,
    },
    event: {
      action: 'external_sync',
      entityType: 'work_order',
      entityId: '550e8400-e29b-41d4-a716-446655440000',
      data: { source: 'ERP', timestamp: '2024-01-15T10:30:00Z' },
    },
  }, null, 2));

  const extractedValues = useMemo(() => {
    try {
      const parsed = JSON.parse(sampleJson);
      const values: Record<string, { path: string; value: any; found: boolean }> = {};
      
      for (const [key, path] of Object.entries(fieldMappings)) {
        if (path) {
          const value = getValueByPath(parsed, path);
          values[key] = {
            path,
            value,
            found: value !== undefined,
          };
        }
      }
      
      return values;
    } catch {
      return null;
    }
  }, [sampleJson, fieldMappings]);

  const conditionResult = useMemo(() => {
    if (!conditions?.field) return null;
    
    try {
      const parsed = JSON.parse(sampleJson);
      const value = getValueByPath(parsed, conditions.field);
      
      let passed = false;
      switch (conditions.operator) {
        case 'equals':
          passed = String(value) === String(conditions.value);
          break;
        case 'not_equals':
          passed = String(value) !== String(conditions.value);
          break;
        case 'contains':
          passed = String(value || '').includes(conditions.value);
          break;
        case 'exists':
          passed = value !== undefined && value !== null;
          break;
      }
      
      return {
        field: conditions.field,
        operator: conditions.operator,
        expectedValue: conditions.value,
        actualValue: value,
        passed,
      };
    } catch {
      return null;
    }
  }, [sampleJson, conditions]);

  const missingRequired = useMemo(() => {
    if (!extractedValues) return [];
    const missing: string[] = [];
    
    // Define required fields per action type
    const requiredFields: Record<string, string[]> = {
      create_work_order: ['productType', 'quantity'],
      update_work_order_status: ['workOrderNumber', 'status'],
      update_item_status: ['serialNumber'],
      log_activity: ['action', 'entityType'],
      trigger_outgoing_webhook: ['webhookUrl'],
    };
    
    const required = requiredFields[actionType] || [];
    for (const field of required) {
      if (extractedValues[field] && !extractedValues[field].found) {
        missing.push(field);
      }
    }
    
    return missing;
  }, [extractedValues, actionType]);

  const copyExtracted = () => {
    if (!extractedValues) return;
    const simplified: Record<string, any> = {};
    for (const [key, data] of Object.entries(extractedValues)) {
      simplified[key] = data.value;
    }
    navigator.clipboard.writeText(JSON.stringify(simplified, null, 2));
    toast.success('Copied extracted values');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview Payload Extraction
          </DialogTitle>
          <DialogDescription>
            Rule: <span className="font-medium">{ruleName}</span> ({ACTION_TYPE_LABELS[actionType] || actionType})
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 p-1">
            {/* Sample JSON Input */}
            <div className="space-y-2">
              <Label>Sample Input JSON</Label>
              <Textarea
                value={sampleJson}
                onChange={(e) => setSampleJson(e.target.value)}
                className="text-xs min-h-[120px]"
                placeholder='{"key": "value"}'
              />
            </div>

            <Separator />

            {/* Condition Check */}
            {conditions?.field && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Condition Check
                  {conditionResult && (
                    <Badge variant={conditionResult.passed ? 'success' : 'destructive'} className="text-xs">
                      {conditionResult.passed ? 'Passed' : 'Failed'}
                    </Badge>
                  )}
                </Label>
                {conditionResult && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Field: </span>
                        <code className="bg-background px-1 rounded">{conditionResult.field}</code>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Operator: </span>
                        <code className="bg-background px-1 rounded">{conditionResult.operator}</code>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expected: </span>
                        <code className="bg-background px-1 rounded">{JSON.stringify(conditionResult.expectedValue)}</code>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Actual: </span>
                        <code className="bg-background px-1 rounded">{JSON.stringify(conditionResult.actualValue)}</code>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Extracted Values */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Extracted Values</Label>
                <Button variant="ghost" size="sm" className="h-7" onClick={copyExtracted}>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy
                </Button>
              </div>

              {missingRequired.length > 0 && (
                <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded text-amber-600 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Missing required fields: {missingRequired.join(', ')}</span>
                </div>
              )}

              {extractedValues ? (
                <div className="space-y-2">
                  {Object.entries(extractedValues).map(([key, data]) => (
                    <div
                      key={key}
                      className={`p-3 border rounded-lg ${data.found ? 'border-border' : 'border-amber-500/50 bg-amber-500/5'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{key}</span>
                          {data.found ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                        </div>
                        <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {data.path}
                        </code>
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground">Value: </span>
                        <code className="bg-muted px-1.5 py-0.5 rounded">
                          {data.found ? JSON.stringify(data.value) : 'undefined'}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                  Invalid JSON - please check your sample input
                </div>
              )}
            </div>

            {/* Final JSON Preview */}
            {extractedValues && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Resulting Database Values</Label>
                  <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(
                      Object.fromEntries(
                        Object.entries(extractedValues)
                          .filter(([_, data]) => data.found)
                          .map(([key, data]) => [key, data.value])
                      ),
                      null,
                      2
                    )}
                  </pre>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PayloadPreviewDialog;
