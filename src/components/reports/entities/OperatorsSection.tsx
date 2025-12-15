/**
 * Operators Section Component
 *
 * Displays team members who worked on the production and their contributions.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { Users, CheckCircle } from 'lucide-react';
import type { OperatorSummary } from '@/types/reports';

interface OperatorsSectionProps {
  operators: OperatorSummary[];
  totalSteps?: number;
  compact?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function OperatorsSection({ operators, totalSteps, compact = false }: OperatorsSectionProps) {
  const { language } = useLanguage();

  const maxSteps = operators.length > 0 ? Math.max(...operators.map(o => o.steps_completed)) : 0;

  if (operators.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            {language === 'nl' ? 'Team' : 'Team'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            {language === 'nl' ? 'Geen operators geregistreerd' : 'No operators recorded'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            {language === 'nl' ? 'Team' : 'Team'}
            <Badge variant="secondary" className="ml-auto">
              {operators.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex -space-x-2">
            {operators.slice(0, 5).map(op => (
              <Avatar key={op.id} className="h-8 w-8 border-2 border-background">
                <AvatarImage src={op.avatar_url || undefined} />
                <AvatarFallback className="text-xs">{getInitials(op.full_name)}</AvatarFallback>
              </Avatar>
            ))}
            {operators.length > 5 && (
              <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                +{operators.length - 5}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            {language === 'nl' ? 'Team' : 'Team'}
          </CardTitle>
          <Badge variant="secondary">
            {operators.length} {language === 'nl' ? 'operators' : 'operators'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {operators.map(op => {
          const percentage = maxSteps > 0 ? (op.steps_completed / maxSteps) * 100 : 0;

          return (
            <div key={op.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
              <Avatar className="h-10 w-10">
                <AvatarImage src={op.avatar_url || undefined} />
                <AvatarFallback>{getInitials(op.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{op.full_name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={percentage} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                    <CheckCircle className="h-3 w-3" />
                    {op.steps_completed}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {totalSteps && (
          <div className="pt-2 mt-2 border-t text-xs text-muted-foreground text-center">
            {language === 'nl' ? 'Totaal' : 'Total'}: {totalSteps}{' '}
            {language === 'nl' ? 'stappen voltooid' : 'steps completed'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OperatorsSection;
