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
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useTheme } from '@/hooks/useTheme';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Moon, Sun, Monitor, Bell, Globe, Camera, Loader2, Mail, 
  AtSign, FileText, CheckCircle, Package, AlertTriangle, Users, 
  Settings, Volume2, VolumeX, Clock, UserCheck, Save, Pencil
} from 'lucide-react';
import { ImageCropDialog } from '@/components/ImageCropDialog';

interface NotificationChannels {
  in_app: boolean;
  push: boolean;
  email: boolean;
}

interface NotificationTypes {
  mentions: boolean;
  assigned_work: boolean;
  work_order_status: boolean;
  step_completions: boolean;
  low_stock: boolean;
  quality_alerts: boolean;
  team_announcements: boolean;
  system_updates: boolean;
}

interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
}

interface NotificationPrefs {
  channels: NotificationChannels;
  types: NotificationTypes;
  quiet_hours: QuietHours;
  sound_enabled: boolean;
}

interface Team {
  id: string;
  name: string;
  name_nl: string | null;
  description: string | null;
  color: string;
  is_lead: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  channels: { in_app: true, push: false, email: false },
  types: {
    mentions: true,
    assigned_work: true,
    work_order_status: true,
    step_completions: false,
    low_stock: false,
    quality_alerts: false,
    team_announcements: true,
    system_updates: false,
  },
  quiet_hours: { enabled: false, start: '22:00', end: '07:00' },
  sound_enabled: true,
};

// Notification type definitions with role requirements
const NOTIFICATION_TYPES = [
  { key: 'mentions', icon: AtSign, roles: ['all'], labelEn: 'Mentions', labelNl: 'Vermeldingen', descEn: 'When tagged in comments', descNl: 'Wanneer getagd in opmerkingen' },
  { key: 'assigned_work', icon: UserCheck, roles: ['all'], labelEn: 'Assigned work', labelNl: 'Toegewezen werk', descEn: 'When work is assigned to me', descNl: 'Wanneer werk aan mij wordt toegewezen' },
  { key: 'work_order_status', icon: FileText, roles: ['all'], labelEn: 'Work order status', labelNl: 'Werkorder status', descEn: 'Status changes on my work orders', descNl: 'Statuswijzigingen op mijn werkorders' },
  { key: 'step_completions', icon: CheckCircle, roles: ['all'], labelEn: 'Step completions', labelNl: 'Stap voltooiingen', descEn: 'When steps are completed', descNl: 'Wanneer stappen worden voltooid' },
  { key: 'low_stock', icon: Package, roles: ['admin', 'supervisor', 'logistics'], labelEn: 'Low stock alerts', labelNl: 'Lage voorraad meldingen', descEn: 'Inventory running low', descNl: 'Voorraad raakt op' },
  { key: 'quality_alerts', icon: AlertTriangle, roles: ['admin', 'supervisor'], labelEn: 'Quality alerts', labelNl: 'Kwaliteitsmeldingen', descEn: 'Quality holds and issues', descNl: 'Kwaliteitsstops en problemen' },
  { key: 'team_announcements', icon: Users, roles: ['all'], labelEn: 'Team announcements', labelNl: 'Team aankondigingen', descEn: 'Team-wide notifications', descNl: 'Teambreed notificaties' },
  { key: 'system_updates', icon: Settings, roles: ['admin', 'supervisor'], labelEn: 'System updates', labelNl: 'Systeemupdates', descEn: 'System changes and updates', descNl: 'Systeemwijzigingen en updates' },
] as const;

