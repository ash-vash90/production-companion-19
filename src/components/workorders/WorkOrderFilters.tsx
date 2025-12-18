import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Filter, X, Search, Layers } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

export interface FilterState {
  searchTerm: string;
  statusFilter: string;
  productFilter: string;
  customerFilter: string;
  ageFilter: string;
  deliveryMonthFilter: string;
  createdMonthFilter: string;
  batchSizeFilter: string;
  assigneeFilter: string;
  unassignedOnly: boolean;
}

export type GroupByOption = 'none' | 'status' | 'deliveryMonth' | 'createdMonth' | 'batchSize' | 'customer';

interface Operator {
  id: string;
  full_name: string;
}

interface WorkOrderFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  customers: (string | null)[];
  deliveryMonths: string[];
  createdMonths: string[];
  operators?: Operator[];
  groupBy: GroupByOption;
  onGroupByChange: (value: GroupByOption) => void;
  hideGroupBy?: boolean;
}

export function WorkOrderFilters({
  filters,
  onFiltersChange,
  customers,
  deliveryMonths,
  createdMonths,
  operators = [],
  groupBy,
  onGroupByChange,
  hideGroupBy = false,
}: WorkOrderFiltersProps) {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [groupOpen, setGroupOpen] = React.useState(false);
  
  // Local filter state for mobile (apply on button click)
  const [localFilters, setLocalFilters] = React.useState<FilterState>(filters);
  
  // Sync local filters when props change or sheet opens
  React.useEffect(() => {
    if (filterOpen) {
      setLocalFilters(filters);
    }
  }, [filterOpen, filters]);

  const updateLocalFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
    setFilterOpen(false);
  };

  const clearLocalFilters = () => {
    const clearedFilters: FilterState = {
      searchTerm: '',
      statusFilter: 'all',
      productFilter: 'all',
      customerFilter: 'all',
      ageFilter: 'all',
      deliveryMonthFilter: 'all',
      createdMonthFilter: 'all',
      batchSizeFilter: 'all',
      assigneeFilter: 'all',
      unassignedOnly: false,
    };
    setLocalFilters(clearedFilters);
  };

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
      assigneeFilter: 'all',
      unassignedOnly: false,
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
    filters.assigneeFilter,
  ].filter(f => f !== 'all').length + (filters.unassignedOnly ? 1 : 0);

  const groupByOptions = [
    { value: 'none', label: t('noGrouping') || 'No Grouping' },
    { value: 'status', label: t('status') || 'Status' },
    { value: 'deliveryMonth', label: t('deliveryMonth') || 'Delivery Month' },
    { value: 'createdMonth', label: t('createdMonth') || 'Created Month' },
    { value: 'batchSize', label: t('batchSize') || 'Batch Size' },
    { value: 'customer', label: t('customer') || 'Customer' },
  ];

  // Local filter count for mobile sheet
  const localActiveFilterCount = [
    localFilters.statusFilter,
    localFilters.productFilter,
    localFilters.customerFilter,
    localFilters.ageFilter,
    localFilters.deliveryMonthFilter,
    localFilters.createdMonthFilter,
    localFilters.batchSizeFilter,
    localFilters.assigneeFilter,
  ].filter(f => f !== 'all').length + (localFilters.unassignedOnly ? 1 : 0);

  // Filter content - shared between popover and sheet
  const renderFilterContent = (isSheet: boolean = false) => {
    const currentFilters = isSheet ? localFilters : filters;
    const updateFn = isSheet ? updateLocalFilter : updateFilter;
    const clearFn = isSheet ? clearLocalFilters : clearAllFilters;
    const count = isSheet ? localActiveFilterCount : activeFilterCount;

    return (
      <div className="space-y-4">
        {!isSheet && (
          <>
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">{t('filter')}</h4>
              {count > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFn}>
                  {t('clearFilters')}
                </Button>
              )}
            </div>
            <Separator />
          </>
        )}

        {/* Status */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t('status')}</Label>
          <Select value={currentFilters.statusFilter} onValueChange={(v) => updateFn('statusFilter', v)}>
            <SelectTrigger className="h-10 text-sm">
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
          <Select value={currentFilters.productFilter} onValueChange={(v) => updateFn('productFilter', v)}>
            <SelectTrigger className="h-10 text-sm">
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
            <Select value={currentFilters.customerFilter} onValueChange={(v) => updateFn('customerFilter', v)}>
              <SelectTrigger className="h-10 text-sm">
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
          <Select value={currentFilters.ageFilter} onValueChange={(v) => updateFn('ageFilter', v)}>
            <SelectTrigger className="h-10 text-sm">
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
            <Select value={currentFilters.deliveryMonthFilter} onValueChange={(v) => updateFn('deliveryMonthFilter', v)}>
              <SelectTrigger className="h-10 text-sm">
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
            <Select value={currentFilters.createdMonthFilter} onValueChange={(v) => updateFn('createdMonthFilter', v)}>
              <SelectTrigger className="h-10 text-sm">
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
          <Select value={currentFilters.batchSizeFilter} onValueChange={(v) => updateFn('batchSizeFilter', v)}>
            <SelectTrigger className="h-10 text-sm">
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

        {/* Assignee Filter */}
        {operators.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('assignedTo') || 'Assigned To'}</Label>
            <Select value={currentFilters.assigneeFilter} onValueChange={(v) => updateFn('assigneeFilter', v)}>
              <SelectTrigger className="h-10 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allAssignees') || 'All Assignees'}</SelectItem>
                <SelectItem value="unassigned">{t('unassigned') || 'Unassigned'}</SelectItem>
                {operators.map(op => (
                  <SelectItem key={op.id} value={op.id}>{op.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2">
      {/* Search Input */}
      <div className="relative flex-1 min-w-0 sm:flex-none sm:w-[240px]">
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

      {/* Filter - Sheet on Mobile, Popover on Desktop */}
      {isMobile ? (
        <>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 gap-2 shrink-0"
            onClick={() => setFilterOpen(true)}
          >
            <Filter className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetContent side="bottom" className="h-[85vh] flex flex-col">
              <SheetHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <SheetTitle>{t('filter')}</SheetTitle>
                  {localActiveFilterCount > 0 && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearLocalFilters}>
                      {t('clearFilters')}
                    </Button>
                  )}
                </div>
              </SheetHeader>
              <ScrollArea className="flex-1 -mx-6 px-6">
                {renderFilterContent(true)}
              </ScrollArea>
              <SheetFooter className="pt-4 border-t mt-4">
                <Button 
                  className="w-full h-12" 
                  onClick={applyFilters}
                >
                  {t('apply') || 'Apply Filters'}
                  {localActiveFilterCount > 0 && ` (${localActiveFilterCount})`}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <Filter className="h-4 w-4" />
              <span>{t('filter')}</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4 bg-popover" align="start">
            {renderFilterContent(false)}
          </PopoverContent>
        </Popover>
      )}

      {/* Group Popover - hidden on mobile and in Kanban view */}
      {!hideGroupBy && !isMobile && (
        <Popover open={groupOpen} onOpenChange={setGroupOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <Layers className="h-4 w-4" />
              <span>{t('groupBy') || 'Group'}</span>
              {groupBy !== 'none' && (
                <Badge variant="secondary" className="h-5 px-1.5 flex items-center justify-center text-xs rounded-full">
                  1
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2 bg-popover" align="start">
            <div className="space-y-1">
              {groupByOptions.map(option => (
                <Button
                  key={option.value}
                  variant={groupBy === option.value ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start text-sm h-8"
                  onClick={() => {
                    onGroupByChange(option.value as GroupByOption);
                    setGroupOpen(false);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Active filter badges - shown inline on desktop */}
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
