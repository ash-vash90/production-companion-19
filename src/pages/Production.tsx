import React, { useEffect, useState, useCallback } from 'react';
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
import { Loader2, ArrowLeft, Package, Printer, FileText, CalendarIcon, DollarSign, User, FileTextIcon, Link2, CheckCircle2, RefreshCw, ChevronRight, MoreVertical, Play } from 'lucide-react';
import { generateQualityCertificate } from '@/services/certificateService';
import { format, differenceInDays, parseISO, isBefore } from 'date-fns';
import QRCodeLib from 'qrcode';
import { formatStatus, formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useTouchDevice, usePullToRefresh, useHapticFeedback } from '@/hooks/useTouchDevice';
import { FloatingActionButton, ActionSheet } from '@/components/mobile/MobileActionBar';

const Production = () => {
  const { itemId } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  // Mobile-specific hooks
  const isTouchDevice = useTouchDevice();
  const haptic = useHapticFeedback();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showItemActions, setShowItemActions] = useState(false);

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
    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString('en', { month: 'short' }).toUpperCase();
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year} / ${month} / ${day}`;
    const productType = itemProductType || workOrder?.product_type || '';

    // Generate QR code containing serial number and work order info
    const qrData = JSON.stringify({
      serial: serialNumber,
      wo: workOrder?.wo_number,
      product: productType,
      date: now.toISOString().split('T')[0]
    });
    const qrCodeDataUrl = await QRCodeLib.toDataURL(qrData, { width: 120, margin: 1 });

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Label: ${serialNumber}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@500;600;700&family=Libre+Barcode+128&display=swap" rel="stylesheet">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              @page {
                size: 4in 3in;
                margin: 0;
              }
              body {
                font-family: 'Instrument Sans', sans-serif;
                background: white;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 3in;
                width: 4in;
              }
              .label {
                border: 4px solid #000;
                padding: 16px;
                width: 100%;
                height: 100%;
                text-align: center;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
              }
              .date {
                font-size: 11px;
                font-weight: 600;
                letter-spacing: 0.3px;
                text-transform: uppercase;
              }
              .product {
                font-size: 16px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1px;
              }
              .serial {
                font-size: 32px;
                font-weight: 700;
                letter-spacing: 2px;
                margin: 8px 0;
              }
              .barcode {
                font-family: 'Libre Barcode 128', cursive;
                font-size: 56px;
                line-height: 1;
                letter-spacing: 0;
                margin: 4px 0;
              }
              .codes-container {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 12px;
                margin: 8px 0;
              }
              .qr-code {
                width: 80px;
                height: 80px;
              }
              .info {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
                font-weight: 600;
                padding-top: 8px;
                border-top: 3px solid #000;
              }
            </style>
          </head>
          <body>
            <div class="label">
              <div class="date">${dateStr}</div>
              <div class="product">${productType}</div>
              <div class="serial">${serialNumber}</div>
              <div class="codes-container">
                <img src="${qrCodeDataUrl}" alt="QR Code" class="qr-code" />
                <div class="barcode">${serialNumber}</div>
              </div>
              <div class="info">
                <span>WO: ${workOrder?.wo_number || ''}</span>
                ${operatorInitials ? `<span>OP: ${operatorInitials}</span>` : '<span></span>'}
              </div>
            </div>
            <script>
              window.onload = function() {
                setTimeout(() => {
                  window.print();
                  setTimeout(() => window.close(), 500);
                }, 100);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();

      // Log activity in background (non-blocking)
      supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'print_label',
        entity_type: 'work_order_item',
        details: { serial_number: serialNumber, wo_number: workOrder?.wo_number, operator: operatorInitials },
      }).then(({ error }) => {
        if (error) console.error('Failed to log print activity:', error);
      });
    }
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

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    haptic.medium();
    await fetchProductionData();
    setIsRefreshing(false);
  }, [haptic]);

  // Use pull-to-refresh on touch devices
  usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    enabled: isTouchDevice && !loading,
  });

  // Handle long press on item (mobile)
  const handleItemLongPress = (item: any) => {
    if (isTouchDevice) {
      haptic.medium();
      setSelectedItem(item);
      setShowItemActions(true);
    }
  };

  // Get actions for selected item
  const getItemActions = () => {
    if (!selectedItem) return [];

    const actions: Array<{
      label: string;
      icon?: React.ReactNode;
      onClick: () => void;
      variant?: 'default' | 'destructive';
    }> = [];

    // Always add "Open" action
    actions.push({
      label: t('openItem') || 'Open Item',
      icon: <ChevronRight className="h-5 w-5" />,
      onClick: () => {
        navigate(`/production/step/${selectedItem.id}`);
        setShowItemActions(false);
      },
    });

    // Add print label if completed
    if (selectedItem.status === 'completed') {
      actions.push({
        label: t('printLabel') || 'Print Label',
        icon: <Printer className="h-5 w-5" />,
        onClick: () => {
          handlePrintLabel(selectedItem.serial_number, selectedItem.operator_initials, selectedItem.product_type);
          setShowItemActions(false);
        },
      });

      if (!selectedItem.certificate_generated) {
        actions.push({
          label: t('generateCertificate') || 'Generate Certificate',
          icon: <FileText className="h-5 w-5" />,
          onClick: () => {
            handleGenerateCertificate(selectedItem.id, selectedItem.serial_number, { stopPropagation: () => {} } as React.MouseEvent);
            setShowItemActions(false);
          },
        });
      }
    }

    // Add sensor mode for sensor items in progress
    const itemProductType = selectedItem.product_type || workOrder?.product_type;
    if (itemProductType === 'SENSOR' && selectedItem.status === 'in_progress') {
      actions.push({
        label: t('sensorMode') || 'Sensor Mode',
        icon: <Play className="h-5 w-5" />,
        onClick: () => {
          navigate(`/production/sensor/${selectedItem.id}`);
          setShowItemActions(false);
        },
      });
    }

    return actions;
  };

  // Find next item to work on
  const getNextItem = () => {
    // First, find any in-progress item
    const inProgress = items.find(i => i.status === 'in_progress');
    if (inProgress) return inProgress;

    // Then, find the first planned item
    const planned = items.find(i => i.status === 'planned');
    return planned;
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
        <div className="space-y-4 lg:space-y-6 p-2 md:p-4 max-w-4xl mx-auto pb-24 md:pb-8">
          {/* Pull-to-refresh indicator */}
          {isRefreshing && (
            <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in slide-in-from-top">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">{t('refreshing') || 'Refreshing...'}</span>
            </div>
          )}

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/work-orders')} className="h-12 w-12 touch-target">
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div className="space-y-1 flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight truncate">{workOrder.wo_number}</h1>
              <p className="text-sm md:text-base lg:text-lg text-muted-foreground font-data">
                {workOrder.product_type} • Batch: {workOrder.batch_size}
              </p>
            </div>
            {/* Mobile refresh button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="sm:hidden h-12 w-12 touch-target"
            >
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
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
                    className="flex items-center gap-2 md:gap-3 p-3 md:p-4 border rounded-lg hover:bg-accent/50 transition-all cursor-pointer active:scale-[0.98] hover:shadow-sm overflow-hidden touch-target"
                    onClick={() => {
                      if (isTouchDevice) haptic.light();
                      navigate(`/production/step/${item.id}`);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleItemLongPress(item);
                    }}
                    onTouchStart={(e) => {
                      const timer = setTimeout(() => handleItemLongPress(item), 500);
                      const clearTimer = () => clearTimeout(timer);
                      e.currentTarget.addEventListener('touchend', clearTimer, { once: true });
                      e.currentTarget.addEventListener('touchmove', clearTimer, { once: true });
                    }}
                  >
                    {/* Position badge - fixed size */}
                    <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 md:h-12 md:w-12 rounded-lg bg-primary text-primary-foreground font-bold text-lg shadow-sm">
                      {item.position_in_batch}
                    </div>

                    {/* Serial number and info - flexible with truncation */}
                    <div className="flex-1 min-w-0">
                      <p className="font-data text-base md:text-base font-semibold truncate">{item.serial_number}</p>
                      <p className="text-sm md:text-sm text-muted-foreground font-data truncate">
                        {item.product_type || workOrder.product_type} • {t('step')} {item.current_step}
                      </p>
                    </div>

                    {/* Actions - desktop only, mobile uses long-press menu */}
                    <div className="flex-shrink-0 flex items-center gap-1.5 md:gap-2">
                      <Badge className={`${getStatusColor(item.status)} shrink-0 text-xs md:text-sm`}>
                        {formatStatus(item.status, language as 'en' | 'nl')}
                      </Badge>
                      {/* Desktop actions */}
                      <div className="hidden sm:flex items-center gap-2">
                        {item.status === 'completed' && (
                          <>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-9 w-9 flex-shrink-0"
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
                              className="h-9 w-9 flex-shrink-0"
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
                            className="h-9 px-3 text-sm flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/production/sensor/${item.id}`);
                            }}
                          >
                            Sensor
                          </Button>
                        )}
                      </div>
                      {/* Mobile more button */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="sm:hidden h-10 w-10 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemLongPress(item);
                        }}
                      >
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Work Order Notes - using existing work_order_notes functionality */}
        </div>

        {/* Mobile action sheet for item actions */}
        <ActionSheet
          open={showItemActions}
          onClose={() => {
            setShowItemActions(false);
            setSelectedItem(null);
          }}
          title={selectedItem?.serial_number || ''}
          description={`${selectedItem?.product_type || workOrder?.product_type} • ${formatStatus(selectedItem?.status || '', language as 'en' | 'nl')}`}
          actions={getItemActions()}
          cancelLabel={t('cancel') || 'Cancel'}
        />

        {/* Mobile FAB to jump to next item */}
        {isTouchDevice && getNextItem() && (
          <FloatingActionButton
            icon={<Play className="h-6 w-6" />}
            onClick={() => {
              const nextItem = getNextItem();
              if (nextItem) {
                haptic.medium();
                navigate(`/production/step/${nextItem.id}`);
              }
            }}
            label={t('continueProduction') || 'Continue Production'}
            variant="default"
            position="bottom-right"
          />
        )}

        {/* Mobile hint */}
        {isTouchDevice && items.length > 0 && (
          <div className="fixed bottom-24 left-4 right-4 sm:hidden pointer-events-none">
            <div className="flex items-center justify-center text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg border shadow-sm">
              <span>{t('longPressForActions') || 'Long press item for more options'}</span>
            </div>
          </div>
        )}
      </Layout>
    </ProtectedRoute>
  );
};

export default Production;
