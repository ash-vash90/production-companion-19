import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTheme } from '@/hooks/useTheme';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Moon, Sun, Monitor, Bell, Globe, Camera, Loader2 } from 'lucide-react';

const PersonalSettings = () => {
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { permission, isEnabled, isSupported, enableNotifications, disableNotifications } = usePushNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string | null } | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();
    if (data) setProfile(data);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('error'), { description: t('invalidImageType') });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('error'), { description: t('imageTooLarge') });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } : null);
      toast.success(t('success'), { description: t('avatarUpdated') });
    } catch (error: any) {
      toast.error(t('error'), { description: error.message });
    } finally {
      setUploading(false);
    }
  };

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

  const displayName = profile?.full_name || user.email || 'User';

  return (
    <ProtectedRoute>
      <Layout>
        <PageHeader title={t('personalSettings')} description={t('personalSettingsDescription')} />

        <div className="space-y-4 max-w-2xl">
          {/* Profile Photo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('profilePhoto')}</CardTitle>
              <CardDescription className="text-sm">{t('profilePhotoDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    {profile?.avatar_url && (
                      <AvatarImage src={profile.avatar_url} alt={displayName} />
                    )}
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl font-medium">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{t('uploadPhotoHint')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

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
                <p className="text-xs text-destructive">{t('enableInBrowserSettings')}</p>
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
