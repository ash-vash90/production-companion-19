import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime } from '@/lib/utils';
import { Send, ChevronDown, ChevronRight, Copy, RefreshCw, Loader2, AlertCircle, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface OutgoingLog {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: any;
  response_status: number | null;
  response_body: any;
  response_time_ms: number | null;
  error_message: string | null;
  delivery_id: string | null;
  attempts: number;
  created_at: string;
}

const OutgoingWebhookLogs: React.FC = () => {
  const [logs, setLogs] = useState<OutgoingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Cast to any since outgoing_webhook_logs is a new table not yet in generated types
      const { data, error } = await supabase
        .from('outgoing_webhook_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50) as { data: OutgoingLog[] | null; error: any };

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching outgoing logs:', error);
      // Table might not exist yet
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const toggleExpand = (logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const copyJson = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast.success('Copied to clipboard');
  };

  const getStatusBadge = (log: OutgoingLog) => {
    if (log.error_message) {
      return <Badge variant="destructive" className="text-xs">Error</Badge>;
    }
    if (log.response_status && log.response_status >= 400) {
      return <Badge variant="destructive" className="text-xs">{log.response_status}</Badge>;
    }
    if (log.response_status && log.response_status >= 200 && log.response_status < 300) {
      return <Badge variant="success" className="text-xs">{log.response_status}</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">Pending</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Send className="h-5 w-5" />
              Outgoing Webhook Logs
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              System-sent webhooks and delivery status
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 border rounded-lg border-dashed">
            <Send className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-medium mb-1">No outgoing webhooks yet</h3>
            <p className="text-sm text-muted-foreground">
              Outgoing webhook calls will appear here
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {logs.map((log) => (
                <Collapsible key={log.id} open={expandedLogs.has(log.id)}>
                  <CollapsibleTrigger asChild>
                    <div
                      onClick={() => toggleExpand(log.id)}
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {expandedLogs.has(log.id) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        {log.error_message ? (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{log.event_type}</Badge>
                            {log.attempts > 1 && (
                              <span className="text-xs text-muted-foreground">
                                {log.attempts} attempts
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {formatDateTime(log.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {log.response_time_ms && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {log.response_time_ms}ms
                          </div>
                        )}
                        {getStatusBadge(log)}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-8 mt-2 space-y-3 pb-2">
                      {/* Error Message */}
                      {log.error_message && (
                        <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded text-destructive text-xs">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{log.error_message}</span>
                        </div>
                      )}

                      {/* Delivery ID */}
                      {log.delivery_id && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Delivery ID:</span>
                          <code className="bg-muted px-1.5 py-0.5 rounded">{log.delivery_id}</code>
                        </div>
                      )}

                      {/* Payload */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Payload Sent</span>
                          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => copyJson(log.payload)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <pre className="text-[10px] bg-muted p-2 rounded overflow-x-auto max-h-[150px]">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </div>

                      {/* Response Body */}
                      {log.response_body && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Response</span>
                            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => copyJson(log.response_body)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <pre className="text-[10px] bg-muted p-2 rounded overflow-x-auto max-h-[100px]">
                            {JSON.stringify(log.response_body, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default OutgoingWebhookLogs;
