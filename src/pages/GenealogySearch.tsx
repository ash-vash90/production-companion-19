import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, GitBranch, Loader2 } from 'lucide-react';

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
        toast.error('Not Found', { description: `Serial number ${serialNumber} was not found` });
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
      toast.error('Error', { description: 'Failed to search for serial number' });
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
        <div className="space-y-6 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <GitBranch className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Product Genealogy</h1>
            <p className="text-muted-foreground mt-2">
              View complete traceability information for any serial number
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Search Serial Number</CardTitle>
              <CardDescription>
                Enter a product serial number to view its complete production history, linked components, and quality data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="serial">Serial Number</Label>
                  <div className="flex gap-2">
                    <Input
                      id="serial"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                      placeholder="e.g., Q-0001, W-0042, SDM-0001"
                      className="font-mono text-lg"
                      autoFocus
                    />
                    <Button type="submit" disabled={searching || !serialNumber.trim()}>
                      {searching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      <span className="ml-2">Search</span>
                    </Button>
                  </div>
                </div>
              </form>

              {recentSearches.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Recent searches:</p>
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

          <Card>
            <CardHeader>
              <CardTitle>What is Genealogy?</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-2">
              <p>
                Product genealogy provides complete traceability for manufactured items, including:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Production history with timestamps and operator information</li>
                <li>Linked sub-assemblies and component serial numbers</li>
                <li>Material batch numbers used during production</li>
                <li>Quality test results and measurement values</li>
                <li>Quality certificates and compliance documentation</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default GenealogySearch;
