import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Package, QrCode, Printer } from 'lucide-react';

const Production = () => {
  const { itemId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
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

  const handlePrintLabel = (serialNumber: string, operatorInitials?: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString('en', { month: 'short' }).toUpperCase();
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year} / ${month} / ${day}`;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Label: ${serialNumber}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: 'Instrument Sans', sans-serif;
                padding: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .label {
                border: 3px solid #000;
                padding: 20px;
                width: 350px;
                text-align: center;
              }
              .date {
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 15px;
                letter-spacing: 0.5px;
              }
              .product {
                font-size: 18px;
                font-weight: 700;
                margin-bottom: 20px;
                text-transform: uppercase;
              }
              .serial {
                font-size: 28px;
                font-weight: 700;
                margin: 25px 0;
                letter-spacing: 1px;
              }
              .barcode {
                font-family: 'Libre Barcode 128', cursive;
                font-size: 48px;
                margin: 20px 0;
                letter-spacing: 0;
              }
              .wo {
                font-size: 14px;
                font-weight: 600;
                margin-top: 15px;
              }
              .operator {
                font-size: 16px;
                font-weight: 700;
                margin-top: 20px;
                padding-top: 15px;
                border-top: 2px solid #000;
              }
            </style>
          </head>
          <body>
            <div class="label">
              <div class="date">${dateStr}</div>
              <div class="product">${workOrder?.product_type}</div>
              <div class="serial">${serialNumber}</div>
              <div class="barcode">${serialNumber}</div>
              <div class="wo">WO: ${workOrder?.wo_number}</div>
              ${operatorInitials ? `<div class="operator">OP: ${operatorInitials}</div>` : ''}
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.close();
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();

      supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'print_label',
        entity_type: 'work_order_item',
        details: { serial_number: serialNumber, wo_number: workOrder?.wo_number, operator: operatorInitials },
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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planned: 'bg-status-planned',
      in_progress: 'bg-status-in-progress',
      completed: 'bg-status-completed',
      on_hold: 'bg-status-on-hold',
      cancelled: 'bg-status-cancelled',
    };
    return colors[status] || 'bg-muted';
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
        <div className="space-y-6 md:space-y-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/work-orders')} className="h-12 w-12 md:h-10 md:w-10">
              <ArrowLeft className="h-6 w-6 md:h-5 md:w-5" />
            </Button>
            <div className="space-y-1">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{workOrder.wo_number}</h1>
              <p className="text-base md:text-lg text-muted-foreground font-data">
                {workOrder.product_type} • Batch: {workOrder.batch_size}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl md:text-xl">{t('production')} {t('items')}</CardTitle>
                  <CardDescription className="text-base md:text-sm">{t('trackItems')}</CardDescription>
                </div>
                <Badge className={`${getStatusColor(workOrder.status)} text-white h-10 px-5 text-base md:h-auto md:px-3 md:text-sm self-start`}>
                  {t(workOrder.status as any)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 md:space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-5 md:p-4 border-2 rounded-lg hover:bg-accent/50 transition-all cursor-pointer active:scale-98"
                    onClick={() => navigate(`/production/step/${item.id}`)}
                  >
                    <div className="flex items-center gap-4 md:gap-3">
                      <div className="flex flex-col items-center justify-center h-14 w-14 md:h-12 md:w-12 rounded-lg bg-primary text-white font-bold text-xl md:text-base shadow-sm">
                        {item.position_in_batch}
                      </div>
                      <div>
                        <p className="font-data text-base md:text-sm font-medium">{item.serial_number}</p>
                        <p className="text-sm md:text-xs text-muted-foreground font-data">
                          {t('step')} {item.current_step} 
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 md:gap-2">
                      <Badge className={`${getStatusColor(item.status)} text-white h-9 px-4 text-sm md:h-auto md:px-3 md:text-xs`}>
                        {t(item.status as any)}
                      </Badge>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-12 w-12 md:h-9 md:w-9"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintLabel(item.serial_number);
                        }}
                      >
                        <Printer className="h-6 w-6 md:h-4 md:w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default Production;
