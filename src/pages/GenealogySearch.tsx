import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageIdentity } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Loader2 } from 'lucide-react';

const GenealogySearch = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [serialNumber, setSerialNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('recentGenealogySearches');
    return saved ? JSON.parse(saved) : [];
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber.trim()) return;

    setSearching(true);
    try {
      // Check if item exists
      const { data, error } = await supabase
        .from('work_order_items')
        .select('id, serial_number')
        .eq('serial_number', serialNumber.trim().toUpperCase())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error(t('notFound'), { description: `${t('serialNumber')} ${serialNumber} ${t('wasNotFound')}` });
        return;
      }

      // Save to recent searches
      const newSearches = [serialNumber.toUpperCase(), ...recentSearches.filter(s => s !== serialNumber.toUpperCase())].slice(0, 5);
      setRecentSearches(newSearches);
      localStorage.setItem('recentGenealogySearches', JSON.stringify(newSearches));

      // Navigate to genealogy page
      navigate(`/genealogy/${encodeURIComponent(serialNumber.trim().toUpperCase())}`);
    } catch (error) {
      console.error('Error searching:', error);
      toast.error(t('error'), { description: t('searchFailed') });
    } finally {
      setSearching(false);
    }
  };

  const handleQuickSearch = (serial: string) => {
    setSerialNumber(serial);
    navigate(`/genealogy/${encodeURIComponent(serial)}`);
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <PageIdentity 
            title={t('traceability')} 
            description={t('traceabilityDescription')} 
          />

          <div className="max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>{t('searchSerialNumber')}</CardTitle>
                <CardDescription>
                  {t('searchSerialNumberDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="serial">{t('serialNumber')}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="serial"
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                        placeholder="e.g., Q-0001, W-0042, SDM-0001"
                        className="font-mono"
                        autoFocus
                      />
                      <Button type="submit" disabled={searching || !serialNumber.trim()}>
                        {searching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                        <span className="ml-2">{t('search')}</span>
                      </Button>
                    </div>
                  </div>
                </form>

                {recentSearches.length > 0 && (
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">{t('recentSearches')}:</p>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((serial) => (
                        <Button
                          key={serial}
                          variant="outline"
                          size="sm"
                          className="font-mono"
                          onClick={() => handleQuickSearch(serial)}
                        >
                          {serial}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>{t('whatIsTraceability')}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-2">
                <p>{t('traceabilityExplanation')}</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>{t('traceabilityPoint1')}</li>
                  <li>{t('traceabilityPoint2')}</li>
                  <li>{t('traceabilityPoint3')}</li>
                  <li>{t('traceabilityPoint4')}</li>
                  <li>{t('traceabilityPoint5')}</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default GenealogySearch;
