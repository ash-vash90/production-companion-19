import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Package, FileText, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatProductType, cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchResult {
  type: 'work_order' | 'serial_number';
  id: string;
  title: string;
  subtitle: string;
  status: string;
}

const SearchFullscreen = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const touchStartRef = useRef<{ y: number; time: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const debouncedQuery = useDebounce(query, 300);

  // Slide-up animation on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, []);

  // Lock background scroll
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  // Swipe-down gesture to close
  const handleTouchStart = (e: React.TouchEvent) => {
    // Only trigger swipe close when at the top of the results
    const scrollContainer = containerRef.current?.querySelector('[data-scroll-container]');
    if (scrollContainer && scrollContainer.scrollTop > 10) return;
    
    touchStartRef.current = {
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || isClosing) return;
    
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    const duration = Date.now() - touchStartRef.current.time;
    const velocity = deltaY / duration;
    
    // Swipe down with enough distance (100px) or velocity (0.5px/ms)
    if (deltaY > 100 || (deltaY > 50 && velocity > 0.5)) {
      handleClose();
    }
    
    touchStartRef.current = null;
  };

  // Perform search when debounced query changes
  useEffect(() => {
    const performSearch = async () => {
      const q = debouncedQuery.trim().toUpperCase();
      if (!q || q.length < 2) {
        setResults([]);
        return;
      }

      setSearching(true);

      try {
        const [workOrdersRes, itemsRes] = await Promise.all([
          supabase
            .from('work_orders')
            .select('id, wo_number, product_type, status')
            .ilike('wo_number', `%${q}%`)
            .neq('status', 'cancelled')
            .limit(5),
          supabase
            .from('work_order_items')
            .select('id, serial_number, status, work_order:work_orders(wo_number)')
            .ilike('serial_number', `%${q}%`)
            .limit(5),
        ]);

        const searchResults: SearchResult[] = [];

        for (const wo of workOrdersRes.data || []) {
          searchResults.push({
            type: 'work_order',
            id: wo.id,
            title: wo.wo_number,
            subtitle: formatProductType(wo.product_type),
            status: wo.status,
          });
        }

        for (const item of itemsRes.data || []) {
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
    };

    performSearch();
  }, [debouncedQuery]);

  const handleResultClick = useCallback((result: SearchResult) => {
    if (result.type === 'work_order') {
      navigate(`/production/${result.id}`);
    } else {
      navigate(`/genealogy/${encodeURIComponent(result.id)}`);
    }
  }, [navigate]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsVisible(false);
    setTimeout(() => {
      navigate(-1);
    }, 200);
  }, [navigate, isClosing]);

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
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleClose();
    }
  };

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'completed': return 'bg-success text-success-foreground';
      case 'in_progress': return 'bg-warning text-warning-foreground';
      case 'planned': return 'bg-info text-info-foreground';
      case 'on_hold': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  }, []);

  const formatStatus = useCallback((status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }, []);

  const getResultIcon = useCallback((type: SearchResult['type']) => {
    switch (type) {
      case 'work_order': return <Package className="h-5 w-5 text-primary" />;
      case 'serial_number': return <FileText className="h-5 w-5 text-primary" />;
      default: return <FileText className="h-5 w-5 text-primary" />;
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed inset-0 z-[100] flex h-[100dvh] w-[100vw] flex-col overflow-hidden bg-background overscroll-none transition-transform duration-200 ease-out",
        isVisible ? "translate-y-0" : "translate-y-full"
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header with search input and back button */}
      <div className="flex items-center gap-2 border-b border-border bg-background px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={handleClose}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Search className="h-5 w-5 text-primary shrink-0" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            const val = e.target.value.toUpperCase();
            setQuery(val);
          }}
          onKeyDown={handleKeyDown}
          placeholder={`${t('searchWorkOrdersSerials')}...`}
          className="h-10 border-0 bg-transparent focus-visible:ring-0 text-base pl-2 placeholder:text-muted-foreground/70 flex-1"
        />
        {searching && (
          <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
        )}
      </div>

      {/* Scrollable results area */}
      <div 
        data-scroll-container
        className="flex-1 overflow-auto overscroll-contain pb-[env(safe-area-inset-bottom)]"
      >
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
                  {getResultIcon(result.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{result.title}</p>
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
    </div>
  );
};

export default SearchFullscreen;
