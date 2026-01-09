/**
 * Materials Section Component
 *
 * Displays batch materials used in production, grouped by serial number.
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { Package, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { BatchMaterial } from '@/types/reports';

interface MaterialsSectionProps {
  materials: BatchMaterial[];
  compact?: boolean;
}

interface GroupedMaterial {
  serialNumber: string;
  materials: BatchMaterial[];
}

export function MaterialsSection({ materials, compact = false }: MaterialsSectionProps) {
  const { t, language } = useLanguage();

  const groupedMaterials = useMemo(() => {
    const groups: Record<string, BatchMaterial[]> = {};
    for (const material of materials) {
      if (!groups[material.serial_number]) {
        groups[material.serial_number] = [];
      }
      groups[material.serial_number].push(material);
    }
    return Object.entries(groups).map(([serialNumber, mats]) => ({
      serialNumber,
      materials: mats.sort((a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime()),
    }));
  }, [materials]);

  const uniqueMaterialTypes = useMemo(() => {
    return [...new Set(materials.map(m => m.material_type))];
  }, [materials]);

  if (materials.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4" />
            {language === 'nl' ? 'Materialen' : 'Materials'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            {language === 'nl' ? 'Geen materialen geregistreerd' : 'No materials recorded'}
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
            <Package className="h-4 w-4" />
            {language === 'nl' ? 'Materialen' : 'Materials'}
            <Badge variant="secondary" className="ml-auto">
              {materials.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {uniqueMaterialTypes.map(type => (
              <Badge key={type} variant="outline">
                {type}
              </Badge>
            ))}
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
            <Package className="h-4 w-4" />
            {language === 'nl' ? 'Materialen' : 'Materials'}
          </CardTitle>
          <Badge variant="secondary">
            {materials.length} {language === 'nl' ? 'scans' : 'scans'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {groupedMaterials.map(({ serialNumber, materials: mats }) => (
          <div key={serialNumber} className="border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b">
              <Badge variant="outline" className="text-xs font-semibold">
                {serialNumber}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {mats.length} {language === 'nl' ? 'materialen' : 'materials'}
              </span>
            </div>
            <div className="space-y-2">
              {mats.map((material, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {material.material_type}
                    </Badge>
                    <span className="font-semibold text-xs text-muted-foreground">
                      {material.batch_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(parseISO(material.scanned_at), 'HH:mm')}
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

export default MaterialsSection;
