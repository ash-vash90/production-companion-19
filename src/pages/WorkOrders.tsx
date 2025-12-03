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
        <div className="space-y-6 md:space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t('workOrders')}</h1>
              <p className="text-base md:text-lg text-muted-foreground">{t('manageWorkOrders')}</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" size="lg" className="w-full sm:w-auto">
                  <Plus className="mr-2" />
                  {t('createWorkOrder')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-2xl">{t('createWorkOrder')}</DialogTitle>
                  <DialogDescription className="text-base">
                    Work order number will be auto-generated. Batch size is set automatically based on product type.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-5">
                  <div className="space-y-3">
                    <Label htmlFor="productType" className="text-base font-data uppercase tracking-wider">{t('productType')}</Label>
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
                    <Label htmlFor="batchSize" className="text-base font-data uppercase tracking-wider">
                      {t('batchSize')} <span className="text-xs text-muted-foreground font-normal">(auto-set, adjustable)</span>
                    </Label>
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
                    <Button type="submit" disabled={creating} variant="default" size="lg" className="flex-1">
                      {creating && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                      {t('create')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search and Filter Bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="md:col-span-2">
                  <Input
                    placeholder={t('searchWorkOrders')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('filterByStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allStatuses')}</SelectItem>
                    <SelectItem value="planned">{t('planned')}</SelectItem>
                    <SelectItem value="in_progress">{t('inProgressStatus')}</SelectItem>
                    <SelectItem value="completed">{t('completed')}</SelectItem>
                    <SelectItem value="on_hold">{t('onHold')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={productFilter} onValueChange={setProductFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('filterByProduct')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allProducts')}</SelectItem>
                    <SelectItem value="SDM_ECO">SDM-ECO</SelectItem>
                    <SelectItem value="SENSOR">Sensor</SelectItem>
                    <SelectItem value="MLA">MLA</SelectItem>
                    <SelectItem value="HMI">HMI</SelectItem>
                    <SelectItem value="TRANSMITTER">Transmitter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-12 w-12 md:h-10 md:w-10 animate-spin text-primary" />
            </div>
          ) : filteredOrders.length === 0 ? (
            workOrders.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Package className="h-20 w-20 md:h-16 md:w-16 mx-auto mb-6 text-muted-foreground/50" />
                <h3 className="text-2xl md:text-xl font-semibold mb-3">{t('noWorkOrdersYet')}</h3>
                <p className="text-base md:text-sm text-muted-foreground mb-6">{t('createFirstWorkOrder')}</p>
                <Button onClick={() => setDialogOpen(true)} variant="default" size="lg">
                  <Plus className="mr-2" />
                  {t('createWorkOrder')}
                </Button>
              </CardContent>
            </Card>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <Filter className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
                  <h3 className="text-xl font-semibold mb-3">{t('noMatchingOrders')}</h3>
                  <p className="text-sm text-muted-foreground mb-6">{t('tryDifferentFilters')}</p>
                  <Button onClick={() => { setSearchTerm(''); setStatusFilter('all'); setProductFilter('all'); }} variant="outline">
                    {t('clearFilters')}
                  </Button>
                </CardContent>
              </Card>
            )
          ) : (
            <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredOrders.map((wo) => (
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
