/**
 * Certificates Section Component
 *
 * Displays quality certificates issued for production items.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Award, Download, ExternalLink, User, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { QualityCertificate } from '@/types/reports';

interface CertificatesSectionProps {
  certificates: QualityCertificate[];
  compact?: boolean;
}

export function CertificatesSection({ certificates, compact = false }: CertificatesSectionProps) {
  const { language } = useLanguage();

  const validCertificates = certificates.filter(c => c.pdf_url);

  if (certificates.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4" />
            {language === 'nl' ? 'Kwaliteitscertificaten' : 'Quality Certificates'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            {language === 'nl' ? 'Geen certificaten uitgegeven' : 'No certificates issued'}
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
            <Award className="h-4 w-4" />
            {language === 'nl' ? 'Certificaten' : 'Certificates'}
            <Badge variant="secondary" className="ml-auto">
              {validCertificates.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Award className="h-4 w-4 text-success" />
            {validCertificates.length} {language === 'nl' ? 'uitgegeven' : 'issued'}
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
            <Award className="h-4 w-4" />
            {language === 'nl' ? 'Kwaliteitscertificaten' : 'Quality Certificates'}
          </CardTitle>
          <Badge variant="secondary">
            {validCertificates.length} / {certificates.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {certificates.map(cert => (
          <div
            key={cert.id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-semibold">
                  {cert.serial_number}
                </Badge>
                {cert.pdf_url ? (
                  <Badge variant="default" className="bg-success text-success-foreground text-xs">
                    {language === 'nl' ? 'Uitgegeven' : 'Issued'}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {language === 'nl' ? 'In behandeling' : 'Pending'}
                  </Badge>
                )}
              </div>
              {cert.generated_at && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(parseISO(cert.generated_at), 'dd MMM yyyy, HH:mm')}
                  </span>
                  {cert.generated_by_name && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {cert.generated_by_name}
                    </span>
                  )}
                </div>
              )}
            </div>
            {cert.pdf_url && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => window.open(cert.pdf_url!, '_blank')}
              >
                <Download className="h-3 w-3 mr-1" />
                PDF
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default CertificatesSection;
