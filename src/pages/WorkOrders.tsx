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
import { SerializationService, type ProductType } from '@/services/serializationService';

const WorkOrders = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  
  const [formData, setFormData] = useState({
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
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkOrders(data || []);
      setFilteredOrders(data || []);
    } catch (error) {
      console.error('Error fetching work orders:', error);
      toast.error(t('error'), { description: t('failedLoadWorkOrders') });
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate unique WO number
  const generateWONumber = async (): Promise<string> => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD

    // Get existing WOs for today to find next sequence number
    const { data: todayWOs } = await supabase
      .from('work_orders')
      .select('wo_number')
      .like('wo_number', `WO-${dateStr}-%`)
      .order('wo_number', { ascending: false })
      .limit(1);

    let sequence = 1;
    if (todayWOs && todayWOs.length > 0) {
      const lastWO = todayWOs[0].wo_number;
      const lastSeq = parseInt(lastWO.split('-')[2]);
      sequence = lastSeq + 1;
    }

    return `WO-${dateStr}-${String(sequence).padStart(3, '0')}`;
  };

  // Filter work orders based on search and filters
  useEffect(() => {
    let filtered = [...workOrders];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(wo =>
        wo.wo_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.product_type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(wo => wo.status === statusFilter);
    }

    // Product type filter
    if (productFilter !== 'all') {
      filtered = filtered.filter(wo => wo.product_type === productFilter);
    }

    setFilteredOrders(filtered);
  }, [searchTerm, statusFilter, productFilter, workOrders]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setCreating(true);
    try {
      // Auto-generate unique WO number
      const woNumber = await generateWONumber();

      const { data: workOrder, error: woError } = await supabase
        .from('work_orders')
        .insert({
          wo_number: woNumber,
          product_type: formData.productType,
          batch_size: formData.batchSize,
          created_by: user.id,
          status: 'planned',
        })
        .select()
        .single();

      if (woError) throw woError;

      // Generate serial numbers using centralized service (format: Q-0001, W-0001, etc.)
      const serialNumbers = await SerializationService.generateSerials(
        formData.productType as ProductType,
        formData.batchSize
      );

      const items = serialNumbers.map((serialNumber, index) => ({
        work_order_id: workOrder.id,
        serial_number: serialNumber,
        position_in_batch: index + 1,
        status: 'planned' as const,
        assigned_to: user.id,
      }));

      const { error: itemsError } = await supabase
        .from('work_order_items')
        .insert(items);

      if (itemsError) throw itemsError;

      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'create_work_order',
        entity_type: 'work_order',
        entity_id: workOrder.id,
        details: { wo_number: woNumber, product_type: formData.productType, batch_size: formData.batchSize },
      });

      // Trigger webhook for work order creation
      const { triggerWebhook } = await import('@/lib/webhooks');
      await triggerWebhook('work_order_created', {
        work_order: workOrder,
        batch_size: formData.batchSize,
        product_type: formData.productType,
      });

      toast.success(t('success'), { description: `${t('workOrderNumber')} ${woNumber} ${t('workOrderCreated')}` });
      setDialogOpen(false);
      setFormData({ productType: 'SDM_ECO', batchSize: 1 });
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
      planned: 'bg-secondary text-secondary-foreground',
      in_progress: 'bg-primary text-primary-foreground',
      completed: 'bg-accent text-accent-foreground',
      on_hold: 'bg-muted text-muted-foreground',
      cancelled: 'bg-destructive text-destructive-foreground',
    };
    return colors[status] || 'bg-muted';
  };

  if (!user) return null;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6 lg:space-y-8 p-2 md:p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight">{t('workOrders')}</h1>
              <p className="text-lg lg:text-xl text-muted-foreground">{t('manageWorkOrders')}</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="lg" className="w-full sm:w-auto h-14 text-lg px-8 min-w-[200px]">
                  <Plus className="mr-2 h-6 w-6" />
                  {t('createWorkOrder')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-3xl mb-2">{t('createWorkOrder')}</DialogTitle>
                  <DialogDescription className="text-lg leading-relaxed">
                    Work order number will be auto-generated. Batch size is set automatically based on product type.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-6 mt-4">
                  <div className="space-y-4">
                    <Label htmlFor="productType" className="text-xl font-data uppercase tracking-wider">{t('productType')}</Label>
                    <Select
                      value={formData.productType}
                      onValueChange={(value: any) => {
                        // Auto-set batch size based on product type
                        const batchSizes: Record<string, number> = {
                          'SENSOR': 20,
                          'TRANSMITTER': 10,
                          'MLA': 10,
                          'HMI': 10,
                          'SDM_ECO': 1,
                        };
                        setFormData({
                          ...formData,
                          productType: value,
                          batchSize: batchSizes[value] || 1
                        });
                      }}
                    >
                      <SelectTrigger className="h-16 text-xl border-2 font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SDM_ECO" className="h-16 text-xl py-4">SDM-ECO</SelectItem>
                        <SelectItem value="SENSOR" className="h-16 text-xl py-4">Sensor</SelectItem>
                        <SelectItem value="MLA" className="h-16 text-xl py-4">MLA</SelectItem>
                        <SelectItem value="HMI" className="h-16 text-xl py-4">HMI</SelectItem>
                        <SelectItem value="TRANSMITTER" className="h-16 text-xl py-4">Transmitter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-4">
                    <Label htmlFor="batchSize" className="text-xl font-data uppercase tracking-wider">
                      {t('batchSize')} <span className="text-sm text-muted-foreground font-normal normal-case">(auto-set, adjustable)</span>
                    </Label>
                    <Input
                      id="batchSize"
                      type="number"
                      min="1"
                      max="20"
                      value={formData.batchSize}
                      onChange={(e) => setFormData({ ...formData, batchSize: parseInt(e.target.value) })}
                      required
                      className="h-16 text-2xl font-bold text-center border-2"
                    />
                  </div>
                  <DialogFooter className="gap-4 pt-4">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} size="lg" className="flex-1 h-14 text-lg">
                      {t('cancel')}
                    </Button>
                    <Button type="submit" disabled={creating} variant="default" size="lg" className="flex-1 h-14 text-lg">
                      {creating && <Loader2 className="mr-2 h-6 w-6 animate-spin" />}
                      {t('create')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search and Filter Bar - Tablet Optimized */}
          <Card className="shadow-lg">
            <CardContent className="pt-6 pb-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="md:col-span-2">
                  <Input
                    placeholder={t('searchWorkOrders')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-14 text-lg border-2 px-4"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-14 text-lg border-2">
                    <SelectValue placeholder={t('filterByStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="h-12 text-lg">{t('allStatuses')}</SelectItem>
                    <SelectItem value="planned" className="h-12 text-lg">{t('planned')}</SelectItem>
                    <SelectItem value="in_progress" className="h-12 text-lg">{t('inProgressStatus')}</SelectItem>
                    <SelectItem value="completed" className="h-12 text-lg">{t('completed')}</SelectItem>
                    <SelectItem value="on_hold" className="h-12 text-lg">{t('onHold')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={productFilter} onValueChange={setProductFilter}>
                  <SelectTrigger className="h-14 text-lg border-2">
                    <SelectValue placeholder={t('filterByProduct')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="h-12 text-lg">{t('allProducts')}</SelectItem>
                    <SelectItem value="SDM_ECO" className="h-12 text-lg">SDM-ECO</SelectItem>
                    <SelectItem value="SENSOR" className="h-12 text-lg">Sensor</SelectItem>
                    <SelectItem value="MLA" className="h-12 text-lg">MLA</SelectItem>
                    <SelectItem value="HMI" className="h-12 text-lg">HMI</SelectItem>
                    <SelectItem value="TRANSMITTER" className="h-12 text-lg">Transmitter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
          ) : filteredOrders.length === 0 ? (
            workOrders.length === 0 ? (
            <Card className="shadow-lg">
              <CardContent className="py-20 text-center">
                <Package className="h-24 w-24 mx-auto mb-8 text-muted-foreground/50" />
                <h3 className="text-3xl font-semibold mb-4">{t('noWorkOrdersYet')}</h3>
                <p className="text-xl text-muted-foreground mb-8">{t('createFirstWorkOrder')}</p>
                <Button onClick={() => setDialogOpen(true)} variant="default" size="lg" className="h-14 text-lg px-8">
                  <Plus className="mr-2 h-6 w-6" />
                  {t('createWorkOrder')}
                </Button>
              </CardContent>
            </Card>
            ) : (
              <Card className="shadow-lg">
                <CardContent className="py-20 text-center">
                  <Filter className="h-20 w-20 mx-auto mb-8 text-muted-foreground/50" />
                  <h3 className="text-2xl font-semibold mb-4">{t('noMatchingOrders')}</h3>
                  <p className="text-lg text-muted-foreground mb-8">{t('tryDifferentFilters')}</p>
                  <Button onClick={() => { setSearchTerm(''); setStatusFilter('all'); setProductFilter('all'); }} variant="outline" size="lg" className="h-14 text-lg px-8">
                    {t('clearFilters')}
                  </Button>
                </CardContent>
              </Card>
            )
          ) : (
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredOrders.map((wo) => (
                <Card
                  key={wo.id}
                  className="cursor-pointer hover:shadow-2xl hover:border-primary transition-all border-2 active:scale-[0.98]"
                >
                  <CardHeader onClick={() => navigate(`/production/${wo.id}`)} className="pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <CardTitle className="text-2xl font-data">{wo.wo_number}</CardTitle>
                      <Badge className={`${getStatusColor(wo.status)} text-white h-10 px-5 text-base font-semibold`}>
                        {t(wo.status as any)}
                      </Badge>
                    </div>
                    <CardDescription className="text-xl font-semibold">{wo.product_type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 text-lg" onClick={() => navigate(`/production/${wo.id}`)}>
                      <div className="flex justify-between items-center p-4 rounded-lg bg-muted/50">
                        <span className="text-muted-foreground font-data">{t('batchSize')}:</span>
                        <span className="font-bold font-data text-2xl">{wo.batch_size}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 rounded-lg bg-muted/50">
                        <span className="text-muted-foreground font-data">{t('created')}:</span>
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
                        if (!confirm(`${t('cancel')} ${t('workOrderNumber').toLowerCase()} ${wo.wo_number}? ${t('cancelWorkOrderConfirm')}`)) return;
                        
                        try {
                          const { error } = await supabase
                            .from('work_orders')
                            .update({ status: 'cancelled' })
                            .eq('id', wo.id);
                          
                          if (error) throw error;
                          toast.success(t('success'), { description: t('workOrderCancelled') });
                          fetchWorkOrders();
                        } catch (error: any) {
                          toast.error(t('error'), { description: error.message });
                        }
                      }}
                    >
                      {t('deleteButton')}
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
