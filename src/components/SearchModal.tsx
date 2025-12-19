import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Package, FileText, X, Command, Boxes } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatProductType, cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useIsMobile } from '@/hooks/use-mobile';

interface SearchResult {
  type: 'work_order' | 'serial_number' | 'material' | 'batch';
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
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Debounce search
  const debouncedQuery = useDebounce(query, 300);

  // Handle animation states for mobile
  useEffect(() => {
    if (open) {
      setIsVisible(true);
      // Focus input after mount
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      // Keep visible during exit animation
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Lock background scroll on mobile while the fullscreen search is visible
  useEffect(() => {
    if (!isMobile) return;
    if (!isVisible) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isMobile, isVisible]);

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
        // Run all searches in parallel
        const [workOrdersRes, itemsRes, materialsRes, stockRes] = await Promise.all([
          supabase
            .from('work_orders')
            .select('id, wo_number, product_type, status')
            .ilike('wo_number', `%${q}%`)
            .neq('status', 'cancelled')
            .limit(4),
          supabase
            .from('work_order_items')
            .select('id, serial_number, status, work_order:work_orders(wo_number)')
            .ilike('serial_number', `%${q}%`)
            .limit(4),
          supabase
            .from('materials')
            .select('id, name, sku, material_type, active')
            .or(`name.ilike.%${q}%,sku.ilike.%${q}%,material_type.ilike.%${q}%`)
            .limit(3),
          supabase
            .from('inventory_stock')
            .select('id, batch_number, quantity_on_hand, material:materials(name)')
            .ilike('batch_number', `%${q}%`)
            .limit(3)
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

        for (const mat of materialsRes.data || []) {
          searchResults.push({
            type: 'material',
            id: mat.id,
            title: mat.name,
            subtitle: `SKU: ${mat.sku}`,
            status: mat.active ? 'active' : 'inactive',
          });
        }

        for (const stock of stockRes.data || []) {
          if (stock.batch_number) {
            const mat = stock.material as any;
            searchResults.push({
              type: 'batch',
              id: stock.id,
              title: stock.batch_number,
              subtitle: mat?.name || 'Unknown material',
              status: stock.quantity_on_hand > 0 ? 'in_stock' : 'out_of_stock',
            });
          }
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
    } else if (result.type === 'material' || result.type === 'batch') {
      navigate('/inventory');
    } else {
      navigate(`/genealogy/${encodeURIComponent(result.id)}`);
    }
    onOpenChange(false);
  }, [navigate, onOpenChange]);

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
      onOpenChange(false);
    }
  };

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'completed': return 'bg-success text-success-foreground';
      case 'in_progress': return 'bg-warning text-warning-foreground';
      case 'planned': return 'bg-info text-info-foreground';
      case 'active':
      case 'in_stock': return 'bg-success text-success-foreground';
      case 'inactive':
      case 'out_of_stock': return 'bg-muted text-muted-foreground';
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
      case 'material':
      case 'batch': return <Boxes className="h-5 w-5 text-primary" />;
      default: return <FileText className="h-5 w-5 text-primary" />;
    }
  }, []);

  const renderResults = () => (
    <>
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
    </>
  );

  // Mobile: Fullscreen overlay with slide-up animation (portaled to document.body to avoid transform/viewport bugs)
  if (isMobile) {
    if (!mounted) return null;
    if (!isVisible && !open) return null;

    const overlay = (
      <div
        className={cn(
          "fixed inset-0 z-[100] flex h-[100dvh] w-[100vw] flex-col overflow-hidden bg-background overscroll-none transition-transform duration-200 ease-out",
          open ? "translate-y-0" : "translate-y-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={t('search')}
      >
        {/* Header with search input and close button */}
        <div className="flex items-center gap-2 border-b border-border bg-background px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
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
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Scrollable results area */}
        <div className="flex-1 overflow-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          {renderResults()}
        </div>
      </div>
    );

    return createPortal(overlay, document.body);
  }

  // Desktop: Standard dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('search')}</DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center border-b border-border bg-muted/30 px-4">
          <Search className="h-5 w-5 text-primary shrink-0" />
          <Input
            value={query}
            onChange={(e) => {
              const val = e.target.value.toUpperCase();
              setQuery(val);
            }}
            onKeyDown={handleKeyDown}
            placeholder={`${t('searchWorkOrdersSerials')}...`}
            className="h-14 border-0 bg-transparent focus-visible:ring-0 text-base pl-3 placeholder:text-muted-foreground/70"
            autoFocus
          />
          {searching && (
            <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
          )}
          <kbd className="hidden lg:inline-flex h-6 items-center gap-1 rounded border bg-background px-2 font-mono text-xs text-muted-foreground">
            <Command className="h-3 w-3" />K
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          {renderResults()}
        </div>

        <div className="hidden lg:flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px]">↑↓</kbd>
              {t('navigate')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px]">↵</kbd>
              {t('select')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px]">esc</kbd>
              {t('close')}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
