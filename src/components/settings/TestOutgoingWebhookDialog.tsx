import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Clock, Send, Copy, AlertTriangle, Info } from 'lucide-react';

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
  hint?: string;
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
      const { sendTestWebhookForConfig } = await import('@/lib/webhooks');

      // Get the secret for this webhook to use in signing
      const { data: webhookData } = await supabase
        .from('zapier_webhooks')
        .select('secret_key')
        .eq('id', webhookId)
        .single() as { data: { secret_key: string | null } | null; error: any };

      // Record timestamp before sending to help find the log entry
      const sentAt = new Date();

      let clientResult: any = null;
      let clientError: string | null = null;

      try {
        clientResult = await sendTestWebhookForConfig({
          id: webhookId,
          name: webhookName,
          webhook_url: webhookUrl,
          secret_key: webhookData?.secret_key || undefined,
        });
      } catch (err: any) {
        clientError = err.message || 'Unknown error';
      }

      // Wait a moment for the log to be written
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Fetch the latest log entry - this is the source of truth
      const { data: logEntry } = await supabase
        .from('outgoing_webhook_logs')
        .select('*')
        .eq('webhook_id', webhookId)
        .gte('created_at', sentAt.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Determine actual success based on log entry (source of truth)
      const logSuccess = logEntry && logEntry.response_status && logEntry.response_status >= 200 && logEntry.response_status < 400;
      const actualSuccess = logSuccess || (clientResult?.success === true);

      // Build the result based on what we know
      let finalResult: TestResult;

      if (logEntry) {
        // We have a log entry - use it as source of truth
        finalResult = {
          success: logSuccess,
          status_code: logEntry.response_status,
          response_time_ms: logEntry.response_time_ms,
          delivery_id: logEntry.delivery_id,
          error: logSuccess ? undefined : logEntry.error_message,
          response_body: logEntry.response_body,
        };

        // Add helpful hints based on status
        if (logSuccess) {
          finalResult.hint = 'The webhook was delivered successfully. Check your Zapier dashboard to see the received data.';
        } else if (logEntry.response_status === 404) {
          finalResult.hint = 'The webhook URL returned 404. Verify the URL is correct and the Zap is turned on.';
        } else if (logEntry.response_status === 401 || logEntry.response_status === 403) {
          finalResult.hint = 'Authentication failed. Check if the webhook URL requires authentication.';
        } else if (logEntry.response_status >= 500) {
          finalResult.hint = 'The receiving server had an error. Try again later or check the external service status.';
        } else if (logEntry.error_message?.includes('timeout')) {
          finalResult.hint = 'The request timed out. The receiving server may be slow or unresponsive.';
        }
      } else if (clientResult?.success) {
        // Client says success but no log yet
        finalResult = {
          success: true,
          status_code: clientResult.statusCode,
          response_time_ms: clientResult.responseTimeMs,
          hint: 'The webhook appears to have been sent. Check your Zapier dashboard to confirm receipt.',
        };
      } else {
        // No log and client failed - but could be CORS issue where it actually worked
        // Give the benefit of the doubt with a helpful message
        const isCorsLikeError = clientError?.includes('Failed to fetch') || clientError?.includes('NetworkError');
        
        if (isCorsLikeError) {
          finalResult = {
            success: false,
            error: 'Could not verify delivery status',
            hint: 'The webhook may have been delivered successfully. Browser security restrictions prevent us from confirming. Check your Zapier dashboard to verify the webhook was received.',
          };
        } else {
          finalResult = {
            success: false,
            error: clientError || clientResult?.error || 'Unknown error',
            hint: getErrorHint(clientError || clientResult?.error),
          };
        }
      }

      setResult(finalResult);

      if (finalResult.success) {
        toast.success('Webhook delivered successfully');
      } else if (finalResult.hint?.includes('may have been delivered')) {
        toast.info('Check your Zapier dashboard to verify delivery');
      } else {
        toast.error('Delivery issue detected');
      }
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message || 'Unknown error',
        hint: getErrorHint(error.message),
      });
      toast.error('Test failed');
    } finally {
      setTesting(false);
    }
  };

  const getErrorHint = (error?: string): string => {
    if (!error) return 'An unexpected error occurred. Please try again.';
    
    if (error.includes('Invalid URL') || error.includes('URL')) {
      return 'The webhook URL appears to be invalid. Check that it starts with https:// and is correctly formatted.';
    }
    if (error.includes('health score')) {
      return 'This webhook has had too many recent failures and is temporarily disabled. Wait a few minutes and try again.';
    }
    if (error.includes('timeout')) {
      return 'The request timed out. The receiving server may be slow or unresponsive.';
    }
    
    return 'Check the webhook URL and try again. If the issue persists, verify the receiving service is working.';
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
                    <span className="font-medium">Delivered</span>
                  </div>
                ) : result.hint?.includes('may have been delivered') ? (
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">Unverified</span>
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

              {/* Hint / Suggestion */}
              {result.hint && (
                <div className={`p-3 rounded-lg flex items-start gap-2 ${
                  result.success 
                    ? 'bg-green-500/10 border border-green-500/20' 
                    : result.hint.includes('may have been delivered')
                    ? 'bg-amber-500/10 border border-amber-500/20'
                    : 'bg-blue-500/10 border border-blue-500/20'
                }`}>
                  <Info className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                    result.success 
                      ? 'text-green-600 dark:text-green-400' 
                      : result.hint.includes('may have been delivered')
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`} />
                  <p className={`text-sm ${
                    result.success 
                      ? 'text-green-700 dark:text-green-300' 
                      : result.hint.includes('may have been delivered')
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-blue-700 dark:text-blue-300'
                  }`}>
                    {result.hint}
                  </p>
                </div>
              )}

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

              {/* Error Message (only show if not already explained in hint) */}
              {result.error && !result.hint?.includes('may have been delivered') && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm font-medium text-destructive mb-1">Error Details</p>
                  <p className="text-sm text-destructive/80">{result.error}</p>
                </div>
              )}

              {/* Response Body */}
              {result.response_body && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Response Body</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(formatResponseBody(result.response_body))}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <ScrollArea className="h-[200px] w-full rounded-md border bg-muted/30">
                    <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
                      {formatResponseBody(result.response_body)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
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
