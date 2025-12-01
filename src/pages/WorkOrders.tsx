import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, Package, Filter } from 'lucide-react';

const WorkOrders = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const [formData, setFormData] = useState({
    woNumber: '',
    productType: 'SDM_ECO' as const,
    batchSize: 1,
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchWorkOrders();
  }, [user, navigate]);

  const fetchWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error) {
      console.error('Error fetching work orders:', error);
      toast.error(t('error'), { description: 'Failed to load work orders' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setCreating(true);
    try {
      const { data: workOrder, error: woError } = await supabase
        .from('work_orders')
        .insert({
          wo_number: formData.woNumber,
          product_type: formData.productType,
          batch_size: formData.batchSize,
          created_by: user.id,
          status: 'planned',
        })
        .select()
        .single();

      if (woError) throw woError;

      // Create work order items with serial numbers
      const items = [];
      for (let i = 1; i <= formData.batchSize; i++) {
        const serialNumber = `${formData.productType}-${formData.woNumber}-${String(i).padStart(3, '0')}`;
        items.push({
          work_order_id: workOrder.id,
          serial_number: serialNumber,
          position_in_batch: i,
          status: 'planned',
        });
      }

      const { error: itemsError } = await supabase
        .from('work_order_items')
        .insert(items);

      if (itemsError) throw itemsError;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'create_work_order',
        entity_type: 'work_order',
        entity_id: workOrder.id,
        details: { wo_number: formData.woNumber, product_type: formData.productType, batch_size: formData.batchSize },
      });

      toast.success(t('success'), { description: `Work order ${formData.woNumber} created successfully` });
      setDialogOpen(false);
      setFormData({ woNumber: '', productType: 'SDM_ECO', batchSize: 1 });
      fetchWorkOrders();
    } catch (error: any) {
      console.error('Error creating work order:', error);
      toast.error(t('error'), { description: error.message });
    } finally {
      setCreating(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planned: 'bg-status-planned',
      in_progress: 'bg-status-in-progress',
      completed: 'bg-status-completed',
      on_hold: 'bg-status-on-hold',
      cancelled: 'bg-status-cancelled',
    };
    return colors[status] || 'bg-muted';
  };

  if (!user) return null;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('workOrders')}</h1>
              <p className="text-muted-foreground">Manage production work orders</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('createWorkOrder')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('createWorkOrder')}</DialogTitle>
                  <DialogDescription>Create a new production work order</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="woNumber">{t('workOrderNumber')}</Label>
                    <Input
                      id="woNumber"
                      value={formData.woNumber}
                      onChange={(e) => setFormData({ ...formData, woNumber: e.target.value })}
                      placeholder="WO-2024-001"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productType">{t('productType')}</Label>
                    <Select
                      value={formData.productType}
                      onValueChange={(value: any) => setFormData({ ...formData, productType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SDM_ECO">SDM-ECO</SelectItem>
                        <SelectItem value="SENSOR">Sensor</SelectItem>
                        <SelectItem value="MLA">MLA</SelectItem>
                        <SelectItem value="HMI">HMI</SelectItem>
                        <SelectItem value="TRANSMITTER">Transmitter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batchSize">{t('batchSize')}</Label>
                    <Input
                      id="batchSize"
                      type="number"
                      min="1"
                      max="20"
                      value={formData.batchSize}
                      onChange={(e) => setFormData({ ...formData, batchSize: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      {t('cancel')}
                    </Button>
                    <Button type="submit" disabled={creating}>
                      {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('create')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : workOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No work orders yet</h3>
                <p className="text-muted-foreground mb-4">Create your first work order to get started</p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('createWorkOrder')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workOrders.map((wo) => (
                <Card
                  key={wo.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/production/${wo.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{wo.wo_number}</CardTitle>
                      <Badge className={`${getStatusColor(wo.status)} text-white`}>
                        {t(wo.status as any)}
                      </Badge>
                    </div>
                    <CardDescription>{wo.product_type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('batchSize')}:</span>
                        <span className="font-medium">{wo.batch_size}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created:</span>
                        <span className="font-medium">
                          {new Date(wo.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default WorkOrders;
