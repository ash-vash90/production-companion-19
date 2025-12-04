import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Package, FileText, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatProductType } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface SearchResult {
  type: 'work_order' | 'serial_number';
  id: string;
  title: string;
  subtitle: string;
  status: string;
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setShowResults(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = async (searchQuery: string) => {
    const q = searchQuery.trim().toUpperCase();
    if (!q || q.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    setShowResults(true);

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
    } catch (error) {
      console.error('Error searching:', error);
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
    setQuery('');
    setShowResults(false);
    setResults([]);
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
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            const val = e.target.value.toUpperCase();
            setQuery(val);
            handleSearch(val);
          }}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          placeholder={`${t('search')}... (⌘K)`}
          className="h-9 pl-9 pr-9 bg-muted/50 border-border"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-9 w-9"
            onClick={() => {
              setQuery('');
              setResults([]);
              setShowResults(false);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-auto">
          {results.map((result, index) => (
            <div
              key={`${result.type}-${result.id}-${index}`}
              onClick={() => handleResultClick(result)}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                {result.type === 'work_order' ? (
                  <Package className="h-4 w-4 text-primary" />
                ) : (
                  <FileText className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm font-medium truncate">{result.title}</p>
                <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
              </div>
              <Badge className={cn("text-xs", getStatusColor(result.status))}>
                {formatStatus(result.status)}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {showResults && results.length === 0 && query.length >= 2 && !searching && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg z-50 p-4 text-center">
          <p className="text-sm text-muted-foreground">{t('noResultsFound')}</p>
        </div>
      )}
    </div>
  );
}
