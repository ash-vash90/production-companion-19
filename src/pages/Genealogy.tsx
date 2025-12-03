import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Network, Package, ClipboardList, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';

interface GenealogyData {
  item: {
    id: string;
    serial_number: string;
    status: string;
    work_order: {
      wo_number: string;
      product_type: string;
    };
  };
  subAssemblies: Array<{
    component_type: string;
    child_serial_number: string;
    linked_at: string;
  }>;
  batchMaterials: Array<{
    material_type: string;
    batch_number: string;
    opening_date?: string;
    scanned_at: string;
  }>;
  measurements: Array<{
    step_number: number;
    step_title: string;
    measurement_values: Record<string, unknown>;
    validation_status: string;
    operator_initials: string;
    completed_at: string;
  }>;
  certificate?: {
    id: string;
    pdf_url: string;
    generated_at: string;
  };
}

const Genealogy = () => {
  const { serialNumber } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GenealogyData | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (serialNumber) {
      fetchGenealogyData();
    }
  }, [user, serialNumber, navigate]);

  const fetchGenealogyData = async () => {
    try {
      setLoading(true);

      // Fetch main item
      const { data: itemData, error: itemError } = await supabase
        .from('work_order_items')
        .select(`
          id,
          serial_number,
          status,
          work_order:work_orders(wo_number, product_type)
        `)
        .eq('serial_number', serialNumber)
        .single();

      if (itemError) throw itemError;
      if (!itemData) throw new Error('Item not found');

      // Fetch sub-assemblies
      const { data: subAssemblies, error: subError } = await supabase
        .from('sub_assemblies')
        .select(`
          component_type,
          linked_at,
          child_item:work_order_items!sub_assemblies_child_item_id_fkey(serial_number)
        `)
        .eq('parent_item_id', itemData.id);

      if (subError) throw subError;

      // Fetch batch materials
      const { data: batches, error: batchError } = await supabase
        .from('batch_materials')
        .select('material_type, batch_number, opening_date, scanned_at')
        .eq('work_order_item_id', itemData.id)
        .order('scanned_at', { ascending: true });

      if (batchError) throw batchError;

      // Fetch measurements
      const { data: executions, error: execError } = await supabase
        .from('step_executions')
        .select(`
          production_step:production_steps(step_number, title_en),
          measurement_values,
          validation_status,
          operator_initials,
          completed_at
        `)
        .eq('work_order_item_id', itemData.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: true });

      if (execError) throw execError;

      // Fetch certificate
      const { data: certData } = await supabase
        .from('quality_certificates')
        .select('id, pdf_url, generated_at')
        .eq('work_order_item_id', itemData.id)
        .maybeSingle();

      const genealogyData: GenealogyData = {
        item: itemData as any,
        subAssemblies: (subAssemblies || []).map((sub: any) => ({
          component_type: sub.component_type,
          child_serial_number: sub.child_item?.serial_number || 'Unknown',
          linked_at: sub.linked_at,
        })),
        batchMaterials: batches || [],
        measurements: (executions || []).map((exec: any) => ({
          step_number: exec.production_step?.step_number || 0,
          step_title: exec.production_step?.title_en || 'Unknown',
          measurement_values: exec.measurement_values || {},
          validation_status: exec.validation_status || 'unknown',
          operator_initials: exec.operator_initials || 'N/A',
          completed_at: exec.completed_at || '',
        })),
        certificate: certData || undefined,
      };

      setData(genealogyData);
    } catch (error: any) {
      console.error('Error fetching genealogy:', error);
      toast.error(t('error'), { description: error.message || 'Failed to load genealogy data' });
    } finally {
      setLoading(false);
    }
  };

  const exportToJSON = () => {
    if (!data) return;

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genealogy-${serialNumber}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(t('success'), { description: 'Genealogy data exported' });
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

  if (!data) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Item Not Found</h3>
            <p className="text-muted-foreground mb-4">
              No item found with serial number: {serialNumber}
            </p>
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
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-4xl font-bold tracking-tight">
                Genealogy Report
              </h1>
              <p className="text-lg text-muted-foreground mt-1">
                Complete traceability for {data.item.serial_number}
              </p>
            </div>
            <Button onClick={exportToJSON} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>

          {/* Product Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Serial Number</p>
                  <p className="font-mono font-bold text-lg">{data.item.serial_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Work Order</p>
                  <p className="font-mono font-medium">{data.item.work_order.wo_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Product Type</p>
                  <Badge variant="outline" className="mt-1">{data.item.work_order.product_type}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className="mt-1">{data.item.status}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Component Genealogy */}
          {data.subAssemblies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  Component Genealogy
                </CardTitle>
                <CardDescription>
                  Sub-assemblies linked to this product
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.subAssemblies.map((sub, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{sub.component_type}</p>
                          <p className="text-sm text-muted-foreground font-mono">
                            {sub.child_serial_number}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Linked</p>
                        <p className="text-sm">{format(new Date(sub.linked_at), 'MMM dd, yyyy')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Material Traceability */}
          {data.batchMaterials.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Material Traceability
                </CardTitle>
                <CardDescription>
                  Batch numbers for all materials used
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.batchMaterials.map((batch, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{batch.material_type}</Badge>
                        <span className="font-mono font-medium">{batch.batch_number}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {batch.opening_date && (
                          <span>Opened: {format(new Date(batch.opening_date), 'MMM dd, yyyy')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quality Test Results */}
          {data.measurements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Quality Test Results
                </CardTitle>
                <CardDescription>
                  All measurements and validations performed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.measurements.map((measurement, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">
                            Step {measurement.step_number}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {measurement.step_title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              measurement.validation_status === 'passed'
                                ? 'default'
                                : measurement.validation_status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {measurement.validation_status.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {measurement.operator_initials}
                          </span>
                        </div>
                      </div>
                      {Object.keys(measurement.measurement_values).length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          {Object.entries(measurement.measurement_values).map(([key, value]) => (
                            <span key={key} className="mr-4">
                              {key}: <span className="font-mono">{String(value)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quality Certificate */}
          {data.certificate && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Quality Certificate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Certificate Generated</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(data.certificate.generated_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                  <Button
                    onClick={() => window.open(data.certificate!.pdf_url, '_blank')}
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Certificate
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default Genealogy;
