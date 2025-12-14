import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Package, Printer, FileText, CalendarIcon, DollarSign, User, FileTextIcon, Link2, CheckCircle2 } from 'lucide-react';
import { generateQualityCertificate } from '@/services/certificateService';
import { format, differenceInDays, parseISO, isBefore } from 'date-fns';
import { printWorkOrderLabel } from '@/lib/labelPrinter';
import { formatStatus, formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const Production = () => {
  const { itemId } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workOrder, setWorkOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [linkedCounts, setLinkedCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (itemId) {
      fetchProductionData();
    }
  }, [user, itemId, navigate]);

  const fetchProductionData = async () => {
    try {
      const { data: woData, error: woError } = await supabase
        .from('work_orders')
        .select('*')
        .eq('id', itemId)
        .single();

      if (woError) throw woError;
      
      // Block access to cancelled work orders
      if (woData.status === 'cancelled') {
        toast.error(t('error'), { description: t('workOrderCancelledAccess') });
        navigate('/work-orders');
        return;
      }
      
      setWorkOrder(woData);

      const { data: itemsData, error: itemsError } = await supabase
        .from('work_order_items')
        .select('*')
        .eq('work_order_id', itemId)
        .order('position_in_batch', { ascending: true });

      if (itemsError) throw itemsError;
      setItems(itemsData || []);
    } catch (error) {
      console.error('Error fetching production data:', error);
      toast.error(t('error'), { description: t('failedLoadProduction') });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintLabel = async (serialNumber: string, operatorInitials?: string, itemProductType?: string) => {
    await printWorkOrderLabel({
      serialNumber,
      operatorInitials,
      productType: itemProductType || workOrder?.product_type,
      workOrderNumber: workOrder?.wo_number,
      userId: user?.id,
    });
  };

  const handleStartProduction = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('work_order_items')
        .update({ status: 'in_progress', assigned_to: user?.id })
        .eq('id', itemId);

      if (error) throw error;

      toast.success(t('success'), { description: t('productionStarted') });
      fetchProductionData();
    } catch (error: any) {
      console.error('Error starting production:', error);
      toast.error(t('error'), { description: error.message });
    }
  };

  const handleGenerateCertificate = async (itemId: string, serialNumber: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      toast.loading(t('generatingCertificate') || 'Generating certificate...', { id: 'cert-gen' });

      const { certificateId, pdfUrl } = await generateQualityCertificate(itemId);

      toast.success(t('certificateGenerated') || 'Certificate generated!', {
        id: 'cert-gen',
        description: t('certificateReady') || 'Certificate is ready for download',
        action: {
          label: t('download') || 'Download',
          onClick: () => window.open(pdfUrl, '_blank'),
        },
      });

      fetchProductionData();
    } catch (error: any) {
      console.error('Error generating certificate:', error);
      toast.error(t('error'), {
        id: 'cert-gen',
        description: error.message || t('failedGenerateCertificate') || 'Failed to generate certificate',
      });
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planned: 'bg-info text-info-foreground',
      in_progress: 'bg-warning text-warning-foreground',
      completed: 'bg-success text-success-foreground',
      on_hold: 'bg-muted text-muted-foreground',
      cancelled: 'bg-destructive text-destructive-foreground',
    };
    return colors[status] || 'bg-secondary text-secondary-foreground';
  };

  if (!user) return null;

  if (loading) {
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

  if (!workOrder) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">{t('workOrderNotFound')}</h3>
            <Button onClick={() => navigate('/work-orders')}>
              {t('backToWorkOrders')}
            </Button>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-4 lg:space-y-6 p-2 md:p-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/work-orders')} className="h-10 w-10 md:h-12 md:w-12">
              <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
            </Button>
            <div className="space-y-1 flex-1">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">{workOrder.wo_number}</h1>
              <p className="text-sm md:text-base lg:text-lg text-muted-foreground font-data">
                {workOrder.product_type} • Batch: {workOrder.batch_size}
              </p>
            </div>
          </div>

          {/* Editable Work Order Details Section */}
          {workOrder.status !== 'completed' && (
            <Card className="shadow-sm">
              <CardContent className="py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Customer Name */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {t('customer')}
                    </label>
                    <Input
                      value={workOrder.customer_name || ''}
                      placeholder={t('enterCustomerName')}
                      className="h-8 text-sm"
                      onChange={async (e) => {
                        const newValue = e.target.value;
                        try {
                          const { error } = await supabase
                            .from('work_orders')
                            .update({ customer_name: newValue })
                            .eq('id', workOrder.id);
                          if (error) throw error;
                          setWorkOrder({ ...workOrder, customer_name: newValue });
                        } catch (error: any) {
                          toast.error(t('error'), { description: error.message });
                        }
                      }}
                    />
                  </div>

                  {/* External Order Number */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileTextIcon className="h-3 w-3" />
                      {t('orderNumber')}
                    </label>
                    <Input
                      value={workOrder.external_order_number || ''}
                      placeholder={t('enterOrderNumber')}
                      className="h-8 text-sm font-data"
                      onChange={async (e) => {
                        const newValue = e.target.value;
                        try {
                          const { error } = await supabase
                            .from('work_orders')
                            .update({ external_order_number: newValue })
                            .eq('id', workOrder.id);
                          if (error) throw error;
                          setWorkOrder({ ...workOrder, external_order_number: newValue });
                        } catch (error: any) {
                          toast.error(t('error'), { description: error.message });
                        }
                      }}
                    />
                  </div>

                  {/* Order Value */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {t('value')}
                    </label>
                    <Input
                      type="number"
                      value={workOrder.order_value || ''}
                      placeholder="0.00"
                      className="h-8 text-sm"
                      onChange={async (e) => {
                        const newValue = e.target.value ? parseFloat(e.target.value) : null;
                        try {
                          const { error } = await supabase
                            .from('work_orders')
                            .update({ order_value: newValue })
                            .eq('id', workOrder.id);
                          if (error) throw error;
                          setWorkOrder({ ...workOrder, order_value: newValue });
                        } catch (error: any) {
                          toast.error(t('error'), { description: error.message });
                        }
                      }}
                    />
                  </div>

                  {/* Start Date */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {t('startDate')}
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full h-8 justify-start text-left font-normal text-sm">
                          {workOrder.start_date ? formatDate(workOrder.start_date) : t('setDate')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={workOrder.start_date ? new Date(workOrder.start_date) : undefined}
                          onSelect={async (date) => {
                            if (date) {
                              try {
                                const { error } = await supabase
                                  .from('work_orders')
                                  .update({ start_date: format(date, 'yyyy-MM-dd') })
                                  .eq('id', workOrder.id);
                                if (error) throw error;
                                toast.success(t('success'), { description: t('startDateUpdated') });
                                setWorkOrder({ ...workOrder, start_date: format(date, 'yyyy-MM-dd') });
                              } catch (error: any) {
                                toast.error(t('error'), { description: error.message });
                              }
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Shipping Date */}
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      {t('shippingDate')}
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full h-8 justify-start text-left font-normal text-sm">
                          {workOrder.shipping_date ? formatDate(workOrder.shipping_date) : t('setDate')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={workOrder.shipping_date ? new Date(workOrder.shipping_date) : undefined}
                          onSelect={async (date) => {
                            if (date) {
                              try {
                                const { error } = await supabase
                                  .from('work_orders')
                                  .update({ shipping_date: format(date, 'yyyy-MM-dd') })
                                  .eq('id', workOrder.id);
                                if (error) throw error;
                                toast.success(t('success'), { description: t('shippingDateUpdated') });
                                setWorkOrder({ ...workOrder, shipping_date: format(date, 'yyyy-MM-dd') });
                              } catch (error: any) {
                                toast.error(t('error'), { description: error.message });
                              }
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-xl md:text-2xl">{t('production')} {t('items')}</CardTitle>
                  <CardDescription className="text-sm mt-1">{t('trackItems')}</CardDescription>
                </div>
                <Badge className={`${getStatusColor(workOrder.status)} flex-shrink-0`}>
                  {formatStatus(workOrder.status, language as 'en' | 'nl')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 md:space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 md:gap-3 p-3 md:p-4 border rounded-lg hover:bg-accent/50 transition-all cursor-pointer active:scale-[0.99] hover:shadow-sm overflow-hidden"
                    onClick={() => navigate(`/production/step/${item.id}`)}
                  >
                    {/* Position badge - fixed size */}
                    <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 md:h-12 md:w-12 rounded-lg bg-primary text-primary-foreground font-bold text-base md:text-lg shadow-sm">
                      {item.position_in_batch}
                    </div>
                    
                    {/* Serial number and info - flexible with truncation */}
                    <div className="flex-1 min-w-0">
                      <p className="font-data text-sm md:text-base font-semibold truncate">{item.serial_number}</p>
                      <p className="text-xs md:text-sm text-muted-foreground font-data truncate">
                        {item.product_type || workOrder.product_type} • {t('step')} {item.current_step}
                      </p>
                    </div>
                    
                    {/* Actions - fixed size, no shrink */}
                    <div className="flex-shrink-0 flex items-center gap-1.5 md:gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title={t('traceability')}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/genealogy/${encodeURIComponent(item.serial_number)}`);
                        }}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title={t('productionReports')}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/production-reports?serial=${encodeURIComponent(item.serial_number)}`);
                        }}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Badge className={`${getStatusColor(item.status)} shrink-0`}>
                        {formatStatus(item.status, language as 'en' | 'nl')}
                      </Badge>
                      {item.status === 'completed' && (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintLabel(item.serial_number, item.operator_initials, item.product_type);
                            }}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant={item.certificate_generated ? "default" : "outline"}
                            className="h-8 w-8 flex-shrink-0"
                            onClick={(e) => handleGenerateCertificate(item.id, item.serial_number, e)}
                            disabled={item.certificate_generated}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {(item.product_type === 'SENSOR' || (!item.product_type && workOrder.product_type === 'SENSOR')) && item.status === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs flex-shrink-0 hidden sm:flex"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/production/sensor/${item.id}`);
                          }}
                        >
                          Sensor
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Work Order Notes - using existing work_order_notes functionality */}
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default Production;
