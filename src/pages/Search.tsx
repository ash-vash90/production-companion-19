import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageIdentity } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search as SearchIcon, Loader2, Package, FileText, ArrowRight } from 'lucide-react';
import { formatProductType } from '@/lib/utils';

interface SearchResult {
  type: 'work_order' | 'serial_number';
  id: string;
  title: string;
  subtitle: string;
  status: string;
  productType?: string;
}

const Search = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('recentSystemSearches');
    return saved ? JSON.parse(saved) : [];
  });

  const handleSearch = async (searchQuery?: string) => {
    const q = (searchQuery || query).trim().toUpperCase();
    if (!q) return;

    setSearching(true);
    setHasSearched(true);
    setResults([]);

    try {
      const searchResults: SearchResult[] = [];

      // Search work orders by wo_number
      const { data: workOrders, error: woError } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, status, batch_size')
        .ilike('wo_number', `%${q}%`)
        .neq('status', 'cancelled')
        .limit(10);

      if (woError) throw woError;

      for (const wo of workOrders || []) {
        searchResults.push({
          type: 'work_order',
          id: wo.id,
          title: wo.wo_number,
          subtitle: `${formatProductType(wo.product_type)} • ${wo.batch_size} units`,
          status: wo.status,
          productType: wo.product_type,
        });
      }

      // Search work order items by serial_number
      const { data: items, error: itemsError } = await supabase
        .from('work_order_items')
        .select(`
          id,
          serial_number,
          status,
          work_order:work_orders(wo_number, product_type)
        `)
        .ilike('serial_number', `%${q}%`)
        .limit(10);

      if (itemsError) throw itemsError;

      for (const item of items || []) {
        const wo = item.work_order as any;
        searchResults.push({
          type: 'serial_number',
          id: item.serial_number,
          title: item.serial_number,
          subtitle: `${wo?.wo_number || 'Unknown'} • ${formatProductType(wo?.product_type || '')}`,
          status: item.status,
          productType: wo?.product_type,
        });
      }

      setResults(searchResults);

      // Save to recent searches
      if (searchResults.length > 0) {
        const newSearches = [q, ...recentSearches.filter(s => s !== q)].slice(0, 5);
        setRecentSearches(newSearches);
        localStorage.setItem('recentSystemSearches', JSON.stringify(newSearches));
      }
    } catch (error) {
      console.error('Error searching:', error);
      toast.error(t('error'), { description: t('searchFailed') });
    } finally {
      setSearching(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'work_order') {
      navigate(`/production/${result.id}`);
    } else {
      navigate(`/genealogy/${encodeURIComponent(result.id)}`);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success text-success-foreground';
      case 'in_progress': return 'bg-warning text-warning-foreground';
      case 'planned': return 'bg-info text-info-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <PageIdentity 
            title={t('search')} 
            description={t('searchDescription')} 
          />

          <div className="max-w-3xl">
            <Card>
              <CardHeader>
                <CardTitle>{t('searchAnything')}</CardTitle>
                <CardDescription>
                  {t('searchAnythingDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value.toUpperCase())}
                      placeholder={t('searchPlaceholder')}
                      className="font-mono text-lg"
                      autoFocus
                    />
                    <Button type="submit" disabled={searching || !query.trim()} size="lg">
                      {searching ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <SearchIcon className="h-5 w-5" />
                      )}
                      <span className="ml-2">{t('search')}</span>
                    </Button>
                  </div>
                </form>

                {recentSearches.length > 0 && !hasSearched && (
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">{t('recentSearches')}:</p>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((search) => (
                        <Button
                          key={search}
                          variant="outline"
                          size="sm"
                          className="font-mono"
                          onClick={() => {
                            setQuery(search);
                            handleSearch(search);
                          }}
                        >
                          {search}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Search Results */}
            {hasSearched && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>{t('searchResults')}</CardTitle>
                  <CardDescription>
                    {results.length === 0 
                      ? t('noResultsFound')
                      : `${results.length} ${t('resultsFound')}`
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {results.length === 0 ? (
                    <div className="text-center py-8">
                      <SearchIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground">{t('noResultsFoundHint')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {results.map((result, index) => (
                        <div
                          key={`${result.type}-${result.id}-${index}`}
                          onClick={() => handleResultClick(result)}
                          className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              {result.type === 'work_order' ? (
                                <Package className="h-5 w-5 text-primary" />
                              ) : (
                                <FileText className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            <div>
                              <p className="font-mono font-semibold">{result.title}</p>
                              <p className="text-sm text-muted-foreground">{result.subtitle}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={getStatusBadgeClass(result.status)}>
                              {formatStatus(result.status)}
                            </Badge>
                            <Badge variant="outline">
                              {result.type === 'work_order' ? t('workOrder') : t('serialNumber')}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>{t('searchTips')}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-2">
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>{t('searchTip1')}</li>
                  <li>{t('searchTip2')}</li>
                  <li>{t('searchTip3')}</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default Search;
