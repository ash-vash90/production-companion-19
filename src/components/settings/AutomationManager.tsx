import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/utils';
import { Plus, Trash2, Copy, Eye, EyeOff, Loader2, Webhook, Zap, History, RefreshCw } from 'lucide-react';

interface IncomingWebhook {
  id: string;
  name: string;
  description: string | null;
  endpoint_key: string;
  secret_key: string;
  enabled: boolean;
  trigger_count: number;
  last_triggered_at: string | null;
  created_at: string;
}

interface AutomationRule {
  id: string;
  incoming_webhook_id: string;
  name: string;
  action_type: string;
  field_mappings: any;
  enabled: boolean;
  sort_order: number;
}

interface WebhookLog {
  id: string;
  incoming_webhook_id: string;
  request_body: any;
  response_status: number | null;
  executed_rules: any;
  error_message: string | null;
  created_at: string;
}

const ACTION_TYPES = [
  { value: 'create_work_order', label: 'Create Work Order', fields: ['wo_number', 'product_type', 'batch_size', 'notes', 'scheduled_date'] },
  { value: 'update_work_order_status', label: 'Update Work Order Status', fields: ['wo_number', 'status'] },
  { value: 'update_item_status', label: 'Update Item Status', fields: ['serial_number', 'status', 'current_step'] },
  { value: 'log_activity', label: 'Log Activity', fields: ['action', 'entity_type', 'entity_id', 'details_path'] },
  { value: 'trigger_outgoing_webhook', label: 'Trigger Outgoing Webhook', fields: ['webhook_url'] },
];

