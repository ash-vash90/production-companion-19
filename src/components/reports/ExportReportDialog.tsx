import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, FileDown, CheckSquare, Square } from 'lucide-react';

export interface ExportSections {
  overview: boolean;
  statistics: boolean;
  steps: boolean;
  materials: boolean;
  certificates: boolean;
  labels: boolean;
  checklists: boolean;
  operators: boolean;
  activity: boolean;
}

interface ExportReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (sections: ExportSections) => void;
  exporting: boolean;
  woNumber: string;
  sectionCounts: {
    steps: number;
    materials: number;
    certificates: number;
    labels: number;
    checklists: number;
    operators: number;
    activity: number;
  };
}

const STORAGE_KEY = 'export_report_sections';

const defaultSections: ExportSections = {
  overview: true,
  statistics: true,
  steps: true,
  materials: true,
  certificates: true,
  labels: true,
  checklists: false,
  operators: true,
  activity: false,
};

export function ExportReportDialog({
  open,
  onOpenChange,
  onExport,
  exporting,
  woNumber,
  sectionCounts,
}: ExportReportDialogProps) {
  const { t } = useLanguage();
  
  const [sections, setSections] = useState<ExportSections>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : defaultSections;
    } catch {
      return defaultSections;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
  }, [sections]);

  const sectionConfig = [
    { key: 'overview' as const, label: t('overview'), count: null, required: true },
    { key: 'statistics' as const, label: t('summaryStatistics'), count: null },
    { key: 'steps' as const, label: t('productionSteps'), count: sectionCounts.steps },
    { key: 'materials' as const, label: t('batchMaterials'), count: sectionCounts.materials },
    { key: 'certificates' as const, label: t('certificates'), count: sectionCounts.certificates },
    { key: 'labels' as const, label: t('labels'), count: sectionCounts.labels },
    { key: 'checklists' as const, label: t('checklists'), count: sectionCounts.checklists },
    { key: 'operators' as const, label: t('operators'), count: sectionCounts.operators },
    { key: 'activity' as const, label: t('activity'), count: sectionCounts.activity },
  ];

  const selectedCount = Object.values(sections).filter(Boolean).length;
  const totalCount = Object.keys(sections).length;

  const handleSelectAll = () => {
    const newSections = { ...sections };
    Object.keys(newSections).forEach(key => {
      newSections[key as keyof ExportSections] = true;
    });
    setSections(newSections);
  };

  const handleSelectNone = () => {
    setSections({
      ...defaultSections,
      overview: true, // Always keep overview
      statistics: false,
      steps: false,
      materials: false,
      certificates: false,
      labels: false,
      checklists: false,
      operators: false,
      activity: false,
    });
  };

  const toggleSection = (key: keyof ExportSections) => {
    if (key === 'overview') return; // Cannot toggle overview
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = () => {
    onExport(sections);
  };

  // Estimate pages based on selected sections
  const estimatedPages = Math.max(1, Math.ceil(
    (sections.overview ? 0.5 : 0) +
    (sections.statistics ? 0.3 : 0) +
    (sections.steps ? Math.min(sectionCounts.steps * 0.1, 3) : 0) +
    (sections.materials ? Math.min(sectionCounts.materials * 0.05, 1) : 0) +
    (sections.certificates ? Math.min(sectionCounts.certificates * 0.1, 1) : 0) +
    (sections.labels ? Math.min(sectionCounts.labels * 0.05, 0.5) : 0) +
    (sections.checklists ? Math.min(sectionCounts.checklists * 0.03, 1) : 0) +
    (sections.operators ? Math.min(sectionCounts.operators * 0.1, 0.5) : 0) +
    (sections.activity ? Math.min(sectionCounts.activity * 0.05, 1) : 0)
  ));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('exportPdf')}</DialogTitle>
          <DialogDescription className="font-mono text-sm">
            {woNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('selectSections')}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleSelectAll} className="h-7 text-xs px-2">
                <CheckSquare className="h-3 w-3 mr-1" />
                {t('selectAll')}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSelectNone} className="h-7 text-xs px-2">
                <Square className="h-3 w-3 mr-1" />
                {t('selectNone')}
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {sectionConfig.map(({ key, label, count, required }) => (
              <div
                key={key}
                className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                  sections[key] ? 'bg-primary/5' : 'hover:bg-muted/50'
                } ${required ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={key}
                    checked={sections[key]}
                    onCheckedChange={() => toggleSection(key)}
                    disabled={required}
                  />
                  <Label
                    htmlFor={key}
                    className={`text-sm cursor-pointer ${required ? 'cursor-not-allowed' : ''}`}
                  >
                    {label}
                    {required && <span className="text-xs text-muted-foreground ml-1">({t('required')})</span>}
                  </Label>
                </div>
                {count !== null && count > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t text-sm text-muted-foreground">
            <span>{selectedCount} {t('of')} {totalCount} {t('sectionsSelected')}</span>
            <span>~{estimatedPages} {t('estimatedPages')}</span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleExport} disabled={exporting || selectedCount === 0}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            {t('exportPdf')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
