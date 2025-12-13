import { Badge } from '@/components/ui/badge';
import { Link2 } from 'lucide-react';
import { ProductBreakdown } from '@/lib/utils';

interface ProductBreakdownBadgesProps {
  breakdown: ProductBreakdown[];
  batchSize?: number;
  isMainAssembly?: boolean;
  hasSubassemblies?: boolean;
  compact?: boolean;
  maxVisible?: number;
}

export function ProductBreakdownBadges({
  breakdown,
  batchSize,
  isMainAssembly,
  hasSubassemblies,
  compact = false,
  maxVisible = 2,
}: ProductBreakdownBadgesProps) {
  const showAssemblyBadge = isMainAssembly || hasSubassemblies;
  const visibleItems = breakdown.slice(0, maxVisible);
  const hiddenCount = breakdown.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1">
      {showAssemblyBadge && (
        <Badge variant="outline" className={compact ? "gap-0.5 text-[10px]" : "gap-1 text-xs"}>
          <Link2 className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
          {isMainAssembly ? 'Assembly' : 'Sub'}
        </Badge>
      )}
      {breakdown.length > 0 ? (
        <>
          {visibleItems.map((item, idx) => (
            <Badge key={idx} variant="secondary" className={compact ? "text-[10px]" : "text-xs"}>
              {item.count}× {item.label}
            </Badge>
          ))}
          {hiddenCount > 0 && (
            <Badge variant="secondary" className={compact ? "text-[10px]" : "text-xs"}>
              +{hiddenCount}
            </Badge>
          )}
        </>
      ) : batchSize ? (
        <span className="text-xs text-muted-foreground">{batchSize} items</span>
      ) : null}
    </div>
  );
}
