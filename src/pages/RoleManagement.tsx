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
import { Loader2, Users, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { InviteUserDialog } from '@/components/settings/InviteUserDialog';
import { PermissionEditor } from '@/components/settings/PermissionEditor';

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
      // Update user_roles table (authoritative source) using upsert on user_id
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: newRole,
          assigned_by: user?.id,
          assigned_at: new Date().toISOString(),
        }, { 
          onConflict: 'user_id'
        });

      if (roleError) throw roleError;

      // Update profiles table for display (secondary)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (profileError) {
        console.warn('Failed to update profiles table:', profileError);
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'change_role',
        entity_type: 'profile',
        entity_id: userId,
        details: { new_role: newRole },
      });

      // Re-fetch users to confirm the change persisted
      await fetchUsers();
      const userName = users.find(u => u.id === userId)?.full_name || 'User';
      toast.success('Role updated', { description: `${userName} is now ${newRole}` });
    } catch (error: any) {
      console.error('Error changing role:', error);
      toast.error('Failed to update role', { description: error.message });
      await fetchUsers();
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

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      // Delete from user_roles first
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      // Delete from profiles
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
      
      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'delete_user',
        entity_type: 'profile',
        entity_id: userId,
        details: { deleted_user: userName },
      });
      
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('User removed', { description: `${userName} has been deleted` });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user', { description: error.message });
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm lg:text-base">
                    <Users className="h-4 w-4" />
                    {t('systemUsers')}
                  </CardTitle>
                  <CardDescription className="text-xs lg:text-sm">{t('manageUserPermissions')}</CardDescription>
                </div>
                <InviteUserDialog onInviteCreated={fetchUsers} />
              </div>
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
                <div className="space-y-3">
                  {users.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl">{getRoleIcon(profile.role)}</span>
                        <div className="min-w-0">
                          <h4 className="font-medium text-base truncate">{profile.full_name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {t('joined')}: {formatDate(profile.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-11 sm:ml-0">
                        <Badge variant={getRoleBadgeVariant(profile.role)} className="text-sm px-3 py-1">
                          {t(profile.role as any) || profile.role}
                        </Badge>
                        {profile.id !== user.id ? (
                          <>
                            <Select
                              value={profile.role}
                              onValueChange={(value) => handleRoleChange(profile.id, value as 'admin' | 'supervisor' | 'operator' | 'logistics')}
                            >
                              <SelectTrigger className="w-[140px] h-9 text-sm">
                                <SelectValue placeholder={t('selectRole')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">{t('admin')}</SelectItem>
                                <SelectItem value="supervisor">{t('supervisor')}</SelectItem>
                                <SelectItem value="operator">{t('operator')}</SelectItem>
                                <SelectItem value="logistics">{t('logistics')}</SelectItem>
                              </SelectContent>
                            </Select>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('deleteUser') || 'Delete User'}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('deleteUserConfirmation') || `Are you sure you want to delete ${profile.full_name}? This action cannot be undone.`}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteUser(profile.id, profile.full_name)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {t('delete')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        ) : (
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

          {/* Dynamic Permission Editor */}
          <PermissionEditor />
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default RoleManagement;