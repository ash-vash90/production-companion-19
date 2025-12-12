import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Filter, X, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export interface FilterState {
  searchTerm: string;
  statusFilter: string;
  productFilter: string;
  customerFilter: string;
  ageFilter: string;
  deliveryMonthFilter: string;
  createdMonthFilter: string;
  batchSizeFilter: string;
}

interface WorkOrderFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  customers: (string | null)[];
  deliveryMonths: string[];
  createdMonths: string[];
}

export function WorkOrderFilters({
  filters,
  onFiltersChange,
  customers,
  deliveryMonths,
  createdMonths,
}: WorkOrderFiltersProps) {
  const { t } = useLanguage();
  const [open, setOpen] = React.useState(false);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      searchTerm: '',
      statusFilter: 'all',
      productFilter: 'all',
      customerFilter: 'all',
      ageFilter: 'all',
      deliveryMonthFilter: 'all',
      createdMonthFilter: 'all',
      batchSizeFilter: 'all',
    });
  };

  const activeFilterCount = [
    filters.statusFilter,
    filters.productFilter,
    filters.customerFilter,
    filters.ageFilter,
    filters.deliveryMonthFilter,
    filters.createdMonthFilter,
    filters.batchSizeFilter,
  ].filter(f => f !== 'all').length;

  return (
    <div className="flex items-center gap-2">
      {/* Search Input */}
      <div className="relative w-[200px] sm:w-[240px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('searchWorkOrders')}
          value={filters.searchTerm}
          onChange={(e) => updateFilter('searchTerm', e.target.value)}
          className="pl-9 h-9 text-sm"
        />
        {filters.searchTerm && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            onClick={() => updateFilter('searchTerm', '')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Filter Popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-2">
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
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAllFilters}>
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

            {/* Delivery Month */}
            {deliveryMonths.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t('deliveryMonth')}</Label>
                <Select value={filters.deliveryMonthFilter} onValueChange={(v) => updateFilter('deliveryMonthFilter', v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allDeliveryMonths')}</SelectItem>
                    {deliveryMonths.map(month => (
                      <SelectItem key={month} value={month}>
                        {format(parseISO(`${month}-01`), 'MMM yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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

      {/* Active filter badges - shown inline */}
      {activeFilterCount > 0 && (
        <div className="hidden md:flex items-center gap-1 flex-wrap">
          {filters.statusFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs h-6 gap-1">
              {t(filters.statusFilter as any)}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('statusFilter', 'all')} />
            </Badge>
          )}
          {filters.productFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs h-6 gap-1">
              {filters.productFilter.replace('_', ' ')}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('productFilter', 'all')} />
            </Badge>
          )}
          {filters.customerFilter !== 'all' && (
            <Badge variant="secondary" className="text-xs h-6 gap-1">
              {filters.customerFilter}
              <X className="h-3 w-3 cursor-pointer" onClick={() => updateFilter('customerFilter', 'all')} />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