const AutomationManager = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState<IncomingWebhook[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<IncomingWebhook | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  
  const [newWebhook, setNewWebhook] = useState({ name: '', description: '' });
  const [newRule, setNewRule] = useState({
    name: '',
    action_type: 'create_work_order',
    field_mappings: {} as Record<string, string>,
  });

  useEffect(() => {
    fetchWebhooks();
  }, []);

  useEffect(() => {
    if (selectedWebhook) {
      fetchRules(selectedWebhook.id);
    }
  }, [selectedWebhook]);

  const fetchWebhooks = async () => {
    try {
      const { data, error } = await supabase
        .from('incoming_webhooks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setWebhooks(data || []);
      if (data && data.length > 0 && !selectedWebhook) {
        setSelectedWebhook(data[0]);
      }
    } catch (error: any) {
      console.error('Error fetching webhooks:', error);
      toast.error('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async (webhookId: string) => {
    try {
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('incoming_webhook_id', webhookId)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      setRules(data || []);
    } catch (error: any) {
      console.error('Error fetching rules:', error);
    }
  };

  const fetchLogs = async (webhookId: string) => {
    try {
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('incoming_webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching logs:', error);
    }
  };

  const createWebhook = async () => {
    if (!user || !newWebhook.name) return;
    
    try {
      const { data, error } = await supabase
        .from('incoming_webhooks')
        .insert({
          name: newWebhook.name,
          description: newWebhook.description || null,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setWebhooks(prev => [data, ...prev]);
      setSelectedWebhook(data);
      setNewWebhook({ name: '', description: '' });
      setWebhookDialogOpen(false);
      toast.success('Webhook endpoint created');
    } catch (error: any) {
      console.error('Error creating webhook:', error);
      toast.error(error.message);
    }
  };

  const deleteWebhook = async (id: string) => {
    try {
      const { error } = await supabase
        .from('incoming_webhooks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setWebhooks(prev => prev.filter(w => w.id !== id));
      if (selectedWebhook?.id === id) {
        setSelectedWebhook(webhooks.find(w => w.id !== id) || null);
      }
      toast.success('Webhook deleted');
    } catch (error: any) {
      console.error('Error deleting webhook:', error);
      toast.error(error.message);
    }
  };

  const toggleWebhook = async (id: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('incoming_webhooks')
        .update({ enabled })
        .eq('id', id);
      
      if (error) throw error;
      
      setWebhooks(prev => prev.map(w => w.id === id ? { ...w, enabled } : w));
      if (selectedWebhook?.id === id) {
        setSelectedWebhook(prev => prev ? { ...prev, enabled } : null);
      }
    } catch (error: any) {
      console.error('Error toggling webhook:', error);
      toast.error(error.message);
    }
  };

  const createRule = async () => {
    if (!selectedWebhook || !newRule.name) return;
    
    try {
      const { data, error } = await supabase
        .from('automation_rules')
        .insert({
          incoming_webhook_id: selectedWebhook.id,
          name: newRule.name,
          action_type: newRule.action_type as any,
          field_mappings: newRule.field_mappings,
          sort_order: rules.length,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setRules(prev => [...prev, data as AutomationRule]);
      setNewRule({ name: '', action_type: 'create_work_order', field_mappings: {} });
      setRuleDialogOpen(false);
      toast.success('Automation rule created');
    } catch (error: any) {
      console.error('Error creating rule:', error);
      toast.error(error.message);
    }
  };

  const deleteRule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setRules(prev => prev.filter(r => r.id !== id));
      toast.success('Rule deleted');
    } catch (error: any) {
      console.error('Error deleting rule:', error);
      toast.error(error.message);
    }
  };

  const toggleRule = async (id: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('automation_rules')
        .update({ enabled })
        .eq('id', id);
      
      if (error) throw error;
      
      setRules(prev => prev.map(r => r.id === id ? { ...r, enabled } : r));
    } catch (error: any) {
      console.error('Error toggling rule:', error);
      toast.error(error.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getWebhookUrl = (endpointKey: string) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'eftwvgyjmeajakiafrgn';
    return `https://${projectId}.supabase.co/functions/v1/webhook-receiver/${endpointKey}`;
  };

  const selectedActionType = ACTION_TYPES.find(a => a.value === newRule.action_type);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                {t('incomingWebhooks') || 'Incoming Webhooks'}
              </CardTitle>
              <CardDescription>
                {t('incomingWebhooksDesc') || 'Create endpoints to receive data from external systems'}
              </CardDescription>
            </div>
            <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('createEndpoint') || 'Create Endpoint'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('createWebhookEndpoint') || 'Create Webhook Endpoint'}</DialogTitle>
                  <DialogDescription>
                    {t('createWebhookEndpointDesc') || 'Create a new endpoint to receive incoming webhooks'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('name') || 'Name'} *</Label>
                    <Input
                      value={newWebhook.name}
                      onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Exact ERP Integration"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('description') || 'Description'}</Label>
                    <Textarea
                      value={newWebhook.description}
                      onChange={(e) => setNewWebhook(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="What this webhook is for..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setWebhookDialogOpen(false)}>
                    {t('cancel')}
                  </Button>
                  <Button onClick={createWebhook} disabled={!newWebhook.name}>
                    {t('create')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <div className="text-center py-8">
              <Webhook className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">{t('noWebhooksYet') || 'No webhook endpoints yet'}</p>
              <Button onClick={() => setWebhookDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('createFirstEndpoint') || 'Create your first endpoint'}
              </Button>
            </div>
          ) : (
            <Tabs value={selectedWebhook?.id} onValueChange={(id) => setSelectedWebhook(webhooks.find(w => w.id === id) || null)}>
              <TabsList className="flex-wrap h-auto gap-1">
                {webhooks.map((webhook) => (
                  <TabsTrigger key={webhook.id} value={webhook.id} className="gap-2">
                    {webhook.name}
                    {!webhook.enabled && <Badge variant="secondary" className="text-xs">Disabled</Badge>}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {webhooks.map((webhook) => (
                <TabsContent key={webhook.id} value={webhook.id} className="space-y-6 mt-6">
                  {/* Webhook Details */}
                  <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{t('endpointDetails') || 'Endpoint Details'}</h4>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={webhook.enabled}
                          onCheckedChange={(checked) => toggleWebhook(webhook.id, checked)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => deleteWebhook(webhook.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('webhookUrl') || 'Webhook URL'}</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 text-sm bg-background p-2 rounded border truncate">
                            {getWebhookUrl(webhook.endpoint_key)}
                          </code>
                          <Button variant="outline" size="icon" onClick={() => copyToClipboard(getWebhookUrl(webhook.endpoint_key))}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-xs text-muted-foreground">{t('secretKey') || 'Secret Key (X-Webhook-Secret header)'}</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 text-sm bg-background p-2 rounded border font-mono">
                            {showSecrets[webhook.id] ? webhook.secret_key : '••••••••••••••••'}
                          </code>
                          <Button variant="outline" size="icon" onClick={() => setShowSecrets(prev => ({ ...prev, [webhook.id]: !prev[webhook.id] }))}>
                            {showSecrets[webhook.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhook.secret_key)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>{t('triggerCount') || 'Triggers'}: {webhook.trigger_count}</span>
                        {webhook.last_triggered_at && (
                          <span>{t('lastTriggered') || 'Last triggered'}: {formatDateTime(webhook.last_triggered_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Automation Rules */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        {t('automationRules') || 'Automation Rules'}
                      </h4>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { fetchLogs(webhook.id); setLogsDialogOpen(true); }}>
                          <History className="mr-2 h-4 w-4" />
                          {t('viewLogs') || 'View Logs'}
                        </Button>
                        <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm">
                              <Plus className="mr-2 h-4 w-4" />
                              {t('addRule') || 'Add Rule'}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>{t('createAutomationRule') || 'Create Automation Rule'}</DialogTitle>
                              <DialogDescription>
                                {t('createAutomationRuleDesc') || 'Define what happens when this webhook is triggered'}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                              <div className="space-y-2">
                                <Label>{t('ruleName') || 'Rule Name'} *</Label>
                                <Input
                                  value={newRule.name}
                                  onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                                  placeholder="e.g., Create Work Order from ERP"
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label>{t('actionType') || 'Action Type'} *</Label>
                                <Select
                                  value={newRule.action_type}
                                  onValueChange={(value) => setNewRule(prev => ({ ...prev, action_type: value, field_mappings: {} }))}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ACTION_TYPES.map(type => (
                                      <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {selectedActionType && (
                                <div className="space-y-3">
                                  <Label>{t('fieldMappings') || 'Field Mappings (JSON path syntax)'}</Label>
                                  <p className="text-xs text-muted-foreground">
                                    Use JSON path syntax like: $.data.orderNumber, $.items[0].name
                                  </p>
                                  {selectedActionType.fields.map(field => (
                                    <div key={field} className="flex items-center gap-2">
                                      <Label className="w-32 text-sm">{field}</Label>
                                      <Input
                                        value={newRule.field_mappings[field] || ''}
                                        onChange={(e) => setNewRule(prev => ({
                                          ...prev,
                                          field_mappings: { ...prev.field_mappings, [field]: e.target.value }
                                        }))}
                                        placeholder={`$.${field}`}
                                        className="font-mono text-sm"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>
                                {t('cancel')}
                              </Button>
                              <Button onClick={createRule} disabled={!newRule.name}>
                                {t('create')}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                    
                    {rules.length === 0 ? (
                      <div className="text-center py-6 border rounded-lg border-dashed">
                        <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {t('noRulesYet') || 'No automation rules yet. Add a rule to process incoming data.'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {rules.map((rule) => (
                          <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{rule.name}</span>
                                <Badge variant="outline">
                                  {ACTION_TYPES.find(a => a.value === rule.action_type)?.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 font-mono">
                                {Object.entries(rule.field_mappings).map(([k, v]) => `${k}: ${v}`).join(', ')}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={rule.enabled}
                                onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                              />
                              <Button variant="ghost" size="icon" onClick={() => deleteRule(rule.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
      
      {/* Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t('webhookLogs') || 'Webhook Logs'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No logs yet</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {formatDateTime(log.created_at)}
                    </span>
                    <Badge variant={log.response_status === 200 ? 'default' : log.response_status === 207 ? 'secondary' : 'destructive'}>
                      {log.response_status}
                    </Badge>
                  </div>
                  {log.error_message && (
                    <p className="text-sm text-destructive">{log.error_message}</p>
                  )}
                  {log.executed_rules && log.executed_rules.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Executed: {log.executed_rules.map((r: any) => r.rule).join(', ')}
                    </div>
                  )}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">View payload</summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                      {JSON.stringify(log.request_body, null, 2)}
                    </pre>
                  </details>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AutomationManager;
