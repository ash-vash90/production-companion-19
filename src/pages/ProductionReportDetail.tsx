import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { ProductBreakdownBadges } from '@/components/workorders/ProductBreakdownBadges';
import { ReportDetailContentV2 } from '@/components/reports/ReportDetailContentV2';
import { useProductionReportDetail } from '@/services/reportDataService';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Package } from 'lucide-react';
import { getProductBreakdown } from '@/lib/utils';
import { generateProductionReportPdf } from '@/services/reportPdfService';
import type { ExportSections } from '@/types/reports';

const ProductionReportDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const { data, loading, error, fetchReport } = useProductionReportDetail();
  const [exporting, setExporting] = React.useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (id) {
      fetchReport(id, language as 'en' | 'nl');
    }
  }, [user, id, navigate, fetchReport, language]);

  // Show error toast if fetch fails
  useEffect(() => {
    if (error) {
      toast.error(t('error'), { description: error.message });
    }
  }, [error, t]);

  const handleExportPdf = async (sections?: ExportSections) => {
    if (!data) return;
    setExporting(true);
    try {
      await generateProductionReportPdf(data, { language: language as 'en' | 'nl', sections });
      toast.success(t('pdfExported'));
    } catch (err: any) {
      console.error('PDF export error:', err);
      toast.error(t('error'), { description: err.message || 'Failed to export PDF' });
    } finally {
      setExporting(false);
    }
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
            <h3 className="text-lg font-semibold mb-2">{t('workOrderNotFound')}</h3>
            <Button onClick={() => navigate('/production-reports')}>
              {t('backToWorkOrders')}
            </Button>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  const productBreakdown = getProductBreakdown(data.items.map(i => ({ serial_number: i.serial_number })));

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-4">
          {/* Back Button */}
          <Button variant="ghost" size="sm" onClick={() => navigate('/production-reports')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('backToReports')}
          </Button>

          {/* Report Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{data.workOrder.wo_number}</h1>
              <p className="text-muted-foreground mt-1">
                {data.workOrder.customer_name && <span>{data.workOrder.customer_name} • </span>}
                {t('productionReport')}
              </p>
              <div className="mt-2">
                <ProductBreakdownBadges breakdown={productBreakdown} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusIndicator status={data.workOrder.status as any} size="default" />
            </div>
          </div>

          {/* Main Content - uses new entity-based components */}
          <ReportDetailContentV2
            data={data}
            onExportPdf={handleExportPdf}
            exporting={exporting}
          />
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default ProductionReportDetail;
