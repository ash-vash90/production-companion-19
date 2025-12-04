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

const RoleManagement = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isAdmin, loading: profileLoading } = useUserProfile();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);

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
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
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
        <div className="space-y-6">
          <PageHeader title={t('roleManagement')} description={t('manageUserRoles')} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('systemUsers')}
              </CardTitle>
              <CardDescription>{t('manageUserPermissions')}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">{t('noUsersFound')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-all"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{getRoleIcon(profile.role)}</span>
                          <div>
                            <h4 className="font-medium">{profile.full_name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {t('joined')}: {formatDate(profile.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={getRoleBadgeVariant(profile.role)}>
                          {t(profile.role as any) || profile.role}
                        </Badge>
                        {profile.id !== user.id && (
                          <Select
                            value={profile.role}
                            onValueChange={(value) => handleRoleChange(profile.id, value as 'admin' | 'supervisor' | 'operator' | 'logistics')}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">{t('admin')}</SelectItem>
                              <SelectItem value="supervisor">{t('supervisor')}</SelectItem>
                              <SelectItem value="operator">{t('operator')}</SelectItem>
                              <SelectItem value="logistics">{t('logistics')}</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        {profile.id === user.id && (
                          <span className="text-sm text-muted-foreground italic">
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
            <CardHeader>
              <CardTitle>{t('rolePermissions')}</CardTitle>
              <CardDescription>{t('rolePermissionsDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">👑</span>
                      <h4 className="font-semibold">{t('admin')}</h4>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-8">
                      <li>• {t('fullSystemAccess')}</li>
                      <li>• {t('manageRolesPermission')}</li>
                      <li>• {t('configureSystemWebhooks')}</li>
                      <li>• {t('viewAllData')}</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">👔</span>
                      <h4 className="font-semibold">{t('supervisor')}</h4>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-8">
                      <li>• {t('manageAllWorkOrders')}</li>
                      <li>• {t('assignTasks')}</li>
                      <li>• {t('viewReports')}</li>
                      <li>• {t('approveQuality')}</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">🔧</span>
                      <h4 className="font-semibold">{t('operator')}</h4>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-8">
                      <li>• {t('executeSteps')}</li>
                      <li>• {t('scanBatchMaterials')}</li>
                      <li>• {t('recordMeasurements')}</li>
                      <li>• {t('completeChecklists')}</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">📦</span>
                      <h4 className="font-semibold">{t('logistics')}</h4>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-8">
                      <li>• {t('printLabels')}</li>
                      <li>• {t('trackShipments')}</li>
                      <li>• {t('manageMaterials')}</li>
                      <li>• {t('viewInventory')}</li>
                    </ul>
                  </div>
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