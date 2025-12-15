/**
 * Labels Section Component
 *
 * Displays label printing status for production items.
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { Printer, CheckCircle, Clock, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ProductionItem } from '@/types/reports';

interface LabelsSectionProps {
  items: ProductionItem[];
  compact?: boolean;
}

export function LabelsSection({ items, compact = false }: LabelsSectionProps) {
  const { language } = useLanguage();

  const printedItems = useMemo(() => items.filter(i => i.label_printed), [items]);
  const unprintedItems = useMemo(() => items.filter(i => !i.label_printed), [items]);

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Printer className="h-4 w-4" />
            {language === 'nl' ? 'Labels' : 'Labels'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            {language === 'nl' ? 'Geen items' : 'No items'}
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
            <Printer className="h-4 w-4" />
            {language === 'nl' ? 'Labels' : 'Labels'}
            <Badge variant="secondary" className="ml-auto">
              {printedItems.length} / {items.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-success" />
            {printedItems.length} {language === 'nl' ? 'geprint' : 'printed'}
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
            <Printer className="h-4 w-4" />
            {language === 'nl' ? 'Labels' : 'Labels'}
          </CardTitle>
          <Badge variant={printedItems.length === items.length ? 'default' : 'secondary'}>
            {printedItems.length} / {items.length} {language === 'nl' ? 'geprint' : 'printed'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {printedItems.map(item => (
          <div
            key={item.id}
            className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <Badge variant="outline" className="font-mono text-xs">
                {item.serial_number}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {item.label_printed_by_name && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {item.label_printed_by_name}
                </span>
              )}
              {item.label_printed_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(parseISO(item.label_printed_at), 'dd MMM, HH:mm')}
                </span>
              )}
            </div>
          </div>
        ))}

        {unprintedItems.length > 0 && (
          <div className="pt-2 mt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              {language === 'nl' ? 'Nog niet geprint' : 'Not yet printed'}:
            </p>
            <div className="flex flex-wrap gap-1">
              {unprintedItems.map(item => (
                <Badge key={item.id} variant="secondary" className="font-mono text-xs">
                  {item.serial_number}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LabelsSection;
