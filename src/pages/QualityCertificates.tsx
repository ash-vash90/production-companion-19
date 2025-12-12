import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, FileText, Download, Search } from 'lucide-react';
import { format } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

const QualityCertificates = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchCertificates();
  }, [user, navigate]);

  const fetchCertificates = async () => {
    try {
      const { data, error } = await supabase
        .from('quality_certificates')
        .select(`
          *,
          work_order_item:work_order_items(
            serial_number,
            work_order:work_orders(wo_number, product_type)
          )
        `)
        .order('generated_at', { ascending: false });

      if (error) throw error;
      setCertificates(data || []);
    } catch (error) {
      console.error('Error fetching certificates:', error);
      toast.error(t('error'), { description: t('failedLoadWorkOrders') });
    } finally {
      setLoading(false);
    }
  };

  const filteredCertificates = certificates.filter((cert) => {
    const searchLower = searchTerm.toLowerCase();
    const serialNumber = cert.work_order_item?.serial_number?.toLowerCase() || '';
    const woNumber = cert.work_order_item?.work_order?.wo_number?.toLowerCase() || '';
    return serialNumber.includes(searchLower) || woNumber.includes(searchLower);
  });

  if (!user) return null;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <PageHeader title={t('qualityCertificates')} description={t('viewDownloadCertificates')} />

          <Card>
            <CardHeader>
              <CardTitle>{t('certificateSearch')}</CardTitle>
              <CardDescription>{t('findCertificates')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder={t('searchBySerialOrWO')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredCertificates.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <FileText className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
                <h3 className="text-xl font-semibold mb-3">
                  {searchTerm ? t('noMatchingCertificates') : t('noCertificatesYet')}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  {searchTerm ? t('tryDifferentSearchTerm') : t('certificatesWillAppear')}
                </p>
                {searchTerm && (
                  <Button onClick={() => setSearchTerm('')} variant="outline">
                    {t('clearSearch')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('serialNumber')}</TableHead>
                      <TableHead>{t('workOrderNumber')}</TableHead>
                      <TableHead>{t('productType')}</TableHead>
                      <TableHead>{t('generated')}</TableHead>
                      <TableHead>{t('generatedBy')}</TableHead>
                      <TableHead className="text-right">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCertificates.map((cert) => (
                      <TableRow key={cert.id}>
                        <TableCell className="font-mono font-medium">
                          {cert.work_order_item?.serial_number || t('na')}
                        </TableCell>
                        <TableCell className="font-mono">
                          {cert.work_order_item?.work_order?.wo_number || t('na')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {cert.work_order_item?.work_order?.product_type || t('na')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {cert.generated_at 
                            ? format(new Date(cert.generated_at), 'MMM dd, yyyy HH:mm', { locale: language === 'nl' ? nl : enUS }) 
                            : t('na')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {cert.generated_by || t('system')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!cert.pdf_url}
                            onClick={() => cert.pdf_url && window.open(cert.pdf_url, '_blank')}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            {t('download')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default QualityCertificates;
