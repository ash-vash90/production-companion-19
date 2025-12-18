import React from 'react';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, Columns, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewOption = 'cards' | 'table' | 'kanban' | 'list';

interface DataControlsBarProps {
  /** Filter button click handler - opens filter sheet/panel */
  onFilterClick?: () => void;
  /** Whether filters are currently applied */
  hasActiveFilters?: boolean;
  /** Number of active filters (shown as badge) */
  activeFilterCount?: number;
  /** Available view options */
  views?: ViewOption[];
  /** Current view */
  currentView?: ViewOption;
  /** View change handler */
  onViewChange?: (view: ViewOption) => void;
  /** Custom left-side content (replaces default filter button) */
  leftContent?: React.ReactNode;
  /** Custom right-side content (replaces default view toggle) */
  rightContent?: React.ReactNode;
  /** Additional class name */
  className?: string;
}

const VIEW_ICONS: Record<ViewOption, React.ElementType> = {
  cards: LayoutGrid,
  table: List,
  kanban: Columns,
  list: List,
};

/**
 * Data Controls Bar - Layer 4 of the 4-layer layout system
 * Purpose: Control how and what data is shown.
 * 
 * Structure: [ Filter ] [ Sort / Group ]        [ ⬚ ⬚ ⬚ ]
 * Left cluster = data logic
 * Right cluster = view preference
 * 
 * Rules:
 * - ONE row only
 * - All controls same height
 * - Secondary styling
 * - No big labels on mobile
 */
export function DataControlsBar({
  onFilterClick,
  hasActiveFilters = false,
  activeFilterCount,
  views,
  currentView,
  onViewChange,
  leftContent,
  rightContent,
  className,
}: DataControlsBarProps) {
  const showViewToggle = views && views.length > 1 && onViewChange;

  return (
    <div className={cn("flex items-center justify-between gap-4 py-3", className)}>
      {/* Left cluster - Filter/Sort controls */}
      <div className="flex items-center gap-4">
        {leftContent || (
          onFilterClick && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onFilterClick}
              className={cn(
                "h-10 px-4",
                hasActiveFilters && "border-primary text-primary"
              )}
            >
              <Filter className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Filter</span>
              {activeFilterCount && activeFilterCount > 0 && (
                <span className="ml-2 h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          )
        )}
      </div>

      {/* Right cluster - View toggle */}
      <div className="flex items-center gap-4">
        {rightContent || (
          showViewToggle && (
            <div className="flex border rounded-lg overflow-hidden">
              {views.map((view) => {
                const Icon = VIEW_ICONS[view];
                const isActive = currentView === view;
                return (
                  <Button
                    key={view}
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-none h-10 px-3"
                    onClick={() => onViewChange(view)}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
