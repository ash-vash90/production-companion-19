import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime } from '@/lib/utils';
import { Webhook, ChevronDown, ChevronRight, Copy, RefreshCw, Loader2, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface IncomingLog {
  id: string;
  incoming_webhook_id: string;
  request_body: any;
  request_headers: any;
  response_status: number | null;
  response_body: any;
  response_time_ms: number | null;
  error_message: string | null;
  executed_rules: any;
  is_test: boolean;
  created_at: string;
  webhook_name?: string;
}

interface IncomingWebhook {
  id: string;
  name: string;
}

const IncomingWebhookLogs: React.FC = () => {
  const [logs, setLogs] = useState<IncomingLog[]>([]);
  const [webhooks, setWebhooks] = useState<IncomingWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [filterWebhook, setFilterWebhook] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Fetch webhooks for names
      const { data: webhooksData } = await supabase
        .from('incoming_webhooks_safe' as any)
        .select('id, name') as { data: IncomingWebhook[] | null };
      
      setWebhooks(webhooksData || []);

      // Build query
      let query = supabase
        .from('webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filterWebhook !== 'all') {
        query = query.eq('incoming_webhook_id', filterWebhook);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Map webhook names
      const webhookMap = new Map((webhooksData || []).map(w => [w.id, w.name]));
      const logsWithNames = (data || []).map(log => ({
        ...log,
        webhook_name: webhookMap.get(log.incoming_webhook_id) || 'Unknown',
      }));

      // Filter by status client-side
      let filteredLogs = logsWithNames;
      if (filterStatus === 'success') {
        filteredLogs = logsWithNames.filter(l => l.response_status && l.response_status >= 200 && l.response_status < 300 && !l.error_message);
      } else if (filterStatus === 'error') {
        filteredLogs = logsWithNames.filter(l => l.error_message || (l.response_status && l.response_status >= 400));
      }

      setLogs(filteredLogs);
    } catch (error: any) {
      console.error('Error fetching incoming logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterWebhook, filterStatus]);

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

  const getStatusBadge = (log: IncomingLog) => {
    if (log.is_test) {
      return <Badge variant="outline" className="text-xs">Test</Badge>;
    }
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Webhook className="h-5 w-5" />
              Incoming Webhook Logs
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              Received webhooks and execution results
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterWebhook} onValueChange={setFilterWebhook}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="All webhooks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All webhooks</SelectItem>
                {webhooks.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 border rounded-lg border-dashed">
            <Webhook className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-medium mb-1">No incoming webhooks yet</h3>
            <p className="text-sm text-muted-foreground">
              Incoming webhook calls will appear here
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{log.webhook_name}</span>
                            {log.executed_rules && Array.isArray(log.executed_rules) && log.executed_rules.length > 0 && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                {log.executed_rules.length} rule{log.executed_rules.length !== 1 ? 's' : ''}
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

                      {/* Executed Rules */}
                      {log.executed_rules && Array.isArray(log.executed_rules) && log.executed_rules.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-muted-foreground">Executed Rules</span>
                          <div className="flex flex-wrap gap-1">
                            {log.executed_rules.map((rule: any, idx: number) => (
                              <Badge key={idx} variant={rule.success ? 'success' : 'destructive'} className="text-xs">
                                {rule.name || `Rule ${idx + 1}`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Request Body */}
                      {log.request_body && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Request Body</span>
                            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => copyJson(log.request_body)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <pre className="text-[10px] bg-muted p-2 rounded overflow-x-auto max-h-[150px]">
                            {JSON.stringify(log.request_body, null, 2)}
                          </pre>
                        </div>
                      )}

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

export default IncomingWebhookLogs;
