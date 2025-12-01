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
      toast.error(t('error'), { description: 'Failed to load production data' });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintLabel = (serialNumber: string) => {
    // Create a simple label for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Label: ${serialNumber}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 20px;
              }
              .label {
                border: 2px solid #000;
                padding: 20px;
                width: 300px;
                text-align: center;
              }
              .serial {
                font-size: 24px;
                font-weight: bold;
                margin: 20px 0;
              }
              .barcode {
                font-family: 'Libre Barcode 128', cursive;
                font-size: 48px;
                margin: 20px 0;
              }
            </style>
          </head>
          <body>
            <div class="label">
              <h2>${workOrder?.product_type}</h2>
              <div class="serial">${serialNumber}</div>
              <div class="barcode">${serialNumber}</div>
              <p>WO: ${workOrder?.wo_number}</p>
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

      // Log activity
      supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'print_label',
        entity_type: 'work_order_item',
        details: { serial_number: serialNumber, wo_number: workOrder?.wo_number },
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

      toast.success(t('success'), { description: 'Production started' });
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
            <h3 className="text-lg font-semibold mb-2">Work order not found</h3>
            <Button onClick={() => navigate('/work-orders')}>
              Back to Work Orders
            </Button>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/work-orders')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{workOrder.wo_number}</h1>
              <p className="text-muted-foreground">
                {workOrder.product_type} • Batch: {workOrder.batch_size}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('production')} Items</CardTitle>
                <Badge className={`${getStatusColor(workOrder.status)} text-white`}>
                  {t(workOrder.status as any)}
                </Badge>
              </div>
              <CardDescription>Track individual items through production</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center justify-center h-12 w-12 rounded-lg bg-primary/10 text-primary font-bold">
                        {item.position_in_batch}
                      </div>
                      <div>
                        <p className="font-mono text-sm font-medium">{item.serial_number}</p>
                        <p className="text-xs text-muted-foreground">
                          Step {item.current_step} of 3
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${getStatusColor(item.status)} text-white`}>
                        {t(item.status as any)}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePrintLabel(item.serial_number)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      {item.status === 'planned' && (
                        <Button
                          size="sm"
                          onClick={() => handleStartProduction(item.id)}
                        >
                          Start
                        </Button>
                      )}
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
