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
      
      let errorMessage = error.message;
      if (error.code === '23505') {
        errorMessage = `Work order number ${formData.woNumber} already exists. Please use a different number.`;
      }
      
      toast.error(t('error'), { description: errorMessage });
    } finally {
      setCreating(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planned: 'bg-status-planned text-white',
      in_progress: 'bg-status-in-progress text-white',
      completed: 'bg-status-completed text-white',
      on_hold: 'bg-status-on-hold text-white',
      cancelled: 'bg-status-cancelled text-white',
    };
    return colors[status] || 'bg-muted';
  };

  if (!user) return null;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6 md:space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t('workOrders')}</h1>
              <p className="text-base md:text-lg text-muted-foreground">Manage production work orders</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="rhosonics" size="lg" className="w-full sm:w-auto">
                  <Plus className="mr-2" />
                  {t('createWorkOrder')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-2xl">{t('createWorkOrder')}</DialogTitle>
                  <DialogDescription className="text-base">Create a new production work order</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-5">
                  <div className="space-y-3">
                    <Label htmlFor="woNumber" className="text-base font-data uppercase tracking-wider">{t('workOrderNumber')}</Label>
                    <Input
                      id="woNumber"
                      value={formData.woNumber}
                      onChange={(e) => setFormData({ ...formData, woNumber: e.target.value })}
                      placeholder="WO-2024-001"
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="productType" className="text-base font-data uppercase tracking-wider">{t('productType')}</Label>
                    <Select
                      value={formData.productType}
                      onValueChange={(value: any) => setFormData({ ...formData, productType: value })}
                    >
                      <SelectTrigger className="h-12 text-base border-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SDM_ECO" className="h-12 text-base">SDM-ECO</SelectItem>
                        <SelectItem value="SENSOR" className="h-12 text-base">Sensor</SelectItem>
                        <SelectItem value="MLA" className="h-12 text-base">MLA</SelectItem>
                        <SelectItem value="HMI" className="h-12 text-base">HMI</SelectItem>
                        <SelectItem value="TRANSMITTER" className="h-12 text-base">Transmitter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="batchSize" className="text-base font-data uppercase tracking-wider">{t('batchSize')}</Label>
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
                  <DialogFooter className="gap-3">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} size="lg" className="flex-1">
                      {t('cancel')}
                    </Button>
                    <Button type="submit" disabled={creating} variant="rhosonics" size="lg" className="flex-1">
                      {creating && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                      {t('create')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-12 w-12 md:h-10 md:w-10 animate-spin text-primary" />
            </div>
          ) : workOrders.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Package className="h-20 w-20 md:h-16 md:w-16 mx-auto mb-6 text-muted-foreground/50" />
                <h3 className="text-2xl md:text-xl font-semibold mb-3">No work orders yet</h3>
                <p className="text-base md:text-sm text-muted-foreground mb-6">Create your first work order to get started</p>
                <Button onClick={() => setDialogOpen(true)} variant="rhosonics" size="lg">
                  <Plus className="mr-2" />
                  {t('createWorkOrder')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {workOrders.map((wo) => (
                <Card
                  key={wo.id}
                  className="cursor-pointer hover:shadow-xl hover:border-primary transition-all"
                >
                  <CardHeader onClick={() => navigate(`/production/${wo.id}`)}>
                    <div className="flex items-center justify-between mb-2">
                      <CardTitle className="text-xl md:text-lg font-data">{wo.wo_number}</CardTitle>
                      <Badge className={`${getStatusColor(wo.status)} text-white h-8 px-4 text-sm md:h-auto md:px-3 md:text-xs`}>
                        {t(wo.status as any)}
                      </Badge>
                    </div>
                    <CardDescription className="text-base md:text-sm">{wo.product_type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-base md:text-sm" onClick={() => navigate(`/production/${wo.id}`)}>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                        <span className="text-muted-foreground font-data">{t('batchSize')}:</span>
                        <span className="font-bold font-data text-lg md:text-base">{wo.batch_size}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                        <span className="text-muted-foreground font-data">Created:</span>
                        <span className="font-medium font-data">
                          {new Date(wo.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-4"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Delete work order ${wo.wo_number}? This will also delete all associated items and cannot be undone.`)) return;
                        
                        try {
                          const { error } = await supabase
                            .from('work_orders')
                            .delete()
                            .eq('id', wo.id);
                          
                          if (error) throw error;
                          toast.success('Success', { description: 'Work order deleted' });
                          fetchWorkOrders();
                        } catch (error: any) {
                          toast.error('Error', { description: error.message });
                        }
                      }}
                    >
                      Delete
                    </Button>
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
