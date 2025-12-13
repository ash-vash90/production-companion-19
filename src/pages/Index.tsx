import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ProductionOverview } from '@/components/dashboard/ProductionOverview';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { ActiveOperators } from '@/components/dashboard/ActiveOperators';
import { TodaysSchedule } from '@/components/dashboard/TodaysSchedule';
import { WeatherWidget } from '@/components/dashboard/WeatherWidget';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
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
    
    if (!user) {
      navigate('/auth');
      return;
    }
    
    fetchProfile();
  }, [user, authLoading, navigate, fetchProfile]);

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

  // Show loading while auth is being checked or profile is being fetched
  if (authLoading || (user && profileLoading)) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!user) return null;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6 sm:space-y-8 w-full max-w-full overflow-hidden animate-fade-in">
          {/* Header with greeting and weather */}
          <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="space-y-1">
              <h1 className="text-hero">
                {getGreetingMessage()}, <span className="text-primary">{getFirstName()}</span>
              </h1>
              <p className="text-body text-muted-foreground">
                Here's what's happening with your production today.
              </p>
            </div>
            <WeatherWidget />
          </header>

          {/* Top row: Today's Schedule and Active Colleagues */}
          <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 stagger-children">
            <TodaysSchedule />
            <ActiveOperators />
          </div>

          {/* Work Orders - full width */}
          <section className="animate-slide-up" style={{ animationDelay: '150ms' }}>
            <ProductionOverview />
          </section>

          {/* Recent Activity - full width */}
          <section className="animate-slide-up" style={{ animationDelay: '200ms' }}>
            <RecentActivity />
          </section>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default Index;
