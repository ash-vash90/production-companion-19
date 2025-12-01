import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Webhook, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

const Settings = () => {
  const { user } = useAuth();
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
    { value: 'work_order_created', label: 'Work Order Created' },
    { value: 'production_step_completed', label: 'Production Step Completed' },
    { value: 'quality_check_passed', label: 'Quality Check Passed' },
    { value: 'item_completed', label: 'Item Completed' },
    { value: 'batch_completed', label: 'Batch Completed' },
    { value: 'material_scanned', label: 'Material Scanned' },
    { value: 'subassembly_linked', label: 'Sub-Assembly Linked' },
  ];

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchWebhooks();
  }, [user, navigate]);

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
      toast.error('Error', { description: 'Failed to load webhooks' });
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

      toast.success('Success', { description: 'Webhook created successfully' });
      setDialogOpen(false);
      setFormData({ name: '', webhookUrl: '', eventType: 'work_order_created', enabled: true });
      fetchWebhooks();
    } catch (error: any) {
      console.error('Error creating webhook:', error);
      toast.error('Error', { description: error.message });
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
      toast.success('Success', { description: `Webhook ${enabled ? 'enabled' : 'disabled'}` });
    } catch (error: any) {
      console.error('Error toggling webhook:', error);
      toast.error('Error', { description: error.message });
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
      toast.success('Success', { description: 'Webhook deleted' });
    } catch (error: any) {
      console.error('Error deleting webhook:', error);
      toast.error('Error', { description: error.message });
    }
  };

  if (!user) return null;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">Configure Zapier webhooks and integrations</p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Zapier Webhooks</CardTitle>
                  <CardDescription>
                    Configure webhooks to trigger Zapier automations on production events
                  </CardDescription>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Webhook
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Zapier Webhook</DialogTitle>
                      <DialogDescription>Create a new webhook integration</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Webhook Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g., Production Tracking"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="webhookUrl">Webhook URL *</Label>
                        <Input
                          id="webhookUrl"
                          value={formData.webhookUrl}
                          onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                          placeholder="https://hooks.zapier.com/..."
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="eventType">Trigger Event *</Label>
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
                          Cancel
                        </Button>
                        <Button type="submit">
                          Create Webhook
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
                  <h3 className="text-lg font-semibold mb-2">No webhooks configured</h3>
                  <p className="text-muted-foreground mb-4">Create your first webhook to integrate with Zapier</p>
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Webhook
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
                            {webhook.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Event: {eventTypes.find(t => t.value === webhook.event_type)?.label}
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
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default Settings;
