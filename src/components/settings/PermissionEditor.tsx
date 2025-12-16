import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Shield, Save } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface Permission {
  id: string;
  name: string;
  description: string | null;
  category: string;
}

interface RolePermission {
  role: AppRole;
  permission_id: string;
  granted: boolean;
}

const ROLE_CONFIG: { role: AppRole; icon: string; color: string }[] = [
  { role: 'admin', icon: '👑', color: 'default' },
  { role: 'supervisor', icon: '👔', color: 'secondary' },
  { role: 'operator', icon: '🔧', color: 'outline' },
  { role: 'logistics', icon: '📦', color: 'outline' },
];

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  production: 'Production',
  reports: 'Reports',
  inventory: 'Inventory',
  settings: 'Settings',
  quality: 'Quality',
};

export function PermissionEditor() {
  const { t } = useLanguage();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>('admin');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load permissions using raw query since table might not be in types yet
      const { data: permsData, error: permsError } = await supabase
        .from('permissions' as any)
        .select('*')
        .order('category', { ascending: true });
      
      if (permsError) throw permsError;
      
      // Load role permissions
      const { data: rolePermsData, error: rolePermsError } = await supabase
        .from('role_permissions' as any)
        .select('role, permission_id, granted');
      
      if (rolePermsError) throw rolePermsError;
      
      setPermissions((permsData as unknown as Permission[]) || []);
      setRolePermissions((rolePermsData as unknown as RolePermission[]) || []);
    } catch (error) {
      console.error('Failed to load permissions:', error);
      toast.error(t('error'), { description: 'Failed to load permissions' });
    } finally {
      setLoading(false);
    }
  };

  const isPermissionGranted = (role: AppRole, permissionId: string): boolean => {
    const rp = rolePermissions.find(
      (r) => r.role === role && r.permission_id === permissionId
    );
    return rp?.granted ?? false;
  };

  const togglePermission = (role: AppRole, permissionId: string) => {
    const existingIndex = rolePermissions.findIndex(
      (r) => r.role === role && r.permission_id === permissionId
    );

    if (existingIndex >= 0) {
      // Toggle existing permission
      const updated = [...rolePermissions];
      updated[existingIndex] = {
        ...updated[existingIndex],
        granted: !updated[existingIndex].granted,
      };
      setRolePermissions(updated);
    } else {
      // Add new permission grant
      setRolePermissions([
        ...rolePermissions,
        { role, permission_id: permissionId, granted: true },
      ]);
    }
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Get permissions for the selected role
      const rolePerms = rolePermissions.filter((rp) => rp.role === selectedRole);
      
      // Upsert all permissions for this role
      for (const perm of rolePerms) {
        const { error } = await supabase
          .from('role_permissions' as any)
          .upsert(
            {
              role: perm.role,
              permission_id: perm.permission_id,
              granted: perm.granted,
            },
            { onConflict: 'role,permission_id' }
          );
        
        if (error) throw error;
      }
      
      // Also handle permissions that need to be added if they don't exist
      const existingPermIds = rolePerms.map((rp) => rp.permission_id);
      const missingPerms = permissions.filter(
        (p) => !existingPermIds.includes(p.id) && !isPermissionGranted(selectedRole, p.id)
      );
      
      for (const perm of missingPerms) {
        await supabase
          .from('role_permissions' as any)
          .upsert(
            {
              role: selectedRole,
              permission_id: perm.id,
              granted: false,
            },
            { onConflict: 'role,permission_id' }
          );
      }
      
      toast.success(t('success'), { description: 'Permissions saved' });
      setHasChanges(false);
      
      // Reload to get fresh data
      await loadData();
    } catch (error: any) {
      console.error('Failed to save permissions:', error);
      toast.error(t('error'), { description: error.message || 'Failed to save permissions' });
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by category
  const permissionsByCategory = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
              <Shield className="h-5 w-5" />
              {t('rolePermissions')}
            </CardTitle>
            <CardDescription className="text-sm">
              {t('configureRolePermissions') || 'Configure what each role can access'}
            </CardDescription>
          </div>
          {hasChanges && (
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t('saveChanges') || 'Save Changes'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
          <TabsList className="grid w-full grid-cols-4 h-auto">
            {ROLE_CONFIG.map(({ role, icon }) => (
              <TabsTrigger key={role} value={role} className="flex items-center gap-1 text-xs sm:text-sm py-2">
                <span>{icon}</span>
                <span className="hidden sm:inline">{t(role as any) || role}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {ROLE_CONFIG.map(({ role }) => (
            <TabsContent key={role} value={role} className="mt-4">
              <div className="space-y-6">
                {Object.entries(permissionsByCategory).map(([category, perms]) => (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[category] || category}
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {perms.map((perm) => (
                        <div
                          key={perm.id}
                          className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <Checkbox
                            id={`${role}-${perm.id}`}
                            checked={isPermissionGranted(role, perm.id)}
                            onCheckedChange={() => togglePermission(role, perm.id)}
                            disabled={role === 'admin'} // Admins always have all permissions
                          />
                          <div className="grid gap-1">
                            <Label
                              htmlFor={`${role}-${perm.id}`}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {perm.name}
                            </Label>
                            {perm.description && (
                              <p className="text-xs text-muted-foreground">
                                {perm.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              {role === 'admin' && (
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  {t('adminAlwaysFullAccess') || 'Administrators always have full access to all features'}
                </p>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
