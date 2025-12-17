import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Clock, Send, Copy } from 'lucide-react';

interface TestOutgoingWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookId: string;
  webhookName: string;
  webhookUrl: string;
  eventType: string;
}

interface TestResult {
  success: boolean;
  status_code?: number;
  response_time_ms?: number;
  delivery_id?: string;
  error?: string;
  response_body?: any;
}

const TestOutgoingWebhookDialog: React.FC<TestOutgoingWebhookDialogProps> = ({
  open,
  onOpenChange,
  webhookId,
  webhookName,
  webhookUrl,
  eventType,
}) => {
  const { t } = useLanguage();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);

    try {
      const { sendTestWebhook } = await import('@/lib/webhooks');
      
      // Get the secret for this webhook to use in signing
      const { data: webhookData } = await supabase
        .from('zapier_webhooks')
        .select('secret_key')
        .eq('id', webhookId)
        .single() as { data: { secret_key: string | null } | null; error: any };

      const testResult = await sendTestWebhook(webhookUrl, webhookData?.secret_key || undefined);

      // Fetch the latest log entry for more details
      const { data: logEntry } = await supabase
        .from('outgoing_webhook_logs')
        .select('*')
        .eq('webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setResult({
        success: testResult.success,
        status_code: testResult.statusCode || logEntry?.response_status,
        response_time_ms: testResult.responseTimeMs || logEntry?.response_time_ms,
        delivery_id: logEntry?.delivery_id,
        error: testResult.error || logEntry?.error_message,
        response_body: logEntry?.response_body,
      });

      if (testResult.success) {
        toast.success('Test sent successfully');
      } else {
        toast.error('Test failed', { description: testResult.error });
      }
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message || 'Unknown error',
      });
      toast.error('Test failed', { description: error.message });
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const formatResponseBody = (body: any): string => {
    if (!body) return 'No response body';
    if (typeof body === 'string') return body;
    try {
      return JSON.stringify(body, null, 2);
    } catch {
      return String(body);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Test Outgoing Webhook
          </DialogTitle>
          <DialogDescription>
            Send a test payload to <span className="font-mono text-xs">{webhookName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Webhook Info */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">URL</span>
              <code className="text-xs bg-background px-2 py-1 rounded truncate max-w-[300px]">
                {webhookUrl}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Event Type</span>
              <Badge variant="outline">{eventType}</Badge>
            </div>
          </div>

          <Separator />

          {/* Test Results */}
          {result && (
            <div className="space-y-4">
              {/* Status Summary */}
              <div className="flex items-center gap-4">
                {result.success ? (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Success</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">Failed</span>
                  </div>
                )}
                
                {result.status_code && (
                  <Badge variant={result.status_code < 400 ? 'default' : 'destructive'}>
                    HTTP {result.status_code}
                  </Badge>
                )}
                
                {result.response_time_ms && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {result.response_time_ms}ms
                  </div>
                )}
              </div>

              {/* Delivery ID */}
              {result.delivery_id && (
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <span className="text-sm text-muted-foreground">Delivery ID</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs">{result.delivery_id}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(result.delivery_id!)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {result.error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm font-medium text-destructive mb-1">Error</p>
                  <p className="text-sm text-destructive/80">{result.error}</p>
                </div>
              )}

              {/* Response Body */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Response Body</span>
                  {result.response_body && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(formatResponseBody(result.response_body))}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-[200px] w-full rounded-md border bg-muted/30">
                  <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
                    {formatResponseBody(result.response_body)}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          )}

          {!result && !testing && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Send className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Click "Send Test" to send a test payload to this webhook endpoint.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                The test will include HMAC signature if a secret is configured.
              </p>
            </div>
          )}

          {testing && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Sending test webhook...</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={runTest} disabled={testing}>
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Test
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TestOutgoingWebhookDialog;
