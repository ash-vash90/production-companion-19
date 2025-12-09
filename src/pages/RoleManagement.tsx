import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Users } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
}

const RoleManagement = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isAdmin, loading: profileLoading } = useUserProfile();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);

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
    
    if (isAdmin) {
      fetchUsers();
    }
  }, [user, navigate, isAdmin, profileLoading]);

  const fetchUsers = async () => {
    try {
      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, role, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch user_roles to get authoritative roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      // Create a map of user_id to role from user_roles table
      const rolesMap: Record<string, string> = {};
      (rolesData || []).forEach(r => {
        rolesMap[r.user_id] = r.role;
      });

      // Merge: prefer user_roles if exists, fallback to profiles.role
      const enrichedUsers = (profilesData || []).map(p => ({
        ...p,
        role: rolesMap[p.id] || p.role
      }));

      setUsers(enrichedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(t('error'), { description: t('failedLoadUsers') });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'supervisor' | 'operator' | 'logistics') => {
    try {
      // Update profiles table for display
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (profileError) throw profileError;

      // Update user_roles table (authoritative source)
      // First delete existing role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Then insert new role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: newRole,
          assigned_by: user?.id,
        });

      if (roleError) throw roleError;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'change_role',
        entity_type: 'profile',
        entity_id: userId,
        details: { new_role: newRole },
      });

      // Update local state immediately
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success(t('success'), { description: t('roleUpdated') });
    } catch (error: any) {
      console.error('Error changing role:', error);
      toast.error(t('error'), { description: error.message });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'supervisor': return 'secondary';
      case 'operator': return 'outline';
      case 'logistics': return 'outline';
      default: return 'outline';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return '👑';
      case 'supervisor': return '👔';
      case 'operator': return '🔧';
      case 'logistics': return '📦';
      default: return '👤';
    }
  };

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
        <div className="space-y-4 lg:space-y-6">
          <PageHeader title={t('roleManagement')} description={t('manageUserRoles')} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm lg:text-base">
                <Users className="h-4 w-4" />
                {t('systemUsers')}
              </CardTitle>
              <CardDescription className="text-xs lg:text-sm">{t('manageUserPermissions')}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('noUsersFound')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {users.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg hover:bg-accent/50 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl">{getRoleIcon(profile.role)}</span>
                        <div className="min-w-0">
                          <h4 className="font-medium text-sm truncate">{profile.full_name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {t('joined')}: {formatDate(profile.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 ml-9 sm:ml-0">
                        <Badge variant={getRoleBadgeVariant(profile.role)} className="text-xs">
                          {t(profile.role as any) || profile.role}
                        </Badge>
                        {profile.id !== user.id ? (
                          <Select
                            value={profile.role}
                            onValueChange={(value) => handleRoleChange(profile.id, value as 'admin' | 'supervisor' | 'operator' | 'logistics')}
                          >
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                              <SelectValue placeholder={t('selectRole')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">{t('admin')}</SelectItem>
                              <SelectItem value="supervisor">{t('supervisor')}</SelectItem>
                              <SelectItem value="operator">{t('operator')}</SelectItem>
                              <SelectItem value="logistics">{t('logistics')}</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            ({t('you')})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm lg:text-base">{t('rolePermissions')}</CardTitle>
              <CardDescription className="text-xs lg:text-sm">{t('rolePermissionsDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">👑</span>
                    <h4 className="font-semibold text-sm">{t('admin')}</h4>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-0.5 ml-6">
                    <li>• {t('fullSystemAccess')}</li>
                    <li>• {t('manageRolesPermission')}</li>
                    <li>• {t('configureSystemWebhooks')}</li>
                  </ul>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">👔</span>
                    <h4 className="font-semibold text-sm">{t('supervisor')}</h4>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-0.5 ml-6">
                    <li>• {t('manageAllWorkOrders')}</li>
                    <li>• {t('assignTasks')}</li>
                    <li>• {t('viewReports')}</li>
                  </ul>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🔧</span>
                    <h4 className="font-semibold text-sm">{t('operator')}</h4>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-0.5 ml-6">
                    <li>• {t('executeSteps')}</li>
                    <li>• {t('scanBatchMaterials')}</li>
                    <li>• {t('recordMeasurements')}</li>
                  </ul>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">📦</span>
                    <h4 className="font-semibold text-sm">{t('logistics')}</h4>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-0.5 ml-6">
                    <li>• {t('printLabels')}</li>
                    <li>• {t('trackShipments')}</li>
                    <li>• {t('manageMaterials')}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default RoleManagement;