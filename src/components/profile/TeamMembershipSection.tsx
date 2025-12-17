import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Users, Loader2, Crown } from 'lucide-react';

interface TeamWithMembership {
  id: string;
  name: string;
  name_nl: string | null;
  description: string | null;
  color: string | null;
  is_lead: boolean;
}

interface TeamMembershipSectionProps {
  userId: string;
}

const TeamMembershipSection: React.FC<TeamMembershipSectionProps> = ({ userId }) => {
  const [teams, setTeams] = useState<TeamWithMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
  }, [userId]);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_teams')
        .select(`
          is_lead,
          team:teams(
            id,
            name,
            name_nl,
            description,
            color
          )
        `)
        .eq('user_id', userId);

      if (error) throw error;

      const teamsData = (data || [])
        .filter((d: any) => d.team)
        .map((d: any) => ({
          id: d.team.id,
          name: d.team.name,
          name_nl: d.team.name_nl,
          description: d.team.description,
          color: d.team.color,
          is_lead: d.is_lead || false,
        }));

      setTeams(teamsData);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          Team Membership
        </CardTitle>
        <CardDescription>
          Teams this user belongs to
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-8 border rounded-lg border-dashed">
            <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-medium mb-1">No team memberships</h3>
            <p className="text-sm text-muted-foreground">
              Not assigned to any teams yet
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center gap-3 p-3 border rounded-lg"
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: team.color || '#6366f1' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{team.name}</span>
                    {team.is_lead && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Crown className="h-3 w-3" />
                        Lead
                      </Badge>
                    )}
                  </div>
                  {team.description && (
                    <p className="text-xs text-muted-foreground truncate">{team.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamMembershipSection;
