import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UserProfileData {
  full_name: string;
  avatar_url: string | null;
  role: string;
}

interface UserProfileContextType {
  profile: UserProfileData | null;
  isAdmin: boolean;
  isSupervisor: boolean;
  canManageInventory: boolean;
  permissions: string[];
  hasPermission: (permissionId: string) => boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setIsAdmin(false);
      setIsSupervisor(false);
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch profile data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, role')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Check roles from user_roles table (authoritative source)
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const roles = roleData?.map(r => r.role) || [];
      const userIsAdmin = roles.includes('admin');
      const userIsSupervisor = roles.includes('supervisor');
      
      setIsAdmin(userIsAdmin);
      setIsSupervisor(userIsSupervisor);

      // Fetch permissions for user's role(s)
      if (roles.length > 0) {
        const { data: permData } = await supabase
          .from('role_permissions' as any)
          .select('permission_id')
          .in('role', roles)
          .eq('granted', true);
        
        const userPermissions = (permData as unknown as { permission_id: string }[] || [])
          .map(p => p.permission_id);
        setPermissions([...new Set(userPermissions)]); // Remove duplicates
      } else {
        setPermissions([]);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const refreshProfile = async () => {
    await fetchProfile();
  };

  // Check if user has a specific permission
  const hasPermission = useCallback((permissionId: string): boolean => {
    // Admins always have all permissions
    if (isAdmin) return true;
    return permissions.includes(permissionId);
  }, [isAdmin, permissions]);

  // Computed permission for inventory management
  const canManageInventory = isAdmin || isSupervisor || permissions.includes('manage_inventory');

  return (
    <UserProfileContext.Provider value={{ 
      profile, 
      isAdmin, 
      isSupervisor, 
      canManageInventory, 
      permissions,
      hasPermission,
      loading, 
      refreshProfile 
    }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}
