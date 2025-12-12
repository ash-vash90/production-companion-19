import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Filter, X, Search, Layers, RotateCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export interface ReportFilterState {
  searchTerm: string;
  statusFilter: string;
  productFilter: string;
  customerFilter: string;
  ageFilter: string;
  createdMonthFilter: string;
  batchSizeFilter: string;
}

interface ReportFiltersProps {
  filters: ReportFilterState;
  onFiltersChange: (filters: ReportFilterState) => void;
  customers: (string | null)[];
  createdMonths: string[];
  groupBy: string;
  onGroupByChange: (groupBy: string) => void;
  onReset?: () => void;
}

const DEFAULT_FILTERS: ReportFilterState = {
  searchTerm: '',
  statusFilter: 'all',
  productFilter: 'all',
  customerFilter: 'all',
  ageFilter: 'all',
  createdMonthFilter: 'all',
  batchSizeFilter: 'all',
};

export function ReportFilters({
  filters,
  onFiltersChange,
  customers,
  createdMonths,
  groupBy,
  onGroupByChange,
  onReset,
}: ReportFiltersProps) {
  const { t } = useLanguage();
  const [open, setOpen] = React.useState(false);

  const updateFilter = <K extends keyof ReportFilterState>(key: K, value: ReportFilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearAllFilters = () => {
    onFiltersChange(DEFAULT_FILTERS);
    onGroupByChange('none');
  };

  const activeFilterCount = [
    filters.statusFilter,
    filters.productFilter,
    filters.customerFilter,
    filters.ageFilter,
    filters.createdMonthFilter,
    filters.batchSizeFilter,
  ].filter(f => f !== 'all').length;

  const hasActiveFilters = activeFilterCount > 0 || groupBy !== 'none';

  return (
    <div className="flex flex-col gap-3 sm:gap-2">
      {/* Search and Filter Row */}
      <div className="flex items-center gap-2 w-full">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0 sm:flex-none sm:w-[240px] md:w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchWorkOrders')}
            value={filters.searchTerm}
            onChange={(e) => updateFilter('searchTerm', e.target.value)}
            className="pl-9 h-10 sm:h-9 text-sm w-full"
          />
          {filters.searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 sm:h-6 sm:w-6"
              onClick={() => updateFilter('searchTerm', '')}
            >
              <X className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
            </Button>
          )}
        </div>

        {/* Filter Popover */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 sm:h-9 gap-1.5 sm:gap-2 px-3 shrink-0">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">{t('filter')}</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">{t('filter')}</h4>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                    onFiltersChange({...DEFAULT_FILTERS, searchTerm: filters.searchTerm});
                  }}>
                    {t('clearFilters')}
                  </Button>
                )}
              </div>

              <Separator />

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t('status')}</Label>
                <Select value={filters.statusFilter} onValueChange={(v) => updateFilter('statusFilter', v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allStatuses')}</SelectItem>
                    <SelectItem value="planned">{t('planned')}</SelectItem>
                    <SelectItem value="in_progress">{t('inProgressStatus')}</SelectItem>
                    <SelectItem value="completed">{t('completed')}</SelectItem>
                    <SelectItem value="on_hold">{t('onHold')}</SelectItem>
                    <SelectItem value="cancelled">{t('cancelled')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Product Type */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t('productType')}</Label>
                <Select value={filters.productFilter} onValueChange={(v) => updateFilter('productFilter', v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allProducts')}</SelectItem>
                    <SelectItem value="SDM_ECO">SDM ECO</SelectItem>
                    <SelectItem value="SENSOR">Sensor</SelectItem>
                    <SelectItem value="MLA">MLA</SelectItem>
                    <SelectItem value="HMI">HMI</SelectItem>
                    <SelectItem value="TRANSMITTER">Transmitter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Customer */}
              {customers.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t('customer')}</Label>
                  <Select value={filters.customerFilter} onValueChange={(v) => updateFilter('customerFilter', v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('allCustomers')}</SelectItem>
                      {customers.map(customer => (
                        <SelectItem key={customer} value={customer!}>{customer}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Age */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t('age')}</Label>
                <Select value={filters.ageFilter} onValueChange={(v) => updateFilter('ageFilter', v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allAges')}</SelectItem>
                    <SelectItem value="today">{t('today')}</SelectItem>
                    <SelectItem value="week">{t('thisWeek')}</SelectItem>
                    <SelectItem value="month">{t('thisMonth')}</SelectItem>
                    <SelectItem value="older">{t('olderThan30Days')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Created Month */}
              {createdMonths.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t('createdMonth')}</Label>
                  <Select value={filters.createdMonthFilter} onValueChange={(v) => updateFilter('createdMonthFilter', v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('allCreatedMonths')}</SelectItem>
                      {createdMonths.map(month => (
                        <SelectItem key={month} value={month}>
                          {format(parseISO(`${month}-01`), 'MMM yyyy')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Batch Size */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t('batchSize')}</Label>
                <Select value={filters.batchSizeFilter} onValueChange={(v) => updateFilter('batchSizeFilter', v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allSizes')}</SelectItem>
                    <SelectItem value="small">1-5 {t('items')}</SelectItem>
                    <SelectItem value="medium">6-20 {t('items')}</SelectItem>
                    <SelectItem value="large">20+ {t('items')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 sm:h-8 text-xs text-muted-foreground px-2 sm:px-3 shrink-0"
            onClick={clearAllFilters}
          >
            <RotateCcw className="h-3.5 w-3.5 sm:h-3 sm:w-3 sm:mr-1" />
            <span className="hidden sm:inline">{t('reset')}</span>
          </Button>
        )}
      </div>

      {/* Grouping and Active Filters Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
        {/* Grouping Select */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Layers className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-muted-foreground shrink-0" />
          <Select value={groupBy} onValueChange={onGroupByChange}>
            <SelectTrigger className="h-10 sm:h-8 flex-1 sm:w-[160px] text-sm sm:text-xs">
              <SelectValue placeholder={t('groupBy')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('noGrouping') || 'No Grouping'}</SelectItem>
              <SelectItem value="status">{t('byStatus') || 'By Status'}</SelectItem>
              <SelectItem value="product">{t('byProduct') || 'By Product'}</SelectItem>
              <SelectItem value="customer">{t('byCustomer') || 'By Customer'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active filter badges - shown inline on larger screens */}
        {activeFilterCount > 0 && (
          <div className="hidden md:flex items-center gap-1.5 flex-wrap">
            {filters.statusFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs h-6 gap-1 cursor-pointer hover:bg-secondary/80">
                {t(filters.statusFilter as any)}
                <X className="h-3 w-3" onClick={() => updateFilter('statusFilter', 'all')} />
              </Badge>
            )}
            {filters.productFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs h-6 gap-1 cursor-pointer hover:bg-secondary/80">
                {filters.productFilter.replace('_', ' ')}
                <X className="h-3 w-3" onClick={() => updateFilter('productFilter', 'all')} />
              </Badge>
            )}
            {filters.customerFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs h-6 gap-1 cursor-pointer hover:bg-secondary/80">
                {filters.customerFilter}
                <X className="h-3 w-3" onClick={() => updateFilter('customerFilter', 'all')} />
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}