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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Package, Printer, FileText, CalendarIcon, DollarSign, User, FileTextIcon, Link2 } from 'lucide-react';
import { generateQualityCertificate } from '@/services/certificateService';
import { format, differenceInDays, parseISO, isBefore } from 'date-fns';
import QRCodeLib from 'qrcode';
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
        <div className="space-y-4 lg:space-y-6 w-full max-w-4xl mx-auto">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/work-orders')} className="h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-12 shrink-0">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
            </Button>
            <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight truncate">{workOrder.wo_number}</h1>
              <p className="text-xs sm:text-sm md:text-base lg:text-lg text-muted-foreground font-data truncate">
                {workOrder.product_type} • Batch: {workOrder.batch_size}
              </p>
            </div>
          </div>

          {/* Editable Work Order Details Section */}
          {workOrder.status !== 'completed' && (
            <Card className="shadow-sm border-border/60">
              <CardContent className="p-3 sm:p-4 md:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {/* Customer Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                      <User className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      {t('customer')}
                    </label>
                    <Input
                      value={workOrder.customer_name || ''}
                      placeholder={t('enterCustomerName')}
                      className="h-10 sm:h-9 text-sm sm:text-base"
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
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                      <FileTextIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      {t('orderNumber')}
                    </label>
                    <Input
                      value={workOrder.external_order_number || ''}
                      placeholder={t('enterOrderNumber')}
                      className="h-10 sm:h-9 text-sm sm:text-base font-data"
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
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                      <DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      {t('value')}
                    </label>
                    <Input
                      type="number"
                      value={workOrder.order_value || ''}
                      placeholder="0.00"
                      className="h-10 sm:h-9 text-sm sm:text-base"
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
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                      <CalendarIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      {t('startDate')}
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full h-10 sm:h-9 justify-start text-left font-normal text-sm sm:text-base">
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
                  <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                      <CalendarIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      {t('shippingDate')}
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full h-10 sm:h-9 justify-start text-left font-normal text-sm sm:text-base">
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

          <Card className="shadow-sm border-border/60">
            <CardHeader className="p-3 sm:p-4 md:p-6 pb-2 sm:pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                <div className="space-y-0.5">
                  <CardTitle className="text-lg sm:text-xl md:text-2xl">{t('production')} {t('items')}</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">{t('trackItems')}</CardDescription>
                </div>
                <Badge className={`${getStatusColor(workOrder.status)} h-7 sm:h-8 md:h-10 px-3 sm:px-4 text-xs sm:text-sm md:text-base font-semibold self-start sm:self-center whitespace-nowrap`}>
                  {formatStatus(workOrder.status, language as 'en' | 'nl')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-2 sm:pt-3">
              <div className="space-y-2 sm:space-y-2.5 md:space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 border rounded-lg hover:bg-accent/50 transition-all cursor-pointer active:scale-[0.99] hover:shadow-sm"
                    onClick={() => navigate(`/production/step/${item.id}`)}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4 min-w-0">
                      <div className="flex flex-col items-center justify-center h-9 w-9 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-lg bg-primary text-primary-foreground font-bold text-sm sm:text-base md:text-lg shadow-sm shrink-0">
                        {item.position_in_batch}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-data text-sm sm:text-base font-semibold truncate">{item.serial_number}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground font-data truncate">
                          {item.product_type || workOrder.product_type} • {t('step')} {item.current_step}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 pl-11 sm:pl-0 shrink-0">
                      <Badge className={`${getStatusColor(item.status)} h-6 sm:h-7 md:h-8 px-2 sm:px-2.5 md:px-3 text-[10px] sm:text-xs md:text-sm font-medium whitespace-nowrap`}>
                        {formatStatus(item.status, language as 'en' | 'nl')}
                      </Badge>
                      {item.status === 'completed' && (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintLabel(item.serial_number, item.operator_initials, item.product_type);
                            }}
                          >
                            <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                          </Button>
                          <Button
                            size="icon"
                            variant={item.certificate_generated ? "default" : "outline"}
                            className="h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10"
                            onClick={(e) => handleGenerateCertificate(item.id, item.serial_number, e)}
                            disabled={item.certificate_generated}
                          >
                            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                          </Button>
                        </>
                      )}
                      {(item.product_type === 'SENSOR' || (!item.product_type && workOrder.product_type === 'SENSOR')) && item.status === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 sm:h-8 md:h-10 px-2 sm:px-3 text-[10px] sm:text-xs md:text-sm whitespace-nowrap"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/production/sensor/${item.id}`);
                          }}
                        >
                          Sensor Workflow
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
