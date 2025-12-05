import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Package, FileText, X, Command } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatProductType, cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface SearchResult {
  type: 'work_order' | 'serial_number';
  id: string;
  title: string;
  subtitle: string;
  status: string;
}

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Global keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange]);

  const handleSearch = useCallback(async (searchQuery: string) => {
    const q = searchQuery.trim().toUpperCase();
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);

    try {
      const searchResults: SearchResult[] = [];

      // Search work orders by wo_number
      const { data: workOrders } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, status')
        .ilike('wo_number', `%${q}%`)
        .neq('status', 'cancelled')
        .limit(5);

      for (const wo of workOrders || []) {
        searchResults.push({
          type: 'work_order',
          id: wo.id,
          title: wo.wo_number,
          subtitle: formatProductType(wo.product_type),
          status: wo.status,
        });
      }

      // Search work order items by serial_number
      const { data: items } = await supabase
        .from('work_order_items')
        .select(`
          id,
          serial_number,
          status,
          work_order:work_orders(wo_number, product_type)
        `)
        .ilike('serial_number', `%${q}%`)
        .limit(5);

      for (const item of items || []) {
        const wo = item.work_order as any;
        searchResults.push({
          type: 'serial_number',
          id: item.serial_number,
          title: item.serial_number,
          subtitle: wo?.wo_number || 'Unknown',
          status: item.status,
        });
      }

      setResults(searchResults);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'work_order') {
      navigate(`/production/${result.id}`);
    } else {
      navigate(`/genealogy/${encodeURIComponent(result.id)}`);
    }
    onOpenChange(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter' && results.length > 0) {
      event.preventDefault();
      handleResultClick(results[selectedIndex]);
    }
  };

  const getStatusColor = (status: string) => {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('search')}</DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center border-b px-4">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <Input
            value={query}
            onChange={(e) => {
              const val = e.target.value.toUpperCase();
              setQuery(val);
              handleSearch(val);
            }}
            onKeyDown={handleKeyDown}
            placeholder={`${t('searchWorkOrdersSerials')}...`}
            className="h-14 border-0 focus-visible:ring-0 text-base pl-3"
            autoFocus
          />
          {searching && (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
          )}
          <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border bg-muted px-2 font-mono text-xs text-muted-foreground">
            <Command className="h-3 w-3" />K
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          {results.length > 0 ? (
            <div className="py-2">
              <div className="px-3 py-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('results')}
                </span>
              </div>
              {results.map((result, index) => (
                <div
                  key={`${result.type}-${result.id}-${index}`}
                  onClick={() => handleResultClick(result)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                    index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {result.type === 'work_order' ? (
                      <Package className="h-5 w-5 text-primary" />
                    ) : (
                      <FileText className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-medium truncate">{result.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {result.type === 'work_order' ? t('workOrder') : t('serialNumber')} • {result.subtitle}
                    </p>
                  </div>
                  <Badge className={cn("text-xs shrink-0", getStatusColor(result.status))}>
                    {formatStatus(result.status)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : query.length >= 2 && !searching ? (
            <div className="py-12 text-center">
              <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t('noResultsFound')}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {t('tryDifferentSearch')}
              </p>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t('searchHint')}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {t('searchByWOorSerial')}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">↑↓</kbd>
              {t('navigate')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">↵</kbd>
              {t('select')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">esc</kbd>
              {t('close')}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
