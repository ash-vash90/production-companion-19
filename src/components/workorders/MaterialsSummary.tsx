import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export type MaterialsIssuedStatus = 'not_issued' | 'partial' | 'complete';

export interface MaterialItem {
  id?: string;
  name: string;
  sku?: string;
  required: number;
  inStock: number;
  projected?: number;
  shortage?: number;
  issued?: boolean;
  batchNumber?: string;
}

export interface MaterialsSummaryData {
  projected?: number;
  inStock?: number;
  shortage?: number;
  canProduce?: boolean;
  materials?: MaterialItem[];
  issuedMaterials?: MaterialItem[];
}

interface MaterialsSummaryProps {
  summary: MaterialsSummaryData | null;
  issuedStatus: MaterialsIssuedStatus;
  className?: string;
}

const issuedStatusConfig: Record<MaterialsIssuedStatus, {
  icon: React.ReactNode;
  label: { en: string; nl: string };
  variant: 'default' | 'secondary' | 'destructive';
}> = {
  not_issued: {
    icon: <Clock className="h-4 w-4" />,
    label: { en: 'Materials Not Issued', nl: 'Materialen niet uitgegeven' },
    variant: 'secondary',
  },
  partial: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: { en: 'Partially Issued', nl: 'Gedeeltelijk uitgegeven' },
    variant: 'default',
  },
  complete: {
    icon: <CheckCircle className="h-4 w-4" />,
    label: { en: 'Materials Issued', nl: 'Materialen uitgegeven' },
    variant: 'default',
  },
};

export const MaterialsSummary: React.FC<MaterialsSummaryProps> = ({
  summary,
  issuedStatus,
  className,
}) => {
  const { language } = useLanguage();
  
  if (!summary) {
    return null;
  }
  
  const config = issuedStatusConfig[issuedStatus];
  const label = config.label[language as 'en' | 'nl'] || config.label.en;
  
  const canProduce = summary.canProduce ?? (summary.shortage === 0 || summary.shortage === undefined);
  const hasShortage = summary.shortage && summary.shortage > 0;
  
  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            {language === 'nl' ? 'Materialen' : 'Materials'}
          </CardTitle>
          <Badge 
            variant={config.variant}
            className="flex items-center gap-1.5"
          >
            {config.icon}
            {label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Production Status */}
        <div className={cn(
          'rounded-md p-3 flex items-center gap-3',
          canProduce 
            ? 'bg-green-500/10 text-green-700 dark:text-green-400' 
            : 'bg-destructive/10 text-destructive'
        )}>
          {canProduce ? (
            <>
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">
                {language === 'nl' ? 'Kan produceren' : 'Can Produce'}
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">
                {language === 'nl' ? 'Kan niet produceren - Tekort' : 'Cannot Produce - Shortage'}
              </span>
            </>
          )}
        </div>
        
        {/* Stock Summary */}
        {(summary.inStock !== undefined || summary.projected !== undefined) && (
          <div className="grid grid-cols-3 gap-3 text-center">
            {summary.projected !== undefined && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {language === 'nl' ? 'Verwacht' : 'Projected'}
                </p>
                <p className="text-lg font-semibold">{summary.projected}</p>
              </div>
            )}
            {summary.inStock !== undefined && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {language === 'nl' ? 'Op voorraad' : 'In Stock'}
                </p>
                <p className="text-lg font-semibold">{summary.inStock}</p>
              </div>
            )}
            {hasShortage && (
              <div className="space-y-1">
                <p className="text-xs text-destructive">
                  {language === 'nl' ? 'Tekort' : 'Shortage'}
                </p>
                <p className="text-lg font-semibold text-destructive">-{summary.shortage}</p>
              </div>
            )}
          </div>
        )}
        
        {/* Materials List */}
        {summary.materials && summary.materials.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {language === 'nl' ? 'Materialen voor werkorder' : 'Materials for Shop Order'}
            </h4>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {summary.materials.map((material, index) => (
                <div 
                  key={material.id || index}
                  className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50"
                >
                  <span className="truncate flex-1">{material.name}</span>
                  <span className={cn(
                    'font-mono text-xs',
                    material.shortage && material.shortage > 0 && 'text-destructive'
                  )}>
                    {material.inStock}/{material.required}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Issued Materials */}
        {summary.issuedMaterials && summary.issuedMaterials.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {language === 'nl' ? 'Uitgegeven materialen' : 'Issued Materials'}
            </h4>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {summary.issuedMaterials.map((material, index) => (
                <div 
                  key={material.id || index}
                  className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50"
                >
                  <span className="truncate flex-1">{material.name}</span>
                  {material.batchNumber && (
                    <Badge variant="outline" className="font-mono text-xs ml-2">
                      {material.batchNumber}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MaterialsSummary;
