import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/utils';
import { Plus, Trash2, Copy, Eye, EyeOff, Loader2, Webhook, Zap, History, ChevronRight, Code, Settings2, AlertCircle } from 'lucide-react';

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
  conditions: any;
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

// Natural field name mappings - use readable names that map to database columns
const ACTION_TYPES = [
  { 
    value: 'create_work_order', 
    label: 'Create Work Order', 
    description: 'Create a new work order with the specified details',
    fields: [
      { key: 'workOrderNumber', dbKey: 'wo_number', label: 'Work Order Number', required: false, placeholder: 'order.number', hint: 'Leave empty for auto-generation' },
      { key: 'productType', dbKey: 'product_type', label: 'Product Type', required: true, placeholder: 'order.productType', hint: 'Values: SDM_ECO, SENSOR, MLA, HMI, TRANSMITTER' },
      { key: 'quantity', dbKey: 'batch_size', label: 'Quantity', required: true, placeholder: 'order.quantity', hint: 'Number of items to create' },
      { key: 'customer', dbKey: 'customer_name', label: 'Customer Name', required: false, placeholder: 'order.customerName', hint: 'Optional customer reference' },
      { key: 'externalReference', dbKey: 'external_order_number', label: 'External Reference', required: false, placeholder: 'order.externalId', hint: 'Reference from external system' },
      { key: 'startDate', dbKey: 'start_date', label: 'Start Date', required: false, placeholder: 'order.startDate', hint: 'Format: YYYY-MM-DD' },
      { key: 'shippingDate', dbKey: 'shipping_date', label: 'Shipping Date', required: false, placeholder: 'order.shippingDate', hint: 'Format: YYYY-MM-DD' },
      { key: 'notes', dbKey: 'notes', label: 'Notes', required: false, placeholder: 'order.notes', hint: 'Additional information' },
    ]
  },
  { 
    value: 'update_work_order_status', 
    label: 'Update Work Order Status',
    description: 'Change the status of an existing work order',
    fields: [
      { key: 'workOrderNumber', dbKey: 'wo_number', label: 'Work Order Number', required: true, placeholder: 'order.number', hint: 'The work order to update' },
      { key: 'status', dbKey: 'status', label: 'New Status', required: true, placeholder: 'order.status', hint: 'Values: planned, in_progress, on_hold, completed, cancelled' },
    ]
  },
  { 
    value: 'update_item_status', 
    label: 'Update Item Status',
    description: 'Update the status of a specific work order item by serial number',
    fields: [
      { key: 'serialNumber', dbKey: 'serial_number', label: 'Serial Number', required: true, placeholder: 'item.serialNumber', hint: 'The item to update' },
      { key: 'status', dbKey: 'status', label: 'New Status', required: true, placeholder: 'item.status', hint: 'Values: planned, in_progress, on_hold, completed, cancelled' },
      { key: 'currentStep', dbKey: 'current_step', label: 'Current Step', required: false, placeholder: 'item.stepNumber', hint: 'Optional step number override' },
    ]
  },
  { 
    value: 'log_activity', 
    label: 'Log Activity',
    description: 'Create an activity log entry for audit purposes',
    fields: [
      { key: 'action', dbKey: 'action', label: 'Action Name', required: true, placeholder: 'event.action', hint: 'e.g., "external_sync", "status_change"' },
      { key: 'entityType', dbKey: 'entity_type', label: 'Entity Type', required: true, placeholder: 'event.entityType', hint: 'e.g., "work_order", "item"' },
      { key: 'entityId', dbKey: 'entity_id', label: 'Entity ID', required: false, placeholder: 'event.entityId', hint: 'UUID of related entity' },
      { key: 'details', dbKey: 'details_path', label: 'Details Path', required: false, placeholder: 'event.data', hint: 'JSON path to additional details' },
    ]
  },
  { 
    value: 'trigger_outgoing_webhook', 
    label: 'Forward to Webhook',
    description: 'Forward the incoming data to another webhook endpoint',
    fields: [
      { key: 'webhookUrl', dbKey: 'webhook_url', label: 'Destination URL', required: true, placeholder: 'https://example.com/webhook', hint: 'The URL to forward data to' },
    ]
  },
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
    conditions: {
      enabled: false,
      field: '',
      operator: 'equals',
      value: '',
    },
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
      const conditions = newRule.conditions.enabled ? {
        field: newRule.conditions.field,
        operator: newRule.conditions.operator,
        value: newRule.conditions.value,
      } : null;
      
      const { data, error } = await supabase
        .from('automation_rules')
        .insert({
          incoming_webhook_id: selectedWebhook.id,
          name: newRule.name,
          action_type: newRule.action_type as any,
          field_mappings: newRule.field_mappings,
          conditions,
          sort_order: rules.length,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setRules(prev => [...prev, data as AutomationRule]);
      setNewRule({ 
        name: '', 
        action_type: 'create_work_order', 
        field_mappings: {},
        conditions: { enabled: false, field: '', operator: 'equals', value: '' }
      });
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
    <div className="space-y-4 sm:space-y-6">
      {/* Webhooks List */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Webhook className="h-5 w-5 shrink-0" />
                {t('incomingWebhooks') || 'Incoming Webhooks'}
              </CardTitle>
              <CardDescription className="text-sm">
                {t('incomingWebhooksDesc') || 'Receive data from external systems'}
              </CardDescription>
            </div>
            <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('createEndpoint') || 'Create'}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>{t('createWebhookEndpoint') || 'Create Webhook Endpoint'}</DialogTitle>
                  <DialogDescription>
                    {t('createWebhookEndpointDesc') || 'Create a new endpoint to receive incoming webhooks'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
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
                      placeholder="What this webhook is used for..."
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter className="flex-col gap-2 sm:flex-row">
                  <Button variant="outline" onClick={() => setWebhookDialogOpen(false)} className="w-full sm:w-auto">
                    {t('cancel')}
                  </Button>
                  <Button onClick={createWebhook} disabled={!newWebhook.name} className="w-full sm:w-auto">
                    {t('create')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <div className="text-center py-8 border rounded-lg border-dashed">
              <Webhook className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-medium mb-1">{t('noWebhooksYet') || 'No webhook endpoints yet'}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first endpoint to start receiving data
              </p>
              <Button size="sm" onClick={() => setWebhookDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('createFirstEndpoint') || 'Create Endpoint'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  onClick={() => setSelectedWebhook(webhook)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedWebhook?.id === webhook.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{webhook.name}</span>
                      {!webhook.enabled && (
                        <Badge variant="secondary" className="text-xs">Disabled</Badge>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{webhook.trigger_count} triggers</span>
                    {webhook.last_triggered_at && (
                      <span>Last: {formatDateTime(webhook.last_triggered_at)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Webhook Details */}
      {selectedWebhook && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg truncate">{selectedWebhook.name}</CardTitle>
                {selectedWebhook.description && (
                  <CardDescription className="mt-1 line-clamp-2">{selectedWebhook.description}</CardDescription>
                )}
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Switch
                  checked={selectedWebhook.enabled}
                  onCheckedChange={(checked) => toggleWebhook(selectedWebhook.id, checked)}
                />
                <Button variant="ghost" size="icon" onClick={() => deleteWebhook(selectedWebhook.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            {/* Endpoint URL */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Webhook URL</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[10px] sm:text-xs bg-muted p-2 rounded border truncate font-mono overflow-x-auto">
                  {getWebhookUrl(selectedWebhook.endpoint_key)}
                </code>
                <Button variant="outline" size="icon" className="shrink-0 h-8 w-8" onClick={() => copyToClipboard(getWebhookUrl(selectedWebhook.endpoint_key))}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Secret Key */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Secret Key (X-Webhook-Secret)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[10px] sm:text-xs bg-muted p-2 rounded border font-mono truncate">
                  {showSecrets[selectedWebhook.id] ? selectedWebhook.secret_key : '••••••••••••••••'}
                </code>
                <Button variant="outline" size="icon" className="shrink-0 h-8 w-8" onClick={() => setShowSecrets(prev => ({ ...prev, [selectedWebhook.id]: !prev[selectedWebhook.id] }))}>
                  {showSecrets[selectedWebhook.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="outline" size="icon" className="shrink-0 h-8 w-8" onClick={() => copyToClipboard(selectedWebhook.secret_key)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <Separator />

            {/* Automation Rules */}
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="font-medium flex items-center gap-2 text-sm sm:text-base">
                    <Zap className="h-4 w-4 shrink-0" />
                    Automation Rules
                  </h4>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Define actions when this webhook receives data
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 sm:flex-none h-8 text-xs sm:text-sm" onClick={() => { fetchLogs(selectedWebhook.id); setLogsDialogOpen(true); }}>
                    <History className="mr-1.5 h-3.5 w-3.5" />
                    Logs
                  </Button>
                  <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="flex-1 sm:flex-none h-8 text-xs sm:text-sm">
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Add Rule
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl w-[calc(100%-2rem)] max-h-[90vh]">
                      <DialogHeader>
                        <DialogTitle>Create Automation Rule</DialogTitle>
                        <DialogDescription>
                          Define what happens when this webhook is triggered
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="max-h-[60vh] pr-4">
                        <div className="space-y-6 py-4">
                          {/* Rule Name */}
                          <div className="space-y-2">
                            <Label>Rule Name *</Label>
                            <Input
                              value={newRule.name}
                              onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="e.g., Create Work Order from Exact"
                            />
                          </div>

                          <Separator />

                          {/* Action Type */}
                          <div className="space-y-2">
                            <Label>Action Type *</Label>
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
                            {selectedActionType && (
                              <p className="text-xs text-muted-foreground">
                                {selectedActionType.description}
                              </p>
                            )}
                          </div>

                          <Separator />

                          {/* Field Mappings */}
                          {selectedActionType && (
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <Code className="h-4 w-4" />
                                <Label>Field Mappings</Label>
                              </div>
                              <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-2">
                                <p className="font-medium">Map incoming JSON fields using dot notation:</p>
                                <code className="block bg-background p-2 rounded">order.productType → looks for {"{"}"order": {"{"}"productType": "value"{"}"}{"}"}</code>
                                <code className="block bg-background p-2 rounded">items[0].name → looks for {"{"}"items": [{"{"}"name": "value"{"}"}]{"}"}</code>
                              </div>
                              <div className="space-y-3">
                                {selectedActionType.fields.map(field => (
                                  <div key={field.key} className="space-y-1">
                                    <Label className="text-sm">
                                      {field.label}
                                      {field.required && <span className="text-destructive ml-1">*</span>}
                                    </Label>
                                    <Input
                                      value={newRule.field_mappings[field.key] || ''}
                                      onChange={(e) => setNewRule(prev => ({
                                        ...prev,
                                        field_mappings: { ...prev.field_mappings, [field.key]: e.target.value }
                                      }))}
                                      placeholder={field.placeholder}
                                      className="font-mono text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">{field.hint}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <Separator />

                          {/* Conditions */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Settings2 className="h-4 w-4" />
                                <Label>Conditional Execution</Label>
                              </div>
                              <Switch
                                checked={newRule.conditions.enabled}
                                onCheckedChange={(checked) => setNewRule(prev => ({
                                  ...prev,
                                  conditions: { ...prev.conditions, enabled: checked }
                                }))}
                              />
                            </div>
                            
                            {newRule.conditions.enabled && (
                              <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Field Path</Label>
                                  <Input
                                    value={newRule.conditions.field}
                                    onChange={(e) => setNewRule(prev => ({
                                      ...prev,
                                      conditions: { ...prev.conditions, field: e.target.value }
                                    }))}
                                    placeholder="$.data.type"
                                    className="font-mono text-sm"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Operator</Label>
                                    <Select
                                      value={newRule.conditions.operator}
                                      onValueChange={(value) => setNewRule(prev => ({
                                        ...prev,
                                        conditions: { ...prev.conditions, operator: value }
                                      }))}
                                    >
                                      <SelectTrigger className="text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="equals">Equals</SelectItem>
                                        <SelectItem value="not_equals">Not Equals</SelectItem>
                                        <SelectItem value="contains">Contains</SelectItem>
                                        <SelectItem value="exists">Exists</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Value</Label>
                                    <Input
                                      value={newRule.conditions.value}
                                      onChange={(e) => setNewRule(prev => ({
                                        ...prev,
                                        conditions: { ...prev.conditions, value: e.target.value }
                                      }))}
                                      placeholder="work_order"
                                      disabled={['exists', 'not_exists'].includes(newRule.conditions.operator)}
                                      className="text-sm"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </ScrollArea>
                      <DialogFooter className="flex-col gap-2 pt-4 sm:flex-row">
                        <Button variant="outline" onClick={() => setRuleDialogOpen(false)} className="w-full sm:w-auto">
                          {t('cancel')}
                        </Button>
                        <Button onClick={createRule} disabled={!newRule.name} className="w-full sm:w-auto">
                          Create Rule
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {rules.length === 0 ? (
                <div className="text-center py-6 border rounded-lg border-dashed">
                  <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="font-medium mb-1 text-sm">No automation rules yet</p>
                  <p className="text-xs text-muted-foreground">
                    Add a rule to define what happens when data is received
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-sm">{rule.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {ACTION_TYPES.find(a => a.value === rule.action_type)?.label}
                          </Badge>
                          {rule.conditions && (
                            <Badge variant="secondary" className="text-xs">Conditional</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {Object.entries(rule.field_mappings)
                            .filter(([_, v]) => v)
                            .slice(0, 2)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' | ') || 'No mappings'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteRule(rule.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-2xl w-[calc(100%-2rem)] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 shrink-0" />
              <span className="truncate">Webhook Logs</span>
            </DialogTitle>
            <DialogDescription className="truncate">
              Recent executions for {selectedWebhook?.name}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No logs yet
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="p-3 border rounded-lg text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(log.created_at)}
                      </span>
                      <Badge 
                        variant={log.error_message ? 'destructive' : log.response_status === 200 ? 'success' : 'secondary'}
                        className="text-xs"
                      >
                        {log.error_message ? 'Error' : `${log.response_status || 200}`}
                      </Badge>
                    </div>
                    {log.error_message && (
                      <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded text-destructive text-xs">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{log.error_message}</span>
                      </div>
                    )}
                    {log.executed_rules && Array.isArray(log.executed_rules) && log.executed_rules.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Executed: {log.executed_rules.map((r: any) => r.name || r).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AutomationManager;