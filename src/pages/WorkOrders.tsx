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

  const getStatusVariant = (status: string) => {
    const variants: Record<string, 'info' | 'warning' | 'success' | 'secondary' | 'destructive'> = {
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
        <div className="space-y-6 md:space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t('workOrders')}</h1>
              <p className="text-base md:text-lg text-muted-foreground">{t('manageWorkOrders')}</p>
            </div>
            <Button variant="default" size="lg" className="w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2" />
              {t('createWorkOrder')}
            </Button>
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
                    <SelectItem value="SDM_ECO">SDM ECO</SelectItem>
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
                      <Badge variant={getStatusVariant(wo.status)}>
                        {t(wo.status as any)}
                      </Badge>
                    </div>
                    <CardDescription className="text-base md:text-sm">{formatProductType(wo.product_type)}</CardDescription>
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
