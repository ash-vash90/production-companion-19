import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, User } from 'lucide-react';

export function ActiveOperators() {
  const { t } = useLanguage();
  const [operators, setOperators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOperators();
  }, []);

  const fetchOperators = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'operator')
        .limit(5);

      if (error) throw error;
      setOperators(data || []);
    } catch (error) {
      console.error('Error fetching operators:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('activeOperatorsTitle')}</CardTitle>
          <CardDescription>{t('operatorsCurrentlyWorking')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('activeOperatorsTitle')}</CardTitle>
        <CardDescription>{t('operatorsCurrentlyWorking')}</CardDescription>
      </CardHeader>
      <CardContent>
        {operators.length > 0 ? (
          <div className="space-y-3">
            {operators.map((operator) => (
              <div
                key={operator.id}
                className="flex items-center gap-3 rounded-lg border-2 bg-card p-3"
              >
                <Avatar>
                  <AvatarFallback>
                    {operator.full_name?.charAt(0) || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-medium text-sm">{operator.full_name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{operator.role}</div>
                </div>
                <Badge variant="outline" className="bg-accent text-accent-foreground">
                  {t('active')}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('noOperatorsFound')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
