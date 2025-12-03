import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateWorkOrderDialog } from '@/components/CreateWorkOrderDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatProductType } from '@/lib/utils';
import { Loader2, Plus, Package, Filter } from 'lucide-react';

interface WorkOrderWithProfile {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  created_at: string;
  profiles: { full_name: string } | null;
}

const WorkOrders = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrderWithProfile[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<WorkOrderWithProfile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');

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
        .select('id, wo_number, product_type, batch_size, status, created_at, profiles:created_by(full_name)')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkOrders((data as any) || []);
      setFilteredOrders((data as any) || []);
    } catch (error) {
      console.error('Error fetching work orders:', error);
      toast.error(t('error'), { description: t('failedLoadWorkOrders') });
    } finally {
      setLoading(false);
    }
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

  const getStatusVariant = (status: string): 'success' | 'warning' | 'info' | 'secondary' | 'destructive' => {
    const variants: Record<string, 'success' | 'warning' | 'info' | 'secondary' | 'destructive'> = {
      planned: 'info',
      in_progress: 'warning',
      completed: 'success',
      on_hold: 'secondary',
      cancelled: 'destructive',
    };
    return variants[status] || 'secondary';
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
            <Button 
              variant="default" 
              size="lg" 
              className="w-full sm:w-auto h-14 text-lg px-8 min-w-[200px]"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="mr-2 h-6 w-6" />
              {t('createWorkOrder')}
            </Button>
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
                    <SelectItem value="SDM_ECO" className="h-12 text-lg">SDM ECO</SelectItem>
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
                      <Badge variant={getStatusVariant(wo.status)} className="h-10 px-5 text-base font-semibold">
                        {t(wo.status as any)}
                      </Badge>
                    </div>
                    <CardDescription className="text-xl font-semibold">{formatProductType(wo.product_type)}</CardDescription>
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
                      {wo.profiles?.full_name && (
                        <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                          <span className="text-muted-foreground font-data">{t('createdBy')}:</span>
                          <span className="font-medium">
                            {wo.profiles.full_name}
                          </span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-4"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(t('confirmCancelWorkOrder'))) {
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
                        }
                      }}
                    >
                      {t('cancelWorkOrder')}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <CreateWorkOrderDialog 
          open={dialogOpen} 
          onOpenChange={setDialogOpen} 
          onSuccess={fetchWorkOrders}
        />
      </Layout>
    </ProtectedRoute>
  );
};

export default WorkOrders;