const PersonalSettings = () => {
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { profile: contextProfile, refreshProfile, isAdmin, isSupervisor } = useUserProfile();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { permission, isSupported, enableNotifications, disableNotifications } = usePushNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploading, setUploading] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  
  // Profile name editing
  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Get user role for filtering notifications
  const userRole = contextProfile?.role || 'operator';

  useEffect(() => {
    if (user) {
      loadNotificationPrefs();
      loadUserTeams();
    }
  }, [user]);

  useEffect(() => {
    if (contextProfile?.full_name) {
      const parts = contextProfile.full_name.split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
    }
  }, [contextProfile?.full_name]);

  const loadNotificationPrefs = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', user.id)
      .single();
    
    if (data?.notification_prefs && typeof data.notification_prefs === 'object') {
      const prefs = data.notification_prefs as any;
      // Handle both old flat format and new nested format
      if (prefs.channels) {
        setNotificationPrefs({ ...DEFAULT_PREFS, ...prefs });
      } else {
        // Migrate old format to new format
        const migratedPrefs: NotificationPrefs = {
          channels: {
            in_app: prefs.in_app ?? true,
            push: prefs.push ?? false,
            email: prefs.email ?? false,
          },
          types: {
            mentions: prefs.mentions ?? true,
            assigned_work: true,
            work_order_status: prefs.work_order_updates ?? true,
            step_completions: prefs.step_completions ?? false,
            low_stock: false,
            quality_alerts: false,
            team_announcements: true,
            system_updates: false,
          },
          quiet_hours: DEFAULT_PREFS.quiet_hours,
          sound_enabled: true,
        };
        setNotificationPrefs(migratedPrefs);
      }
    }
  };

  const loadUserTeams = async () => {
    if (!user) return;
    setLoadingTeams(true);
    
    try {
      const { data, error } = await supabase
        .from('user_teams' as any)
        .select(`
          is_lead,
          teams:team_id (
            id,
            name,
            name_nl,
            description,
            color
          )
        `)
        .eq('user_id', user.id) as { data: any[] | null; error: any };

      if (error) throw error;

      const userTeams: Team[] = (data || []).map((membership: any) => ({
        id: membership.teams.id,
        name: membership.teams.name,
        name_nl: membership.teams.name_nl,
        description: membership.teams.description,
        color: membership.teams.color,
        is_lead: membership.is_lead,
      }));

      setTeams(userTeams);
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setLoadingTeams(false);
    }
  };

  const updateNotificationPrefs = async (newPrefs: NotificationPrefs) => {
    if (!user) return;
    
    setNotificationPrefs(newPrefs);
    setSavingPrefs(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ notification_prefs: newPrefs as any })
        .eq('id', user.id);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating notification preferences:', error);
      toast.error(t('error'), { description: error.message });
    } finally {
      setSavingPrefs(false);
    }
  };

  const updateChannel = async (channel: keyof NotificationChannels, value: boolean) => {
    const newPrefs = { 
      ...notificationPrefs, 
      channels: { ...notificationPrefs.channels, [channel]: value } 
    };
    
    // Handle push notifications toggle
    if (channel === 'push') {
      if (value) {
        const success = await enableNotifications();
        if (!success && permission === 'denied') {
          toast.error(t('error'), { description: t('notificationsDenied') });
          return;
        }
      } else {
        disableNotifications();
      }
    }
    
    await updateNotificationPrefs(newPrefs);
  };

  const updateNotificationType = async (type: keyof NotificationTypes, value: boolean) => {
    const newPrefs = { 
      ...notificationPrefs, 
      types: { ...notificationPrefs.types, [type]: value } 
    };
    await updateNotificationPrefs(newPrefs);
  };

  const updateQuietHours = async (updates: Partial<QuietHours>) => {
    const newPrefs = { 
      ...notificationPrefs, 
      quiet_hours: { ...notificationPrefs.quiet_hours, ...updates } 
    };
    await updateNotificationPrefs(newPrefs);
  };

  const updateSoundEnabled = async (value: boolean) => {
    const newPrefs = { ...notificationPrefs, sound_enabled: value };
    await updateNotificationPrefs(newPrefs);
  };

  const canSeeNotificationType = (roles: readonly string[]) => {
    if (roles.includes('all')) return true;
    if (isAdmin && roles.includes('admin')) return true;
    if (isSupervisor && roles.includes('supervisor')) return true;
    if (userRole === 'logistics' && roles.includes('logistics')) return true;
    return false;
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

  const handleSaveName = async () => {
    if (!user) return;
    
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!fullName) {
      toast.error(t('error'), { description: language === 'nl' ? 'Naam mag niet leeg zijn' : 'Name cannot be empty' });
      return;
    }

    setSavingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      setEditingName(false);
      toast.success(t('success'), { description: language === 'nl' ? 'Naam bijgewerkt' : 'Name updated' });
    } catch (error: any) {
      toast.error(t('error'), { description: error.message });
    } finally {
      setSavingName(false);
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
        <PageHeader 
          title={t('personalSettings')} 
          description={t('personalSettingsDescription')} 
        />

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Profile */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('profilePhoto')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4">
                  <div className="relative group">
                    <Avatar className="h-20 w-20 ring-2 ring-border transition-all duration-200">
                      {contextProfile?.avatar_url && (
                        <AvatarImage src={contextProfile.avatar_url} alt={displayName} />
                      )}
                      <AvatarFallback className="bg-primary text-primary-foreground text-xl font-medium">
                        {getInitials(displayName)}
                      </AvatarFallback>
                    </Avatar>
                    
                    {uploading && (
                      <div className="absolute inset-0 rounded-full bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                    
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-all duration-200 disabled:opacity-0 shadow-sm hover:scale-105"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                  
                  <div className="flex-1 space-y-3">
                    {editingName ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              {language === 'nl' ? 'Voornaam' : 'First name'}
                            </Label>
                            <Input
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              placeholder={language === 'nl' ? 'Voornaam' : 'First name'}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">
                              {language === 'nl' ? 'Achternaam' : 'Last name'}
                            </Label>
                            <Input
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              placeholder={language === 'nl' ? 'Achternaam' : 'Last name'}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveName} disabled={savingName} className="h-7 text-xs">
                            {savingName ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                            {language === 'nl' ? 'Opslaan' : 'Save'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingName(false)} className="h-7 text-xs">
                            {language === 'nl' ? 'Annuleren' : 'Cancel'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium text-base">{displayName}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setEditingName(true)} className="h-7 w-7 p-0">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {uploading 
                        ? (language === 'nl' ? 'Foto wordt geüpload...' : 'Uploading photo...') 
                        : t('uploadPhotoHint')
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Appearance */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('appearance')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">{t('theme')}</Label>
                    <p className="text-sm text-muted-foreground">{t('selectTheme')}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant={theme === 'light' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTheme('light')}
                      className="h-8 w-8 p-0"
                    >
                      <Sun className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={theme === 'dark' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTheme('dark')}
                      className="h-8 w-8 p-0"
                    >
                      <Moon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={theme === 'system' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTheme('system')}
                      className="h-8 w-8 p-0"
                    >
                      <Monitor className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Language */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {t('language')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">{t('selectLanguage')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('currentLanguage')}: {language === 'en' ? 'English' : 'Nederlands'}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant={language === 'en' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLanguage('en')}
                      className="h-8 px-3 text-sm"
                    >
                      🇬🇧 EN
                    </Button>
                    <Button
                      variant={language === 'nl' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLanguage('nl')}
                      className="h-8 px-3 text-sm"
                    >
                      🇳🇱 NL
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sound & Quiet Hours */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {language === 'nl' ? 'Geluid & Stille uren' : 'Sound & Quiet Hours'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {notificationPrefs.sound_enabled ? (
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <VolumeX className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <Label className="text-sm font-medium">
                        {language === 'nl' ? 'Notificatiegeluiden' : 'Notification sounds'}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {language === 'nl' ? 'Geluid afspelen bij meldingen' : 'Play sound for notifications'}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={notificationPrefs.sound_enabled}
                    onCheckedChange={updateSoundEnabled}
                    disabled={savingPrefs}
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Moon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="text-sm font-medium">
                          {language === 'nl' ? 'Stille uren' : 'Quiet hours'}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {language === 'nl' ? 'Geen push of geluid' : 'No push or sound'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={notificationPrefs.quiet_hours.enabled}
                      onCheckedChange={(v) => updateQuietHours({ enabled: v })}
                      disabled={savingPrefs}
                    />
                  </div>

                  {notificationPrefs.quiet_hours.enabled && (
                    <div className="flex items-center gap-3 pl-7">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">
                          {language === 'nl' ? 'Van' : 'From'}
                        </Label>
                        <Input
                          type="time"
                          value={notificationPrefs.quiet_hours.start}
                          onChange={(e) => updateQuietHours({ start: e.target.value })}
                          className="h-8 w-24 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">
                          {language === 'nl' ? 'Tot' : 'To'}
                        </Label>
                        <Input
                          type="time"
                          value={notificationPrefs.quiet_hours.end}
                          onChange={(e) => updateQuietHours({ end: e.target.value })}
                          className="h-8 w-24 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* My Teams */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {language === 'nl' ? 'Mijn Teams' : 'My Teams'}
                </CardTitle>
                <CardDescription className="text-sm">
                  {language === 'nl' ? 'Teams waar je lid van bent' : 'Teams you are a member of'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTeams ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : teams.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    {language === 'nl' ? 'Je bent nog geen lid van een team' : 'You are not a member of any team yet'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {teams.map((team) => (
                      <div
                        key={team.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50"
                      >
                        <div
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: team.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {language === 'nl' && team.name_nl ? team.name_nl : team.name}
                            </span>
                            {team.is_lead && (
                              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                {language === 'nl' ? 'Teamleider' : 'Team Lead'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                {/* Notification Channels */}
                <div className="space-y-3">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {language === 'nl' ? 'Kanalen' : 'Channels'}
                  </Label>
                  
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{language === 'nl' ? 'In-app notificaties' : 'In-app notifications'}</span>
                    </div>
                    <Switch
                      checked={notificationPrefs.channels.in_app}
                      onCheckedChange={(v) => updateChannel('in_app', v)}
                      disabled={savingPrefs}
                    />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-sm">{t('pushNotifications')}</span>
                        {!isSupported && (
                          <p className="text-xs text-muted-foreground">{t('notificationsNotSupported')}</p>
                        )}
                        {permission === 'denied' && (
                          <p className="text-xs text-destructive">{t('notificationsDenied')}</p>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={notificationPrefs.channels.push}
                      onCheckedChange={(v) => updateChannel('push', v)}
                      disabled={savingPrefs || !isSupported || permission === 'denied'}
                    />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{language === 'nl' ? 'E-mail notificaties' : 'Email notifications'}</span>
                    </div>
                    <Switch
                      checked={notificationPrefs.channels.email}
                      onCheckedChange={(v) => updateChannel('email', v)}
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
                  
                  {NOTIFICATION_TYPES.filter(type => canSeeNotificationType(type.roles)).map((type) => {
                    const Icon = type.icon;
                    return (
                      <div key={type.key} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-sm">
                              {language === 'nl' ? type.labelNl : type.labelEn}
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {language === 'nl' ? type.descNl : type.descEn}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={notificationPrefs.types[type.key as keyof NotificationTypes]}
                          onCheckedChange={(v) => updateNotificationType(type.key as keyof NotificationTypes, v)}
                          disabled={savingPrefs}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
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
