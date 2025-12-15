/**
 * Checklists Section Component
 *
 * Displays checklist responses from quality checks.
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { ClipboardCheck, CheckCircle, XCircle, User, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ChecklistResponse } from '@/types/reports';

interface ChecklistsSectionProps {
  responses: ChecklistResponse[];
  compact?: boolean;
}

export function ChecklistsSection({ responses, compact = false }: ChecklistsSectionProps) {
  const { language } = useLanguage();

  const stats = useMemo(() => {
    const passed = responses.filter(r => r.checked).length;
    const failed = responses.filter(r => !r.checked).length;
    return { passed, failed, total: responses.length };
  }, [responses]);

  const groupedBySerial = useMemo(() => {
    const groups: Record<string, ChecklistResponse[]> = {};
    for (const response of responses) {
      if (!groups[response.serial_number]) {
        groups[response.serial_number] = [];
      }
      groups[response.serial_number].push(response);
    }
    return Object.entries(groups);
  }, [responses]);

  if (responses.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            {language === 'nl' ? 'Checklists' : 'Checklists'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            {language === 'nl' ? 'Geen checklist items' : 'No checklist items'}
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
            <ClipboardCheck className="h-4 w-4" />
            {language === 'nl' ? 'Checklists' : 'Checklists'}
            <Badge variant="secondary" className="ml-auto">
              {stats.total}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-success">
              <CheckCircle className="h-4 w-4" />
              {stats.passed}
            </span>
            {stats.failed > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <XCircle className="h-4 w-4" />
                {stats.failed}
              </span>
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
            <ClipboardCheck className="h-4 w-4" />
            {language === 'nl' ? 'Checklists' : 'Checklists'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-success text-success-foreground">
              {stats.passed} {language === 'nl' ? 'OK' : 'Passed'}
            </Badge>
            {stats.failed > 0 && (
              <Badge variant="destructive">
                {stats.failed} {language === 'nl' ? 'Niet OK' : 'Failed'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {groupedBySerial.map(([serialNumber, items]) => (
          <div key={serialNumber} className="border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
              <Badge variant="outline" className="font-mono text-xs">
                {serialNumber}
              </Badge>
            </div>
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex items-start gap-2">
                  {item.checked ? (
                    <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{item.item_text}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {item.checked_by_name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.checked_by_name}
                        </span>
                      )}
                      {item.checked_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(parseISO(item.checked_at), 'HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default ChecklistsSection;
