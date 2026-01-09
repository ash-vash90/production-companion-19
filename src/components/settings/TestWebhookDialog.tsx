import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Play, CheckCircle, XCircle, AlertCircle, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface TestWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookId: string;
  webhookName: string;
}

interface RuleResult {
  ruleName: string;
  actionType: string;
  extractedValues: Record<string, any>;
  wouldExecute: boolean;
  conditionResult?: { passed: boolean; reason: string };
}

interface TestResult {
  success: boolean;
  webhook: { id: string; name: string; enabled: boolean };
  testPayload: any;
  ruleResults: RuleResult[];
  summary: { totalRules: number; enabledRules: number; disabledRules: number };
  responseTimeMs: number;
  dryRun: boolean;
  liveResult?: { status: number; body?: any; error?: string };
}

const SAMPLE_PAYLOADS: Record<string, any> = {
  create_work_order: {
    order: {
      number: 'WO-TEST-001',
      productType: 'SDM_ECO',
      quantity: 5,
      customerName: 'Test Customer',
      externalId: 'ERP-12345',
      startDate: new Date().toISOString().split('T')[0],
      shippingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: 'Test order from webhook',
    },
  },
  update_status: {
    order: {
      number: 'WO-2024-001',
      status: 'in_progress',
    },
  },
};

const TestWebhookDialog: React.FC<TestWebhookDialogProps> = ({
  open,
  onOpenChange,
  webhookId,
  webhookName,
}) => {
  const [payload, setPayload] = useState(JSON.stringify(SAMPLE_PAYLOADS.create_work_order, null, 2));
  const [testing, setTesting] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set());

  const runTest = async () => {
    setTesting(true);
    setError(null);
    setResult(null);

    try {
      let parsedPayload;
      try {
        parsedPayload = JSON.parse(payload);
      } catch {
        throw new Error('Invalid JSON payload');
      }

      const { data, error: fnError } = await supabase.functions.invoke('test-webhook', {
        body: {
          webhook_id: webhookId,
          test_payload: parsedPayload,
          dry_run: dryRun,
        },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setResult(data);
      toast.success(`Test completed in ${data.responseTimeMs}ms`);
    } catch (err: any) {
      console.error('Test error:', err);
      setError(err.message);
      toast.error('Test failed');
    } finally {
      setTesting(false);
    }
  };

  const toggleRule = (index: number) => {
    setExpandedRules(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const loadSamplePayload = (type: string) => {
    setPayload(JSON.stringify(SAMPLE_PAYLOADS[type] || {}, null, 2));
  };

  const copyPayload = () => {
    navigator.clipboard.writeText(payload);
    toast.success('Copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Test Webhook
          </DialogTitle>
          <DialogDescription>
            Send a test payload to <span className="font-medium">{webhookName}</span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 p-1">
            {/* Payload Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Test Payload (JSON)</Label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => loadSamplePayload('create_work_order')}>
                    Work Order
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => loadSamplePayload('update_status')}>
                    Status Update
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyPayload}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                className="text-xs min-h-[150px]"
                placeholder='{"key": "value"}'
              />
            </div>

            {/* Options */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <Label className="text-sm">Dry Run Mode</Label>
                <p className="text-xs text-muted-foreground">
                  {dryRun ? 'Simulate only - no actual changes' : 'Execute rules and make real changes'}
                </p>
              </div>
              <Switch checked={dryRun} onCheckedChange={setDryRun} />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-destructive">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-4">
                <Separator />

                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">{result.summary.totalRules}</div>
                    <div className="text-xs text-muted-foreground">Total Rules</div>
                  </div>
                  <div className="text-center p-3 bg-green-500/10 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{result.summary.enabledRules}</div>
                    <div className="text-xs text-muted-foreground">Would Execute</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">{result.responseTimeMs}ms</div>
                    <div className="text-xs text-muted-foreground">Response Time</div>
                  </div>
                </div>

                {/* Rule Results */}
                <div className="space-y-2">
                  <Label className="text-sm">Rule Evaluation Results</Label>
                  {result.ruleResults.map((rule, idx) => (
                    <Collapsible key={idx} open={expandedRules.has(idx)}>
                      <CollapsibleTrigger asChild>
                        <div
                          onClick={() => toggleRule(idx)}
                          className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            {expandedRules.has(idx) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {rule.wouldExecute ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium text-sm">{rule.ruleName}</span>
                            <Badge variant="outline" className="text-xs">{rule.actionType}</Badge>
                          </div>
                          <Badge variant={rule.wouldExecute ? 'success' : 'secondary'} className="text-xs">
                            {rule.wouldExecute ? 'Would Execute' : 'Skipped'}
                          </Badge>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-6 mt-2 p-3 bg-muted/30 rounded-lg space-y-2">
                          {rule.conditionResult && (
                            <div className="text-xs">
                              <span className="font-medium">Condition: </span>
                              <span className={rule.conditionResult.passed ? 'text-green-600' : 'text-amber-600'}>
                                {rule.conditionResult.reason}
                              </span>
                            </div>
                          )}
                          <div className="text-xs">
                            <span className="font-medium">Extracted Values:</span>
                            <pre className="mt-1 p-2 bg-background rounded text-[10px] overflow-x-auto">
                              {JSON.stringify(rule.extractedValues, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>

                {/* Live Result */}
                {result.liveResult && (
                  <div className="space-y-2">
                    <Label className="text-sm">Live Execution Result</Label>
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={result.liveResult.status === 200 ? 'success' : 'destructive'}>
                          {result.liveResult.status || 'Error'}
                        </Badge>
                        {result.liveResult.error && (
                          <span className="text-xs text-destructive">{result.liveResult.error}</span>
                        )}
                      </div>
                      {result.liveResult.body && (
                        <pre className="text-[10px] bg-muted p-2 rounded overflow-x-auto">
                          {JSON.stringify(result.liveResult.body, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Close
          </Button>
          <Button onClick={runTest} disabled={testing} className="w-full sm:w-auto">
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                {dryRun ? 'Run Test (Dry Run)' : 'Run Test (Live)'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TestWebhookDialog;
