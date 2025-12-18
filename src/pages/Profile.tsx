import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useTheme } from '@/hooks/useTheme';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  ArrowLeft, Mail, Shield, Clock, Camera, Loader2, Pencil, Save,
  Moon, Sun, Monitor, Bell, Globe, Volume2, VolumeX, Users, Settings,
  AtSign, FileText, CheckCircle, Package, AlertTriangle, UserCheck,
  User, CalendarDays, Briefcase
} from 'lucide-react';
import { ImageCropDialog } from '@/components/ImageCropDialog';
import DateRangeAvailabilityPicker from '@/components/profile/DateRangeAvailabilityPicker';
import AssignedWorkSection from '@/components/profile/AssignedWorkSection';
import TeamMembershipSection from '@/components/profile/TeamMembershipSection';
import { AvailabilityBadge } from '@/components/profile/AvailabilityStatusIndicator';
import { format, isToday, isFuture, startOfDay, endOfDay } from 'date-fns';

interface ProfileData {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  daily_capacity_hours: number;
  is_available: boolean;
  email?: string;
}

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
  color: string;
  is_lead: boolean;
}

interface TodayAvailability {
  reasonType: 'holiday' | 'sick' | 'training' | 'other' | null;
  reason: string | null;
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

const Profile: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { profile: contextProfile, isAdmin, isSupervisor, refreshProfile } = useUserProfile();
  const { theme, setTheme } = useTheme();
  const { permission, isSupported, enableNotifications, disableNotifications } = usePushNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Determine which user's profile to show
  const targetUserId = userId || user?.id;
  const isOwnProfile = targetUserId === user?.id;
  const canEdit = isOwnProfile || isAdmin;

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayAvailability, setTodayAvailability] = useState<TodayAvailability>({ reasonType: null, reason: null });
  
  // Settings state
  const [uploading, setUploading] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  
  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const userRole = contextProfile?.role || 'operator';

  useEffect(() => {
    if (targetUserId) {
      fetchProfile();
      fetchTodayAvailability();
      if (isOwnProfile) {
        loadNotificationPrefs();
        loadUserTeams();
      }
    }
  }, [targetUserId]);

  useEffect(() => {
    if (profileData?.full_name) {
      const parts = profileData.full_name.split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
    }
  }, [profileData?.full_name]);

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

      let email: string | undefined;
      if (isOwnProfile && user?.email) {
        email = user.email;
      }

      setProfileData({ ...profile, email });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayAvailability = async () => {
    if (!targetUserId) return;
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await (supabase
        .from('operator_availability' as any)
        .select('reason_type, reason')
        .eq('user_id', targetUserId)
        .eq('date', today)
        .single() as any);
      
      if (data) {
        setTodayAvailability({
          reasonType: data.reason_type as any,
          reason: data.reason,
        });
      }
    } catch (error) {
      // No availability for today is fine
    }
  };

  const loadNotificationPrefs = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', user.id)
      .single();
    
    if (data?.notification_prefs && typeof data.notification_prefs === 'object') {
      const prefs = data.notification_prefs as any;
      if (prefs.channels) {
        setNotificationPrefs({ ...DEFAULT_PREFS, ...prefs });
      } else {
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
        .select(`is_lead, teams:team_id (id, name, name_nl, color)`)
        .eq('user_id', user.id) as { data: any[] | null; error: any };

      if (error) throw error;

      const userTeams: Team[] = (data || []).map((m: any) => ({
        id: m.teams.id,
        name: m.teams.name,
        name_nl: m.teams.name_nl,
        color: m.teams.color,
        is_lead: m.is_lead,
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

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500/20 text-red-700 dark:text-red-400';
      case 'supervisor': return 'bg-purple-500/20 text-purple-700 dark:text-purple-400';
      case 'operator': return 'bg-blue-500/20 text-blue-700 dark:text-blue-400';
      case 'logistics': return 'bg-green-500/20 text-green-700 dark:text-green-400';
      default: return 'bg-gray-500/20 text-gray-700 dark:text-gray-400';
    }
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
      fetchProfile();
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
      fetchProfile();
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

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
            <Skeleton className="h-10 w-32" />
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-20 w-20 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </CardHeader>
            </Card>
            <Skeleton className="h-96" />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!profileData) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="container max-w-4xl mx-auto py-6 px-4">
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold mb-2">
                {language === 'nl' ? 'Gebruiker niet gevonden' : 'User not found'}
              </h2>
              <Button onClick={() => navigate(-1)}>
                {language === 'nl' ? 'Terug' : 'Go Back'}
              </Button>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
          {/* Back Button (only when viewing another user) */}
          {!isOwnProfile && (
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {language === 'nl' ? 'Terug' : 'Back'}
            </Button>
          )}

          {/* Profile Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="relative">
                  <Avatar className="h-20 w-20 ring-2 ring-border">
                    <AvatarImage src={profileData.avatar_url || undefined} alt={profileData.full_name} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                      {getInitials(profileData.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Availability badge */}
                  <AvailabilityBadge 
                    reasonType={todayAvailability.reasonType} 
                    reason={todayAvailability.reason}
                  />
                  
                  {/* Upload button (own profile only) */}
                  {isOwnProfile && (
                    <>
                      {uploading ? (
                        <div className="absolute inset-0 rounded-full bg-background/80 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 shadow-sm"
                        >
                          <Camera className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </>
                  )}
                </div>
                
                <div className="flex-1 space-y-1">
                  {isOwnProfile && editingName ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder={language === 'nl' ? 'Voornaam' : 'First name'}
                          className="h-9"
                        />
                        <Input
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder={language === 'nl' ? 'Achternaam' : 'Last name'}
                          className="h-9"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveName} disabled={savingName}>
                          {savingName ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                          {language === 'nl' ? 'Opslaan' : 'Save'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingName(false)}>
                          {language === 'nl' ? 'Annuleren' : 'Cancel'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold">{profileData.full_name}</h1>
                        {isOwnProfile && (
                          <Button size="sm" variant="ghost" onClick={() => setEditingName(true)} className="h-7 w-7 p-0">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Badge className={getRoleBadgeColor(profileData.role)}>
                          <Shield className="h-3 w-3 mr-1" />
                          {profileData.role}
                        </Badge>
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
                          <span>{profileData.daily_capacity_hours}h {language === 'nl' ? 'dagcapaciteit' : 'daily capacity'}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs for own profile, simpler view for others */}
          {isOwnProfile ? (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{language === 'nl' ? 'Overzicht' : 'Overview'}</span>
                </TabsTrigger>
                <TabsTrigger value="availability" className="gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <span className="hidden sm:inline">{language === 'nl' ? 'Beschikbaarheid' : 'Availability'}</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">{language === 'nl' ? 'Instellingen' : 'Settings'}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <TeamMembershipSection userId={targetUserId!} />
                  <AssignedWorkSection userId={targetUserId!} />
                </div>
              </TabsContent>

              <TabsContent value="availability">
                <DateRangeAvailabilityPicker userId={targetUserId!} canEdit={canEdit} />
              </TabsContent>

              <TabsContent value="settings" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Appearance */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{t('appearance')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium">{t('theme')}</Label>
                          <p className="text-sm text-muted-foreground">{t('selectTheme')}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button variant={theme === 'light' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('light')} className="h-8 w-8 p-0">
                            <Sun className="h-4 w-4" />
                          </Button>
                          <Button variant={theme === 'dark' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('dark')} className="h-8 w-8 p-0">
                            <Moon className="h-4 w-4" />
                          </Button>
                          <Button variant={theme === 'system' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('system')} className="h-8 w-8 p-0">
                            <Monitor className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium">{t('selectLanguage')}</Label>
                          <p className="text-sm text-muted-foreground">{language === 'en' ? 'English' : 'Nederlands'}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button variant={language === 'en' ? 'default' : 'outline'} size="sm" onClick={() => setLanguage('en')} className="h-8 px-3">
                            🇬🇧 EN
                          </Button>
                          <Button variant={language === 'nl' ? 'default' : 'outline'} size="sm" onClick={() => setLanguage('nl')} className="h-8 px-3">
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
                          {notificationPrefs.sound_enabled ? <Volume2 className="h-4 w-4 text-muted-foreground" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
                          <div>
                            <Label className="text-sm font-medium">{language === 'nl' ? 'Notificatiegeluiden' : 'Notification sounds'}</Label>
                          </div>
                        </div>
                        <Switch checked={notificationPrefs.sound_enabled} onCheckedChange={updateSoundEnabled} disabled={savingPrefs} />
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Moon className="h-4 w-4 text-muted-foreground" />
                            <Label className="text-sm font-medium">{language === 'nl' ? 'Stille uren' : 'Quiet hours'}</Label>
                          </div>
                          <Switch checked={notificationPrefs.quiet_hours.enabled} onCheckedChange={(v) => updateQuietHours({ enabled: v })} disabled={savingPrefs} />
                        </div>

                        {notificationPrefs.quiet_hours.enabled && (
                          <div className="flex items-center gap-3 pl-7">
                            <Input type="time" value={notificationPrefs.quiet_hours.start} onChange={(e) => updateQuietHours({ start: e.target.value })} className="h-8 w-24 text-xs" />
                            <span className="text-muted-foreground">-</span>
                            <Input type="time" value={notificationPrefs.quiet_hours.end} onChange={(e) => updateQuietHours({ end: e.target.value })} className="h-8 w-24 text-xs" />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Notifications */}
                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        {t('notifications')}
                      </CardTitle>
                      <CardDescription>{t('notificationsDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-6 lg:grid-cols-2">
                        {/* Channels */}
                        <div className="space-y-3">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {language === 'nl' ? 'Kanalen' : 'Channels'}
                          </Label>
                          
                          <div className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-3">
                              <Bell className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{language === 'nl' ? 'In-app' : 'In-app'}</span>
                            </div>
                            <Switch checked={notificationPrefs.channels.in_app} onCheckedChange={(v) => updateChannel('in_app', v)} disabled={savingPrefs} />
                          </div>

                          <div className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-3">
                              <Bell className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <span className="text-sm">Push</span>
                                {permission === 'denied' && <p className="text-xs text-destructive">{t('notificationsDenied')}</p>}
                              </div>
                            </div>
                            <Switch checked={notificationPrefs.channels.push} onCheckedChange={(v) => updateChannel('push', v)} disabled={savingPrefs || !isSupported || permission === 'denied'} />
                          </div>

                          <div className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-3">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">Email</span>
                            </div>
                            <Switch checked={notificationPrefs.channels.email} onCheckedChange={(v) => updateChannel('email', v)} disabled={savingPrefs} />
                          </div>
                        </div>

                        {/* Types */}
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
                                  <span className="text-sm">{language === 'nl' ? type.labelNl : type.labelEn}</span>
                                </div>
                                <Switch checked={notificationPrefs.types[type.key as keyof NotificationTypes]} onCheckedChange={(v) => updateNotificationType(type.key as keyof NotificationTypes, v)} disabled={savingPrefs} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            // Viewing another user's profile
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <TeamMembershipSection userId={targetUserId!} />
                <AssignedWorkSection userId={targetUserId!} />
              </div>
              <DateRangeAvailabilityPicker userId={targetUserId!} canEdit={canEdit} />
            </div>
          )}
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

export default Profile;
