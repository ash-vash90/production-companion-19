import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';
import { Moon, Sun, Monitor, Bell, BellOff, Globe } from 'lucide-react';

const PersonalSettings = () => {
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { permission, isEnabled, isSupported, enableNotifications, disableNotifications } = usePushNotifications();

  if (!user) {
    navigate('/auth');
    return null;
  }

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      const success = await enableNotifications();
      if (success) {
        toast.success(t('success'), { description: t('notificationsEnabled') });
      } else if (permission === 'denied') {
        toast.error(t('error'), { description: t('notificationsDenied') });
      }
    } else {
      disableNotifications();
      toast.success(t('success'), { description: t('notificationsDisabled') });
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6 max-w-2xl">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{t('personalSettings')}</h1>
            <p className="text-sm text-muted-foreground">{t('personalSettingsDescription')}</p>
          </div>

          {/* Appearance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('appearance')}</CardTitle>
              <CardDescription className="text-sm">{t('appearanceDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{t('theme')}</Label>
                  <p className="text-xs text-muted-foreground">{t('selectTheme')}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('light')}
                    className="h-8 px-3"
                  >
                    <Sun className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('dark')}
                    className="h-8 px-3"
                  >
                    <Moon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('system')}
                    className="h-8 px-3"
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                {t('notifications')}
              </CardTitle>
              <CardDescription className="text-sm">{t('notificationsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{t('pushNotifications')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {!isSupported 
                      ? t('notificationsNotSupported')
                      : permission === 'denied'
                      ? t('notificationsDenied')
                      : t('pushNotificationsDescription')
                    }
                  </p>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={handleNotificationToggle}
                  disabled={!isSupported || permission === 'denied'}
                />
              </div>
              {permission === 'denied' && (
                <p className="text-xs text-destructive">
                  {t('enableInBrowserSettings')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Language */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t('language')}
              </CardTitle>
              <CardDescription className="text-sm">{t('languageDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">{t('selectLanguage')}</Label>
                  <p className="text-xs text-muted-foreground">{t('currentLanguage')}: {language === 'en' ? 'English' : 'Nederlands'}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant={language === 'en' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLanguage('en')}
                    className="h-8 px-3"
                  >
                    🇬🇧 EN
                  </Button>
                  <Button
                    variant={language === 'nl' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLanguage('nl')}
                    className="h-8 px-3"
                  >
                    🇳🇱 NL
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default PersonalSettings;
