import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Plus, Pencil, Trash2, Users, ChevronDown, Loader2, Star, UserPlus } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  name_nl: string | null;
  description: string | null;
  description_nl: string | null;
  color: string;
  is_active: boolean;
  member_count?: number;
}

interface TeamMember {
  id: string;
  user_id: string;
  is_lead: boolean;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
  };
}

interface User {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
}

const TEAM_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#eab308', // yellow
  '#8b5cf6', // purple
  '#ef4444', // red
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ec4899', // pink
];

export function TeamsManager() {
  const { language } = useLanguage();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState({
    name: '',
    name_nl: '',
    description: '',
    description_nl: '',
    color: TEAM_COLORS[0],
    is_active: true,
  });

  useEffect(() => {
    fetchTeams();
    fetchAllUsers();
  }, []);

  const fetchTeams = async () => {
    try {
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams' as any)
        .select('*')
        .order('name') as { data: Team[] | null; error: any };

      if (teamsError) throw teamsError;

      // Get member counts
      const { data: memberCounts, error: countError } = await supabase
        .from('user_teams' as any)
        .select('team_id') as { data: { team_id: string }[] | null; error: any };

      if (countError) throw countError;

      const counts: Record<string, number> = {};
      (memberCounts || []).forEach(m => {
        counts[m.team_id] = (counts[m.team_id] || 0) + 1;
      });

      const teamsWithCounts = (teamsData || []).map(team => ({
        ...team,
        member_count: counts[team.id] || 0,
      }));

      setTeams(teamsWithCounts);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast.error(language === 'nl' ? 'Fout bij laden teams' : 'Error loading teams');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .order('full_name');

      if (error) throw error;
      setAllUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchTeamMembers = async (teamId: string) => {
    setLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from('user_teams' as any)
        .select(`
          id,
          user_id,
          is_lead,
          profiles:user_id (
            id,
            full_name,
            avatar_url,
            role
          )
        `)
        .eq('team_id', teamId) as { data: any[] | null; error: any };

      if (error) throw error;

      const members: TeamMember[] = (data || [])
        .filter((m: any) => m.profiles)
        .map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          is_lead: m.is_lead,
          profile: m.profiles,
        }));

      setTeamMembers(members);
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleOpenDialog = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      setFormData({
        name: team.name,
        name_nl: team.name_nl || '',
        description: team.description || '',
        description_nl: team.description_nl || '',
        color: team.color,
        is_active: team.is_active,
      });
    } else {
      setEditingTeam(null);
      setFormData({
        name: '',
        name_nl: '',
        description: '',
        description_nl: '',
        color: TEAM_COLORS[teams.length % TEAM_COLORS.length],
        is_active: true,
      });
    }
    setDialogOpen(true);
  };

  const handleOpenMembersDialog = async (team: Team) => {
    setSelectedTeam(team);
    await fetchTeamMembers(team.id);
    setMembersDialogOpen(true);
  };

  const handleSaveTeam = async () => {
    try {
      if (editingTeam) {
        const { error } = await supabase
          .from('teams' as any)
          .update({
            name: formData.name,
            name_nl: formData.name_nl || null,
            description: formData.description || null,
            description_nl: formData.description_nl || null,
            color: formData.color,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTeam.id);

        if (error) throw error;
        toast.success(language === 'nl' ? 'Team bijgewerkt' : 'Team updated');
      } else {
        const { error } = await supabase
          .from('teams' as any)
          .insert({
            name: formData.name,
            name_nl: formData.name_nl || null,
            description: formData.description || null,
            description_nl: formData.description_nl || null,
            color: formData.color,
            is_active: formData.is_active,
          });

        if (error) throw error;
        toast.success(language === 'nl' ? 'Team aangemaakt' : 'Team created');
      }

      setDialogOpen(false);
      fetchTeams();
    } catch (error: any) {
      console.error('Error saving team:', error);
      toast.error(language === 'nl' ? 'Fout bij opslaan' : 'Error saving', { description: error.message });
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm(language === 'nl' ? 'Weet je zeker dat je dit team wilt verwijderen?' : 'Are you sure you want to delete this team?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('teams' as any)
        .delete()
        .eq('id', teamId);

      if (error) throw error;
      toast.success(language === 'nl' ? 'Team verwijderd' : 'Team deleted');
      fetchTeams();
    } catch (error: any) {
      console.error('Error deleting team:', error);
      toast.error(language === 'nl' ? 'Fout bij verwijderen' : 'Error deleting', { description: error.message });
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!selectedTeam) return;

    try {
      const { error } = await supabase
        .from('user_teams' as any)
        .insert({
          team_id: selectedTeam.id,
          user_id: userId,
          is_lead: false,
        });

      if (error) throw error;
      toast.success(language === 'nl' ? 'Lid toegevoegd' : 'Member added');
      await fetchTeamMembers(selectedTeam.id);
      fetchTeams();
    } catch (error: any) {
      console.error('Error adding member:', error);
      toast.error(language === 'nl' ? 'Fout bij toevoegen' : 'Error adding', { description: error.message });
    }
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!selectedTeam) return;

    try {
      const { error } = await supabase
        .from('user_teams' as any)
        .delete()
        .eq('id', membershipId);

      if (error) throw error;
      toast.success(language === 'nl' ? 'Lid verwijderd' : 'Member removed');
      await fetchTeamMembers(selectedTeam.id);
      fetchTeams();
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast.error(language === 'nl' ? 'Fout bij verwijderen' : 'Error removing', { description: error.message });
    }
  };

  const handleToggleLead = async (membershipId: string, isLead: boolean) => {
    try {
      const { error } = await supabase
        .from('user_teams' as any)
        .update({ is_lead: isLead })
        .eq('id', membershipId);

      if (error) throw error;
      setTeamMembers(prev => prev.map(m => 
        m.id === membershipId ? { ...m, is_lead: isLead } : m
      ));
    } catch (error: any) {
      console.error('Error toggling lead:', error);
      toast.error(language === 'nl' ? 'Fout bij bijwerken' : 'Error updating');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const nonMembers = allUsers.filter(u => !teamMembers.some(m => m.user_id === u.id));

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                {language === 'nl' ? 'Teams Beheren' : 'Manage Teams'}
              </CardTitle>
              <CardDescription className="text-sm">
                {language === 'nl' 
                  ? 'Maak teams aan en wijs gebruikers toe' 
                  : 'Create teams and assign users'}
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {language === 'nl' ? 'Nieuw Team' : 'New Team'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>{language === 'nl' ? 'Nog geen teams aangemaakt' : 'No teams created yet'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {teams.map(team => (
                <Collapsible
                  key={team.id}
                  open={expandedTeams.has(team.id)}
                  onOpenChange={(open) => {
                    const newExpanded = new Set(expandedTeams);
                    if (open) {
                      newExpanded.add(team.id);
                    } else {
                      newExpanded.delete(team.id);
                    }
                    setExpandedTeams(newExpanded);
                  }}
                >
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div
                      className="h-4 w-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: team.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {language === 'nl' && team.name_nl ? team.name_nl : team.name}
                        </span>
                        {!team.is_active && (
                          <Badge variant="outline" className="text-xs">
                            {language === 'nl' ? 'Inactief' : 'Inactive'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {team.member_count} {language === 'nl' ? 'leden' : 'members'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenMembersDialog(team)}
                        className="h-8 px-2"
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(team)}
                        className="h-8 w-8 p-0"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTeam(team.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedTeams.has(team.id) ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <div className="pl-7 pr-3 py-2 text-sm text-muted-foreground">
                      {team.description || (language === 'nl' ? 'Geen beschrijving' : 'No description')}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Team Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTeam 
                ? (language === 'nl' ? 'Team Bewerken' : 'Edit Team')
                : (language === 'nl' ? 'Nieuw Team' : 'New Team')
              }
            </DialogTitle>
            <DialogDescription>
              {language === 'nl' 
                ? 'Vul de teamgegevens in'
                : 'Enter team details'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{language === 'nl' ? 'Naam (EN)' : 'Name (EN)'} *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Team name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{language === 'nl' ? 'Naam (NL)' : 'Name (NL)'}</Label>
                <Input
                  value={formData.name_nl}
                  onChange={(e) => setFormData({ ...formData, name_nl: e.target.value })}
                  placeholder="Team naam"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{language === 'nl' ? 'Beschrijving' : 'Description'}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={language === 'nl' ? 'Beschrijving...' : 'Description...'}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === 'nl' ? 'Kleur' : 'Color'}</Label>
              <div className="flex flex-wrap gap-2">
                {TEAM_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      formData.color === color 
                        ? 'border-foreground scale-110' 
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>{language === 'nl' ? 'Actief' : 'Active'}</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {language === 'nl' ? 'Annuleren' : 'Cancel'}
            </Button>
            <Button onClick={handleSaveTeam} disabled={!formData.name}>
              {language === 'nl' ? 'Opslaan' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTeam && (
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: selectedTeam.color }}
                />
              )}
              {selectedTeam?.name} - {language === 'nl' ? 'Leden' : 'Members'}
            </DialogTitle>
            <DialogDescription>
              {language === 'nl' 
                ? 'Beheer teamleden en teamleiders'
                : 'Manage team members and leads'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current Members */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {language === 'nl' ? 'Huidige Leden' : 'Current Members'} ({teamMembers.length})
              </Label>
              {loadingMembers ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : teamMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  {language === 'nl' ? 'Nog geen leden' : 'No members yet'}
                </p>
              ) : (
                <ScrollArea className="h-[180px]">
                  <div className="space-y-1 pr-4">
                    {teamMembers.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.profile.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.profile.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">
                            {member.profile.full_name}
                          </span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {member.profile.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant={member.is_lead ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => handleToggleLead(member.id, !member.is_lead)}
                            className="h-7 w-7 p-0"
                            title={language === 'nl' ? 'Teamleider' : 'Team Lead'}
                          >
                            <Star className={`h-3.5 w-3.5 ${member.is_lead ? 'fill-current' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id)}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            <Separator />

            {/* Add Members */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                {language === 'nl' ? 'Leden Toevoegen' : 'Add Members'}
              </Label>
              {nonMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  {language === 'nl' ? 'Alle gebruikers zijn al lid' : 'All users are already members'}
                </p>
              ) : (
                <ScrollArea className="h-[180px]">
                  <div className="space-y-1 pr-4">
                    {nonMembers.map(user => (
                      <div
                        key={user.id}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">
                            {user.full_name}
                          </span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {user.role}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddMember(user.id)}
                          className="h-7"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          {language === 'nl' ? 'Toevoegen' : 'Add'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TeamsManager;
