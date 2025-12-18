import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageIdentity } from '@/components/layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Hash, FileText, BookOpen, Users, Webhook } from 'lucide-react';
import AutomationManager from '@/components/settings/AutomationManager';
import NumberFormatSettings from '@/components/settings/NumberFormatSettings';
import { CertificateTemplateManager } from '@/components/settings/CertificateTemplateManager';
import { WorkInstructionsManager } from '@/components/settings/WorkInstructionsManager';
import { TeamsManager } from '@/components/settings/TeamsManager';

const Settings = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isAdmin, loading: profileLoading } = useUserProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    // Redirect non-admins once we know their role
    if (!profileLoading && !isAdmin) {
      navigate('/');
      return;
    }
  }, [user, navigate, isAdmin, profileLoading]);

  if (!user) return null;

  // Show loading while checking permissions
  if (profileLoading) {
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

  // Non-admins will be redirected by the useEffect
  if (!isAdmin) return null;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-4 sm:space-y-6">
          <PageIdentity title={t('settingsPage')} description={t('configureWebhooks')} />

          <Tabs defaultValue="numbering" className="space-y-4 sm:space-y-6">
            {/* Mobile-optimized tabs - grid on mobile, flex on desktop */}
            <TabsList className="grid grid-cols-3 gap-1 h-auto p-1 sm:inline-flex sm:flex-wrap">
              <TabsTrigger value="numbering" className="gap-1.5 text-xs sm:text-sm px-2 py-1.5 sm:px-3 sm:py-2">
                <Hash className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">Formats</span>
              </TabsTrigger>
              <TabsTrigger value="teams" className="gap-1.5 text-xs sm:text-sm px-2 py-1.5 sm:px-3 sm:py-2">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">Teams</span>
              </TabsTrigger>
              <TabsTrigger value="instructions" className="gap-1.5 text-xs sm:text-sm px-2 py-1.5 sm:px-3 sm:py-2">
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">Instructions</span>
              </TabsTrigger>
              <TabsTrigger value="certificates" className="gap-1.5 text-xs sm:text-sm px-2 py-1.5 sm:px-3 sm:py-2">
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">Certificates</span>
              </TabsTrigger>
              <TabsTrigger value="webhooks" className="gap-1.5 text-xs sm:text-sm px-2 py-1.5 sm:px-3 sm:py-2">
                <Webhook className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="truncate">Webhooks</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="numbering">
              <NumberFormatSettings />
            </TabsContent>

            <TabsContent value="teams">
              <TeamsManager />
            </TabsContent>

            <TabsContent value="instructions">
              <WorkInstructionsManager />
            </TabsContent>

            <TabsContent value="certificates">
              <CertificateTemplateManager />
            </TabsContent>
            
            <TabsContent value="webhooks">
              <AutomationManager />
            </TabsContent>
          </Tabs>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default Settings;
