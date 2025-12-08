import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useTheme } from '@/hooks/useTheme';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Moon, Sun, Monitor, Bell, Globe, Camera, Loader2, Mail, AtSign, FileText, CheckCircle } from 'lucide-react';
import { ImageCropDialog } from '@/components/ImageCropDialog';

interface NotificationPrefs {
  in_app: boolean;
  push: boolean;
  email: boolean;
  mentions: boolean;
  work_order_updates: boolean;
  step_completions: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  in_app: true,
  push: false,
  email: false,
  mentions: true,
  work_order_updates: true,
  step_completions: false,
};

const PersonalSettings = () => {
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { profile: contextProfile, refreshProfile } = useUserProfile();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { permission, isEnabled, isSupported, enableNotifications, disableNotifications } = usePushNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploading, setUploading] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotificationPrefs();
    }
  }, [user]);

  const loadNotificationPrefs = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', user.id)
      .single();
    
    if (data?.notification_prefs && typeof data.notification_prefs === 'object' && !Array.isArray(data.notification_prefs)) {
      setNotificationPrefs({ ...DEFAULT_PREFS, ...(data.notification_prefs as unknown as NotificationPrefs) });
    }
  };

  const updateNotificationPref = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!user) return;

    const newPrefs = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(newPrefs);
    setSavingPrefs(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ notification_prefs: newPrefs })
        .eq('id', user.id);

      if (error) throw error;
      
      // Handle push notifications toggle
      if (key === 'push') {
        if (value) {
          const success = await enableNotifications();
          if (!success && permission === 'denied') {
            toast.error(t('error'), { description: t('notificationsDenied') });
            setNotificationPrefs(prev => ({ ...prev, push: false }));
          }
        } else {
          disableNotifications();
        }
      }
    } catch (error: any) {
      console.error('Error updating notification preferences:', error);
      toast.error(t('error'), { description: error.message });
      // Revert on error
      setNotificationPrefs(prev => ({ ...prev, [key]: !value }));
    } finally {
      setSavingPrefs(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('error'), { description: t('invalidImageType') });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('error'), { description: t('imageTooLarge') });
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    setSelectedImage(imageUrl);
    setCropDialogOpen(true);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!user) return;

    setUploading(true);
    try {
      const filePath = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedBlob, { upsert: true, contentType: 'image/jpeg' });

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

      await refreshProfile();
      toast.success(t('success'), { description: t('avatarUpdated') });
    } catch (error: any) {
      toast.error(t('error'), { description: error.message });
    } finally {
      setUploading(false);
      if (selectedImage) {
        URL.revokeObjectURL(selectedImage);
        setSelectedImage(null);
      }
    }
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  const displayName = contextProfile?.full_name || user.email || 'User';

  return (
    <ProtectedRoute>
      <Layout>
        <PageHeader title={t('personalSettings')} description={t('personalSettingsDescription')} />

        <div className="space-y-4 max-w-xl">
          {/* Profile Photo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('profilePhoto')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-16 w-16">
                    {contextProfile?.avatar_url && (
                      <AvatarImage src={contextProfile.avatar_url} alt={displayName} />
                    )}
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg font-medium">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Camera className="h-3 w-3" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground">{t('uploadPhotoHint')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('appearance')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">{t('theme')}</Label>
                  <p className="text-[10px] text-muted-foreground">{t('selectTheme')}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('light')}
                    className="h-7 w-7 p-0"
                  >
                    <Sun className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('dark')}
                    className="h-7 w-7 p-0"
                  >
                    <Moon className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme('system')}
                    className="h-7 w-7 p-0"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="h-4 w-4" />
                {t('notifications')}
              </CardTitle>
              <CardDescription className="text-xs">{t('notificationsDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Notification Channels */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {language === 'nl' ? 'Kanalen' : 'Channels'}
                </Label>
                
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs">{language === 'nl' ? 'In-app notificaties' : 'In-app notifications'}</span>
                  </div>
                  <Switch
                    checked={notificationPrefs.in_app}
                    onCheckedChange={(v) => updateNotificationPref('in_app', v)}
                    disabled={savingPrefs}
                  />
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <span className="text-xs">{t('pushNotifications')}</span>
                      {!isSupported && (
                        <p className="text-[10px] text-muted-foreground">{t('notificationsNotSupported')}</p>
                      )}
                      {permission === 'denied' && (
                        <p className="text-[10px] text-destructive">{t('notificationsDenied')}</p>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={notificationPrefs.push}
                    onCheckedChange={(v) => updateNotificationPref('push', v)}
                    disabled={savingPrefs || !isSupported || permission === 'denied'}
                  />
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs">{language === 'nl' ? 'E-mail notificaties' : 'Email notifications'}</span>
                  </div>
                  <Switch
                    checked={notificationPrefs.email}
                    onCheckedChange={(v) => updateNotificationPref('email', v)}
                    disabled={savingPrefs}
                  />
                </div>
              </div>

              <Separator />

              {/* Notification Types */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {language === 'nl' ? 'Meldingen voor' : 'Notify me about'}
                </Label>
                
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs">{language === 'nl' ? 'Wanneer ik word genoemd' : 'When I am mentioned'}</span>
                  </div>
                  <Switch
                    checked={notificationPrefs.mentions}
                    onCheckedChange={(v) => updateNotificationPref('mentions', v)}
                    disabled={savingPrefs}
                  />
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs">{language === 'nl' ? 'Werkorder updates' : 'Work order updates'}</span>
                  </div>
                  <Switch
                    checked={notificationPrefs.work_order_updates}
                    onCheckedChange={(v) => updateNotificationPref('work_order_updates', v)}
                    disabled={savingPrefs}
                  />
                </div>

                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs">{language === 'nl' ? 'Stap voltooiingen' : 'Step completions'}</span>
                  </div>
                  <Switch
                    checked={notificationPrefs.step_completions}
                    onCheckedChange={(v) => updateNotificationPref('step_completions', v)}
                    disabled={savingPrefs}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Language */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4" />
                {t('language')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-medium">{t('selectLanguage')}</Label>
                  <p className="text-[10px] text-muted-foreground">{t('currentLanguage')}: {language === 'en' ? 'English' : 'Nederlands'}</p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant={language === 'en' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLanguage('en')}
                    className="h-7 px-2 text-xs"
                  >
                    🇬🇧 EN
                  </Button>
                  <Button
                    variant={language === 'nl' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLanguage('nl')}
                    className="h-7 px-2 text-xs"
                  >
                    🇳🇱 NL
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {selectedImage && (
          <ImageCropDialog
            open={cropDialogOpen}
            onOpenChange={setCropDialogOpen}
            imageSrc={selectedImage}
            onCropComplete={handleCropComplete}
          />
        )}
      </Layout>
    </ProtectedRoute>
  );
};

export default PersonalSettings;