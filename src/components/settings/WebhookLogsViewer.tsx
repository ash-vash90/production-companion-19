import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime } from '@/lib/utils';
import { History, ChevronDown, ChevronRight, Copy, RefreshCw, Loader2, AlertCircle, CheckCircle, Clock, Beaker } from 'lucide-react';
import { toast } from 'sonner';

interface WebhookLog {
  id: string;
  incoming_webhook_id: string;
  request_body: any;
  request_headers: any;
  response_status: number | null;
  response_body: any;
  executed_rules: any;
  error_message: string | null;
  created_at: string;
  is_test?: boolean;
  response_time_ms?: number;
}

interface WebhookLogsViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookId: string;
  webhookName: string;
}

const WebhookLogsViewer: React.FC<WebhookLogsViewerProps> = ({
  open,
  onOpenChange,
  webhookId,
  webhookName,
}) => {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('webhook_logs')
        .select('*')
        .eq('incoming_webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && webhookId) {
      fetchLogs();
    }
  }, [open, webhookId, page]);

  const filteredLogs = logs.filter(log => {
    // Status filter
    if (statusFilter === 'success' && (log.error_message || (log.response_status && log.response_status >= 400))) {
      return false;
    }
    if (statusFilter === 'error' && !log.error_message && (!log.response_status || log.response_status < 400)) {
      return false;
    }

    // Type filter
    if (typeFilter === 'test' && !log.is_test) return false;
    if (typeFilter === 'live' && log.is_test) return false;

    // Search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const bodyStr = JSON.stringify(log.request_body || {}).toLowerCase();
      const rulesStr = JSON.stringify(log.executed_rules || []).toLowerCase();
      if (!bodyStr.includes(searchLower) && !rulesStr.includes(searchLower)) {
        return false;
      }
    }

    return true;
  });

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

  const getStatusBadge = (log: WebhookLog) => {
    if (log.error_message) {
      return <Badge variant="destructive" className="text-xs">Error</Badge>;
    }
    if (log.response_status && log.response_status >= 400) {
      return <Badge variant="destructive" className="text-xs">{log.response_status}</Badge>;
    }
    return <Badge variant="success" className="text-xs">{log.response_status || 200}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100%-2rem)] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Webhook Logs
          </DialogTitle>
          <DialogDescription>
            Execution history for <span className="font-medium">{webhookName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="test">Test</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[150px] h-8 text-xs"
          />

          <Button variant="outline" size="sm" className="h-8" onClick={fetchLogs} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* Logs List */}
        <ScrollArea className="max-h-[50vh]">
          {loading && logs.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No logs found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
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
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(log.created_at)}
                          </div>
                          <div className="text-xs mt-0.5">
                            {log.executed_rules && Array.isArray(log.executed_rules) && log.executed_rules.length > 0
                              ? `${log.executed_rules.length} rule${log.executed_rules.length > 1 ? 's' : ''} executed`
                              : 'No rules executed'}
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
                        {log.is_test && (
                          <Badge variant="outline" className="text-xs">
                            <Beaker className="h-3 w-3 mr-1" />
                            Test
                          </Badge>
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

                      {/* Request Body */}
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

                      {/* Executed Rules */}
                      {log.executed_rules && Array.isArray(log.executed_rules) && log.executed_rules.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-muted-foreground">Executed Rules</span>
                          <div className="space-y-1">
                            {log.executed_rules.map((rule: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-xs p-2 bg-muted/50 rounded">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                <span>{rule.name || rule.rule || `Rule ${idx + 1}`}</span>
                                {rule.action && (
                                  <Badge variant="outline" className="text-[10px]">{rule.action}</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Response Body */}
                      {log.response_body && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">Response Body</span>
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
          )}
        </ScrollArea>

        {/* Pagination */}
        {filteredLogs.length >= pageSize && (
          <div className="flex justify-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <span className="flex items-center text-xs text-muted-foreground">
              Page {page + 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={logs.length < pageSize}
            >
              Next
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WebhookLogsViewer;
