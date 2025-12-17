import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Mail, Shield, Clock } from 'lucide-react';
import AvailabilityCalendar from '@/components/profile/AvailabilityCalendar';
import AssignedWorkSection from '@/components/profile/AssignedWorkSection';
import TeamMembershipSection from '@/components/profile/TeamMembershipSection';

interface ProfileData {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  daily_capacity_hours: number;
  is_available: boolean;
  email?: string;
}

const UserProfile: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserProfile();
  const { t } = useLanguage();
  
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Determine which user's profile to show
  const targetUserId = userId || user?.id;
  const isOwnProfile = targetUserId === user?.id;
  const canEdit = isOwnProfile || isAdmin;

  useEffect(() => {
    if (targetUserId) {
      fetchProfile();
    }
  }, [targetUserId]);

  const fetchProfile = async () => {
    if (!targetUserId) return;
    
    setLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (error) throw error;

      // Get email from auth.users if admin viewing another user
      let email: string | undefined;
      if (isOwnProfile && user?.email) {
        email = user.email;
      }

      setProfileData({
        ...profile,
        email,
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500/20 text-red-700 dark:text-red-400';
      case 'supervisor': return 'bg-purple-500/20 text-purple-700 dark:text-purple-400';
      case 'operator': return 'bg-blue-500/20 text-blue-700 dark:text-blue-400';
      case 'logistics': return 'bg-green-500/20 text-green-700 dark:text-green-400';
      default: return 'bg-gray-500/20 text-gray-700 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <Layout>
        <ProtectedRoute>
          <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
            <Skeleton className="h-10 w-32" />
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </CardHeader>
            </Card>
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          </div>
        </ProtectedRoute>
      </Layout>
    );
  }

  if (!profileData) {
    return (
      <Layout>
        <ProtectedRoute>
          <div className="container max-w-4xl mx-auto py-6 px-4">
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold mb-2">User not found</h2>
              <p className="text-muted-foreground mb-4">The requested profile could not be found.</p>
              <Button onClick={() => navigate(-1)}>Go Back</Button>
            </div>
          </div>
        </ProtectedRoute>
      </Layout>
    );
  }

  return (
    <Layout>
      <ProtectedRoute>
        <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
          {/* Back Button */}
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {/* Profile Header */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profileData.avatar_url || undefined} alt={profileData.full_name} />
                  <AvatarFallback className="text-lg">{getInitials(profileData.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold">{profileData.full_name}</h1>
                    <Badge className={`${getRoleBadgeColor(profileData.role)}`}>
                      <Shield className="h-3 w-3 mr-1" />
                      {profileData.role}
                    </Badge>
                    {!profileData.is_available && (
                      <Badge variant="secondary">Unavailable</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    {profileData.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        <span>{profileData.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{profileData.daily_capacity_hours}h daily capacity</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column */}
            <div className="space-y-6">
              <TeamMembershipSection userId={targetUserId!} />
              <AssignedWorkSection userId={targetUserId!} />
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <AvailabilityCalendar userId={targetUserId!} canEdit={canEdit} />
            </div>
          </div>
        </div>
      </ProtectedRoute>
    </Layout>
  );
};

export default UserProfile;
