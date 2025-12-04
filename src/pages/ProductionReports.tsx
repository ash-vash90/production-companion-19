import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, BarChart3, Search } from 'lucide-react';
import { format } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { getProductBreakdown, formatProductBreakdownText, ProductBreakdown } from '@/lib/utils';

interface WorkOrderWithItems {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  productBreakdown: ProductBreakdown[];
}

const ProductionReports = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrderWithItems[]>([]);
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
      const { data: workOrdersData, error } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, created_at, completed_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

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

      // Enrich with product breakdown
      const enrichedData = (workOrdersData || []).map(wo => ({
        ...wo,
        productBreakdown: getProductBreakdown(itemsMap[wo.id] || [])
      }));

      setWorkOrders(enrichedData as WorkOrderWithItems[]);
    } catch (error) {
      console.error('Error fetching work orders:', error);
      toast.error(t('error'), { description: t('failedLoadWorkOrders') });
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkOrders = workOrders.filter((wo) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = wo.wo_number.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === 'all' || wo.status === statusFilter;
    const matchesProduct = productFilter === 'all' || wo.product_type === productFilter;
    return matchesSearch && matchesStatus && matchesProduct;
  });

  const getStatusVariant = (status: string): 'info' | 'warning' | 'success' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'planned': return 'info';
      case 'in_progress': return 'warning';
      case 'completed': return 'success';
      case 'on_hold': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === 'in_progress') return t('inProgressStatus');
    if (status === 'planned') return t('planned');
    if (status === 'completed') return t('completed');
    if (status === 'on_hold') return t('onHold');
    if (status === 'cancelled') return t('cancelled');
    return status;
  };

  if (!user) return null;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <PageHeader title={t('productionReports')} description={t('viewAnalyzeProduction')} />

          <Card>
            <CardHeader>
              <CardTitle>{t('filterReports')}</CardTitle>
              <CardDescription>{t('searchFilterData')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder={t('searchWorkOrdersPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
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
                    <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
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
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredWorkOrders.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <BarChart3 className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
                <h3 className="text-xl font-semibold mb-3">
                  {t('noMatchingReports')}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  {t('tryAdjustingFilters')}
                </p>
                <Button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setProductFilter('all');
                  }}
                  variant="outline"
                >
                  {t('clearFilters')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('woNumber')}</TableHead>
                      <TableHead>{t('productType')}</TableHead>
                      <TableHead>{t('batchSize')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                      <TableHead>{t('created')}</TableHead>
                      <TableHead>{t('completed')}</TableHead>
                      <TableHead className="text-right">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWorkOrders.map((wo) => (
                      <TableRow key={wo.id}>
                        <TableCell className="font-mono font-semibold">
                          {wo.wo_number}
                        </TableCell>
                        <TableCell>
                          {wo.productBreakdown.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {wo.productBreakdown.map((b) => (
                                <Badge key={b.type} variant="outline">
                                  {b.count}× {b.label}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <Badge variant="outline">{wo.batch_size} items</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">{wo.batch_size}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(wo.status)}>
                            {getStatusLabel(wo.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(wo.created_at), 'MMM dd, yyyy', { locale: language === 'nl' ? nl : enUS })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {wo.completed_at ? format(new Date(wo.completed_at), 'MMM dd, yyyy', { locale: language === 'nl' ? nl : enUS }) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/production-reports/${wo.id}`)}
                          >
                            {t('viewReport')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default ProductionReports;
