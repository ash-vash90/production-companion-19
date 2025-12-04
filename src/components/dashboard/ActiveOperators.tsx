import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Users } from 'lucide-react';

export function ActiveOperators() {
  const { language } = useLanguage();
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchColleagues();
  }, []);

  const fetchColleagues = async () => {
    try {
      // Fetch all active colleagues (not just operators)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(6);

      if (error) throw error;
      setColleagues(data || []);
    } catch (error) {
      console.error('Error fetching colleagues:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'supervisor': return 'warning';
      case 'operator': return 'info';
      case 'logistics': return 'secondary';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, { en: string; nl: string }> = {
      admin: { en: 'Admin', nl: 'Admin' },
      supervisor: { en: 'Supervisor', nl: 'Supervisor' },
      operator: { en: 'Operator', nl: 'Operator' },
      logistics: { en: 'Logistics', nl: 'Logistiek' },
    };
    return labels[role]?.[language] || role;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            {language === 'nl' ? 'Je Collega\'s' : 'Your Team'}
          </CardTitle>
          <CardDescription className="text-xs">
            {language === 'nl' ? 'Collega\'s die vandaag werken' : 'Colleagues working today'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          {language === 'nl' ? 'Je Collega\'s' : 'Your Team'}
          {colleagues.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {colleagues.length} {language === 'nl' ? 'online' : 'online'}
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          {language === 'nl' ? 'Collega\'s die vandaag werken' : 'Colleagues working today'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {colleagues.length > 0 ? (
          <div className="space-y-2">
            {colleagues.map((colleague) => (
              <div
                key={colleague.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-2.5 hover:bg-muted/30 transition-colors"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={colleague.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(colleague.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{colleague.full_name}</div>
                </div>
                <Badge variant={getRoleBadgeVariant(colleague.role) as any} className="text-xs shrink-0">
                  {getRoleLabel(colleague.role)}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {language === 'nl' ? 'Geen collega\'s gevonden' : 'No colleagues found'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
