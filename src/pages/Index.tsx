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
import { WeatherWidget } from '@/components/dashboard/WeatherWidget';
import { CreateWorkOrderDialog } from '@/components/CreateWorkOrderDialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Plus } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string; role: string } | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else {
      fetchProfile();
    }
  }, [user, navigate]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .maybeSingle();
    if (data) setProfile(data);
  };

  const getFirstName = () => {
    if (!profile?.full_name) return '';
    return profile.full_name.split(' ')[0];
  };

  const getGreetingMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('goodMorning');
    if (hour < 18) return t('goodAfternoon');
    return t('goodEvening');
  };

  const getRoleSpecificMessage = () => {
    if (!profile) return t('realTimeMonitoring');
    
    switch (profile.role) {
      case 'admin':
        return t('adminDashboardHint');
      case 'supervisor':
        return t('supervisorDashboardHint');
      case 'operator':
        return t('operatorDashboardHint');
      case 'logistics':
        return t('logisticsDashboardHint');
      default:
        return t('realTimeMonitoring');
    }
  };

  if (!user) return null;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Header with greeting and weather */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight">
                {getGreetingMessage()}, {getFirstName()}
              </h1>
              <p className="text-sm text-muted-foreground">{getRoleSpecificMessage()}</p>
            </div>
            <div className="flex items-center gap-4">
              <WeatherWidget />
              <Button variant="default" size="default" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('createWorkOrder')}
              </Button>
            </div>
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
