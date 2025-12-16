import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserTeam {
  id: string;
  name: string;
  name_nl: string | null;
  description: string | null;
  color: string;
  is_lead: boolean;
}

export function useUserTeams(userId?: string) {
  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTeams = useCallback(async () => {
    if (!userId) {
      setTeams([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
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
        .eq('user_id', userId) as { data: any[] | null; error: any };

      if (fetchError) throw fetchError;

      const userTeams: UserTeam[] = (data || [])
        .filter((m: any) => m.teams)
        .map((membership: any) => ({
          id: membership.teams.id,
          name: membership.teams.name,
          name_nl: membership.teams.name_nl,
          description: membership.teams.description,
          color: membership.teams.color,
          is_lead: membership.is_lead,
        }));

      setTeams(userTeams);
    } catch (err) {
      console.error('Error loading user teams:', err);
      setError(err instanceof Error ? err : new Error('Failed to load teams'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  return { teams, loading, error, refetch: fetchTeams };
}

// Hook to get teams for multiple users at once (for lists)
export function useUsersTeams(userIds: string[]) {
  const [teamsMap, setTeamsMap] = useState<Record<string, UserTeam[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userIds.length === 0) {
      setTeamsMap({});
      setLoading(false);
      return;
    }

    const fetchAllTeams = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_teams' as any)
          .select(`
            user_id,
            is_lead,
            teams:team_id (
              id,
              name,
              name_nl,
              color
            )
          `)
          .in('user_id', userIds) as { data: any[] | null; error: any };

        if (error) throw error;

        const map: Record<string, UserTeam[]> = {};
        userIds.forEach(id => { map[id] = []; });

        (data || []).forEach((membership: any) => {
          if (membership.teams) {
            const userId = membership.user_id;
            if (!map[userId]) map[userId] = [];
            map[userId].push({
              id: membership.teams.id,
              name: membership.teams.name,
              name_nl: membership.teams.name_nl,
              description: null,
              color: membership.teams.color,
              is_lead: membership.is_lead,
            });
          }
        });

        setTeamsMap(map);
      } catch (err) {
        console.error('Error loading users teams:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllTeams();
  }, [userIds.join(',')]);

  return { teamsMap, loading };
}
