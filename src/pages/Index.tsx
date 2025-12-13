import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import { ProductionOverview } from '@/components/dashboard/ProductionOverview';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { ActiveOperators } from '@/components/dashboard/ActiveOperators';
import { TodaysSchedule } from '@/components/dashboard/TodaysSchedule';
import { WeatherWidget } from '@/components/dashboard/WeatherWidget';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<{ full_name: string; role: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfileLoading(false);
      return;
    }
    
    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .maybeSingle();
      
      if (data) setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      fetchProfile();
    }
  }, [user, authLoading, fetchProfile]);

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

  if (authLoading || profileLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="space-y-6 w-full max-w-full overflow-hidden">
        {/* Compact header */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {getGreetingMessage()}, <span className="text-primary">{getFirstName()}</span>
            </h1>
          </div>
          <WeatherWidget />
        </header>

        {/* Inline stats bar */}
        <DashboardStats />

        {/* Main content - flat sections with dividers */}
        <div className="grid gap-6 lg:gap-8 grid-cols-1 lg:grid-cols-5">
          {/* Left column - Schedule & Production */}
          <div className="lg:col-span-3 space-y-6">
            <TodaysSchedule />
            <div className="border-t border-border/50 pt-6">
              <ProductionOverview />
            </div>
          </div>

          {/* Right column - Team & Activity */}
          <div className="lg:col-span-2 space-y-6 lg:border-l lg:border-border/50 lg:pl-8">
            <ActiveOperators />
            <div className="border-t border-border/50 pt-6">
              <RecentActivity />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
