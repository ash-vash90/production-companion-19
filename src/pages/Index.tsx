import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { ProductionOverview } from '@/components/dashboard/ProductionOverview';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { ActiveOperators } from '@/components/dashboard/ActiveOperators';
import { TodaysSchedule } from '@/components/dashboard/TodaysSchedule';
import { CreateWorkOrderDialog } from '@/components/CreateWorkOrderDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">{t('dashboard')}</h1>
              <p className="text-lg text-muted-foreground mt-2">
                {t('realTimeMonitoring')}
              </p>
            </div>
            <Button variant="default" size="lg" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2" />
              {t('createWorkOrder')}
            </Button>
          </div>

          {/* Stats Grid */}
          <DashboardStats />

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <ProductionOverview />
              <RecentActivity />
            </div>
            <div className="space-y-6">
              <TodaysSchedule />
              <ActiveOperators />
            </div>
          </div>
        </div>

        <CreateWorkOrderDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={() => {
            // Optionally refresh data or navigate
          }}
        />
      </Layout>
    </ProtectedRoute>
  );
};

export default Index;
