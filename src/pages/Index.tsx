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
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="space-y-10 animate-fade-in">
        {/* Hero header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {getGreetingMessage()}, <span className="text-primary">{getFirstName()}</span>
            </h1>
            <WeatherWidget />
          </div>
          <p className="text-sm text-muted-foreground">
            Here's what's happening today.
          </p>
        </div>

        {/* Stats row - no cards, just numbers */}
        <DashboardStats />

        {/* Main content grid */}
        <div className="grid gap-10 lg:grid-cols-3">
          {/* Left column - schedule & team stacked */}
          <div className="lg:col-span-1 space-y-10">
            <TodaysSchedule />
            <ActiveOperators />
          </div>
          
          {/* Right column - work orders & activity */}
          <div className="lg:col-span-2 space-y-10">
            <ProductionOverview />
            <RecentActivity />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
