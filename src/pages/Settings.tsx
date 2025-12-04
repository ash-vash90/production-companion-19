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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Webhook, Loader2, Zap, Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import AutomationManager from '@/components/settings/AutomationManager';
import NumberFormatSettings from '@/components/settings/NumberFormatSettings';

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
    webhookUrl: '',
    eventType: 'work_order_created' as const,
    enabled: true,
  });
  
  const eventTypes = [
    { value: 'work_order_created', label: t('workOrderCreatedEvent') },
    { value: 'production_step_completed', label: t('productionStepCompletedEvent') },
    { value: 'quality_check_passed', label: t('qualityCheckPassedEvent') },
    { value: 'item_completed', label: t('itemCompletedEvent') },
    { value: 'batch_completed', label: t('batchCompletedEvent') },
    { value: 'material_scanned', label: t('materialScannedEvent') },
    { value: 'subassembly_linked', label: t('subAssemblyLinkedEvent') },
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
      setFormData({ name: '', webhookUrl: '', eventType: 'work_order_created', enabled: true });
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
            <TabsList>
              <TabsTrigger value="numbering" className="gap-2">
                <Hash className="h-4 w-4" />
                Number Formats
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
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t('addZapierWebhook')}</DialogTitle>
                          <DialogDescription>{t('createWebhookIntegration')}</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreate} className="space-y-4">
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
                            <Label htmlFor="webhookUrl">{t('webhookUrl')} *</Label>
                            <Input
                              id="webhookUrl"
                              value={formData.webhookUrl}
                              onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                              placeholder="https://hooks.zapier.com/..."
                              required
                            />
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
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <DialogFooter>
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
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{webhook.name}</h4>
                              <Badge variant={webhook.enabled ? 'default' : 'secondary'}>
                                {webhook.enabled ? t('enabled') : t('disabled')}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-1">
                              {t('event')}: {eventTypes.find(type => type.value === webhook.event_type)?.label}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono truncate max-w-md">
                              {webhook.webhook_url}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
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