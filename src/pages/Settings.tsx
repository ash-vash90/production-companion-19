import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Webhook, Loader2, Zap, Hash, Settings2, TestTube, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import AutomationManager from '@/components/settings/AutomationManager';
import NumberFormatSettings from '@/components/settings/NumberFormatSettings';
import { CertificateTemplateManager } from '@/components/settings/CertificateTemplateManager';

const Settings = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isAdmin, loading: profileLoading } = useUserProfile();
  const navigate = useNavigate();
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    webhookUrl: '',
    eventType: 'work_order_created' as const,
    enabled: true,
    retryAttempts: 3,
    headers: '',
  });
  
  const eventTypes = [
    { value: 'work_order_created', label: t('workOrderCreatedEvent'), description: 'Triggered when a new work order is created' },
    { value: 'work_order_completed', label: 'Work Order Completed', description: 'Triggered when all items in a work order are completed' },
    { value: 'work_order_cancelled', label: 'Work Order Cancelled', description: 'Triggered when a work order is cancelled' },
    { value: 'production_step_completed', label: t('productionStepCompletedEvent'), description: 'Triggered when a production step is completed' },
    { value: 'quality_check_passed', label: t('qualityCheckPassedEvent'), description: 'Triggered when quality check passes' },
    { value: 'quality_check_failed', label: 'Quality Check Failed', description: 'Triggered when quality check fails' },
    { value: 'item_completed', label: t('itemCompletedEvent'), description: 'Triggered when an individual item is completed' },
    { value: 'batch_completed', label: t('batchCompletedEvent'), description: 'Triggered when all items in a batch are completed' },
    { value: 'material_scanned', label: t('materialScannedEvent'), description: 'Triggered when a material batch is scanned' },
    { value: 'subassembly_linked', label: t('subAssemblyLinkedEvent'), description: 'Triggered when a subassembly is linked' },
    { value: 'certificate_generated', label: 'Certificate Generated', description: 'Triggered when a quality certificate is generated' },
  ];

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    // Redirect non-admins once we know their role
    if (!profileLoading && !isAdmin) {
      navigate('/');
      return;
    }
    
    if (isAdmin) {
      fetchWebhooks();
    }
  }, [user, navigate, isAdmin, profileLoading]);

  const fetchWebhooks = async () => {
    try {
      const { data, error } = await supabase
        .from('zapier_webhooks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWebhooks(data || []);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      toast.error(t('error'), { description: t('failedLoadWebhooks') });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('zapier_webhooks')
        .insert({
          name: formData.name,
          webhook_url: formData.webhookUrl,
          event_type: formData.eventType,
          enabled: formData.enabled,
          created_by: user.id,
        });

      if (error) throw error;

      toast.success(t('success'), { description: t('webhookCreatedSuccess') });
      setDialogOpen(false);
      setFormData({ name: '', description: '', webhookUrl: '', eventType: 'work_order_created', enabled: true, retryAttempts: 3, headers: '' });
      fetchWebhooks();
    } catch (error: any) {
      console.error('Error creating webhook:', error);
      toast.error(t('error'), { description: error.message });
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('zapier_webhooks')
        .update({ enabled })
        .eq('id', id);

      if (error) throw error;

      setWebhooks(prev => prev.map(w => w.id === id ? { ...w, enabled } : w));
      toast.success(t('success'), { description: `${t('webhookEnabled')} ${enabled ? t('enabled') : t('disabled')}` });
    } catch (error: any) {
      console.error('Error toggling webhook:', error);
      toast.error(t('error'), { description: error.message });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('zapier_webhooks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setWebhooks(prev => prev.filter(w => w.id !== id));
      toast.success(t('success'), { description: t('webhookDeleted') });
    } catch (error: any) {
      console.error('Error deleting webhook:', error);
      toast.error(t('error'), { description: error.message });
    }
  };

  const testWebhook = async (webhook: any) => {
    try {
      const response = await fetch(webhook.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: webhook.event_type,
          test: true,
          timestamp: new Date().toISOString(),
          data: { message: 'This is a test webhook from Rhosonics PMS' }
        }),
      });
      
      if (response.ok) {
        toast.success('Test successful', { description: 'Webhook endpoint responded successfully' });
      } else {
        toast.error('Test failed', { description: `Endpoint returned status ${response.status}` });
      }
    } catch (error: any) {
      toast.error('Test failed', { description: error.message });
    }
  };

  if (!user) return null;

  // Show loading while checking permissions
  if (profileLoading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  // Non-admins will be redirected by the useEffect
  if (!isAdmin) return null;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <PageHeader title={t('settingsPage')} description={t('configureWebhooks')} />

          <Tabs defaultValue="numbering" className="space-y-6">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="numbering" className="gap-2">
                <Hash className="h-4 w-4" />
                Number Formats
              </TabsTrigger>
              <TabsTrigger value="certificates" className="gap-2">
                <FileText className="h-4 w-4" />
                Certificate Templates
              </TabsTrigger>
              <TabsTrigger value="automations" className="gap-2">
                <Zap className="h-4 w-4" />
                {t('automations') || 'Automations'}
              </TabsTrigger>
              <TabsTrigger value="outgoing" className="gap-2">
                <Webhook className="h-4 w-4" />
                {t('outgoingWebhooks') || 'Outgoing Webhooks'}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="numbering">
              <NumberFormatSettings />
            </TabsContent>
            
            <TabsContent value="certificates">
              <CertificateTemplateManager />
            </TabsContent>
            
            <TabsContent value="automations">
              <AutomationManager />
            </TabsContent>
            
            <TabsContent value="outgoing">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{t('zapierWebhooks')}</CardTitle>
                      <CardDescription>
                        {t('webhooksDescription')}
                      </CardDescription>
                    </div>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="mr-2 h-4 w-4" />
                          {t('addWebhook')}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>{t('addZapierWebhook')}</DialogTitle>
                          <DialogDescription>{t('createWebhookIntegration')}</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreate} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                          <div className="space-y-2">
                            <Label htmlFor="name">{t('webhookName')} *</Label>
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              placeholder="e.g., Production Tracking"
                              required
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                              id="description"
                              value={formData.description}
                              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                              placeholder="What this webhook is used for..."
                              rows={2}
                            />
                          </div>
                          
                          <Separator />
                          
                          <div className="space-y-2">
                            <Label htmlFor="webhookUrl">{t('webhookUrl')} *</Label>
                            <Input
                              id="webhookUrl"
                              value={formData.webhookUrl}
                              onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                              placeholder="https://hooks.zapier.com/..."
                              required
                            />
                            <p className="text-xs text-muted-foreground">
                              Enter the URL that will receive the webhook POST requests
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="eventType">{t('triggerEvent')} *</Label>
                            <Select
                              value={formData.eventType}
                              onValueChange={(value: any) => setFormData({ ...formData, eventType: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {eventTypes.map(type => (
                                  <SelectItem key={type.value} value={type.value}>
                                    <div className="flex flex-col">
                                      <span>{type.label}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              {eventTypes.find(e => e.value === formData.eventType)?.description}
                            </p>
                          </div>
                          
                          <Separator />
                          
                          <div className="space-y-4">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                              <Settings2 className="h-4 w-4" />
                              Advanced Options
                            </h4>
                            
                            <div className="space-y-2">
                              <Label htmlFor="headers">Custom Headers (JSON)</Label>
                              <Textarea
                                id="headers"
                                value={formData.headers}
                                onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                                placeholder='{"Authorization": "Bearer token", "X-Custom-Header": "value"}'
                                rows={2}
                                className="font-mono text-sm"
                              />
                              <p className="text-xs text-muted-foreground">
                                Optional headers to include with webhook requests
                              </p>
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="retryAttempts">Retry Attempts</Label>
                              <Select
                                value={formData.retryAttempts.toString()}
                                onValueChange={(value) => setFormData({ ...formData, retryAttempts: parseInt(value) })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">No retries</SelectItem>
                                  <SelectItem value="1">1 retry</SelectItem>
                                  <SelectItem value="3">3 retries</SelectItem>
                                  <SelectItem value="5">5 retries</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                Number of times to retry if the webhook fails
                              </p>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label>Enable on creation</Label>
                                <p className="text-xs text-muted-foreground">
                                  Start sending events immediately
                                </p>
                              </div>
                              <Switch
                                checked={formData.enabled}
                                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                              />
                            </div>
                          </div>
                          
                          <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                              {t('cancel')}
                            </Button>
                            <Button type="submit">
                              {t('createWebhook')}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : webhooks.length === 0 ? (
                    <div className="text-center py-12">
                      <Webhook className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2">{t('noWebhooksConfigured')}</h3>
                      <p className="text-muted-foreground mb-4">{t('createFirstWebhook')}</p>
                      <Button onClick={() => setDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t('addWebhook')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {webhooks.map((webhook) => (
                        <div
                          key={webhook.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{webhook.name}</h4>
                              <Badge variant={webhook.enabled ? 'default' : 'secondary'}>
                                {webhook.enabled ? t('enabled') : t('disabled')}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-1">
                              {t('event')}: {eventTypes.find(type => type.value === webhook.event_type)?.label || webhook.event_type}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono truncate max-w-md">
                              {webhook.webhook_url}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => testWebhook(webhook)}
                              title="Test webhook"
                            >
                              <TestTube className="h-4 w-4" />
                            </Button>
                            <Switch
                              checked={webhook.enabled}
                              onCheckedChange={(checked) => handleToggle(webhook.id, checked)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(webhook.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default Settings;