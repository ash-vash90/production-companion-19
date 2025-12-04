import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateWorkOrderDialog } from '@/components/CreateWorkOrderDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getProductBreakdown, formatProductBreakdownText, ProductBreakdown, formatDate } from '@/lib/utils';
import { Loader2, Plus, Package, Filter } from 'lucide-react';

interface WorkOrderWithItems {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  created_at: string;
  profiles: { full_name: string } | null;
  productBreakdown: ProductBreakdown[];
}

const WorkOrders = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isAdmin } = useUserProfile();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrderWithItems[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<WorkOrderWithItems[]>([]);
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
      // Fetch work orders
      const { data: workOrdersData, error: woError } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, created_at, created_by')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (woError) throw woError;

      const woIds = workOrdersData?.map(wo => wo.id) || [];
      
      // Fetch items for all work orders to get product breakdown
      let itemsMap: Record<string, Array<{ serial_number: string }>> = {};
      if (woIds.length > 0) {
        const { data: itemsData } = await supabase
          .from('work_order_items')
          .select('work_order_id, serial_number')
          .in('work_order_id', woIds);
        
        for (const item of itemsData || []) {
          if (!itemsMap[item.work_order_id]) {
            itemsMap[item.work_order_id] = [];
          }
          itemsMap[item.work_order_id].push({ serial_number: item.serial_number });
        }
      }

      // Fetch profiles for creators
      const creatorIds = [...new Set(workOrdersData?.map(wo => wo.created_by).filter(Boolean) || [])];
      let profilesMap: Record<string, string> = {};
      
      if (creatorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', creatorIds);
        
        profilesMap = (profilesData || []).reduce((acc, p) => {
          acc[p.id] = p.full_name;
          return acc;
        }, {} as Record<string, string>);
      }

      // Merge data with product breakdown
      const enrichedData = (workOrdersData || []).map(wo => ({
        ...wo,
        profiles: wo.created_by && profilesMap[wo.created_by] 
          ? { full_name: profilesMap[wo.created_by] } 
          : null,
        productBreakdown: getProductBreakdown(itemsMap[wo.id] || [])
      }));

      setWorkOrders(enrichedData as WorkOrderWithItems[]);
      setFilteredOrders(enrichedData as WorkOrderWithItems[]);
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
        <div className="space-y-4">
          <PageHeader
            title={t('workOrders')}
            description={t('manageWorkOrders')}
            actions={
              <Button 
                variant="default" 
                size="default" 
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('createWorkOrder')}
              </Button>
            }
          />

          {/* Search and Filter Bar */}
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <Input
                    placeholder={t('searchWorkOrders')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-10 md:h-12 text-sm md:text-base border px-3"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 md:h-12 text-sm md:text-base">
                    <SelectValue placeholder={t('filterByStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="h-9 md:h-10 text-sm md:text-base">{t('allStatuses')}</SelectItem>
                    <SelectItem value="planned" className="h-9 md:h-10 text-sm md:text-base">{t('planned')}</SelectItem>
                    <SelectItem value="in_progress" className="h-9 md:h-10 text-sm md:text-base">{t('inProgressStatus')}</SelectItem>
                    <SelectItem value="completed" className="h-9 md:h-10 text-sm md:text-base">{t('completed')}</SelectItem>
                    <SelectItem value="on_hold" className="h-9 md:h-10 text-sm md:text-base">{t('onHold')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={productFilter} onValueChange={setProductFilter}>
                  <SelectTrigger className="h-10 md:h-12 text-sm md:text-base">
                    <SelectValue placeholder={t('filterByProduct')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="h-9 md:h-10 text-sm md:text-base">{t('allProducts')}</SelectItem>
                    <SelectItem value="SDM_ECO" className="h-9 md:h-10 text-sm md:text-base">SDM ECO</SelectItem>
                    <SelectItem value="SENSOR" className="h-9 md:h-10 text-sm md:text-base">Sensor</SelectItem>
                    <SelectItem value="MLA" className="h-9 md:h-10 text-sm md:text-base">MLA</SelectItem>
                    <SelectItem value="HMI" className="h-9 md:h-10 text-sm md:text-base">HMI</SelectItem>
                    <SelectItem value="TRANSMITTER" className="h-9 md:h-10 text-sm md:text-base">Transmitter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-10 w-10 md:h-12 md:w-12 animate-spin text-primary" />
            </div>
          ) : filteredOrders.length === 0 ? (
            workOrders.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="py-12 md:py-16 text-center">
                <Package className="h-16 w-16 md:h-20 md:w-20 mx-auto mb-6 text-muted-foreground/50" />
                <h3 className="text-xl md:text-2xl font-semibold mb-3">{t('noWorkOrdersYet')}</h3>
                <p className="text-sm md:text-base text-muted-foreground mb-6">{t('createFirstWorkOrder')}</p>
                <Button onClick={() => setDialogOpen(true)} variant="default" size="default" className="h-10 md:h-12 text-sm md:text-base px-6">
                  <Plus className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                  {t('createWorkOrder')}
                </Button>
              </CardContent>
            </Card>
            ) : (
              <Card className="shadow-sm">
                <CardContent className="py-12 md:py-16 text-center">
                  <Filter className="h-14 w-14 md:h-16 md:w-16 mx-auto mb-6 text-muted-foreground/50" />
                  <h3 className="text-lg md:text-xl font-semibold mb-3">{t('noMatchingOrders')}</h3>
                  <p className="text-sm md:text-base text-muted-foreground mb-6">{t('tryDifferentFilters')}</p>
                  <Button onClick={() => { setSearchTerm(''); setStatusFilter('all'); setProductFilter('all'); }} variant="outline" size="default" className="h-10 md:h-12 text-sm md:text-base px-6">
                    {t('clearFilters')}
                  </Button>
                </CardContent>
              </Card>
            )
          ) : (
            <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredOrders.map((wo) => (
                <Card
                  key={wo.id}
                  className="cursor-pointer hover:shadow-md hover:border-primary transition-all border active:scale-[0.99] flex flex-col"
                >
                  <CardHeader onClick={() => navigate(`/production/${wo.id}`)} className="pb-1.5 p-2 lg:p-3">
                    <div className="flex items-center justify-between mb-1">
                      <CardTitle className="text-xs lg:text-sm font-data truncate">{wo.wo_number}</CardTitle>
                      <Badge variant={getStatusVariant(wo.status)} className="h-4 lg:h-5 px-1.5 text-[10px] lg:text-xs font-medium shrink-0 ml-2">
                        {t(wo.status as any)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-0.5 lg:gap-1">
                      {wo.productBreakdown.length > 0 
                        ? wo.productBreakdown.map((item, idx) => (
                            <Badge key={idx} variant="secondary" className="text-[10px] lg:text-xs font-medium h-4 lg:h-5 px-1.5">
                              {item.count}× {item.label}
                            </Badge>
                          ))
                        : <span className="text-[10px] lg:text-xs text-muted-foreground">{wo.batch_size} items</span>
                      }
                    </div>
                  </CardHeader>
                  <CardContent className="p-2 lg:p-3 pt-0 flex-1 flex flex-col">
                    <div className="space-y-1 text-[10px] lg:text-xs flex-1" onClick={() => navigate(`/production/${wo.id}`)}>
                      <div className="flex justify-between items-center p-1 lg:p-1.5 rounded bg-muted/50">
                        <span className="text-muted-foreground">{t('batchSize')}:</span>
                        <span className="font-semibold">{wo.batch_size}</span>
                      </div>
                      <div className="flex justify-between items-center p-1 lg:p-1.5 rounded bg-muted/50">
                        <span className="text-muted-foreground">{t('created')}:</span>
                        <span className="font-medium">
                          {formatDate(wo.created_at)}
                        </span>
                      </div>
                      {wo.profiles?.full_name && (
                        <div className="flex justify-between items-center p-1 lg:p-1.5 rounded bg-muted/50">
                          <span className="text-muted-foreground">{t('createdBy')}:</span>
                          <span className="font-medium truncate ml-2 max-w-[80px] lg:max-w-[100px]">{wo.profiles.full_name}</span>
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full mt-1.5 h-6 lg:h-7 text-[10px] lg:text-xs"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(t('confirmCancelWorkOrder'))) {
                            try {
                              const { error } = await supabase
                                .from('work_orders')
                                .update({ status: 'cancelled' })
                                .eq('id', wo.id);
                              if (error) throw error;
                              
                              // Don't create notification for own cancellation - user already knows
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
                    )}
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