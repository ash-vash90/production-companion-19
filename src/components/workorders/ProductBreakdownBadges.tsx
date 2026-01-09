import { Badge } from '@/components/ui/badge';
import { ProductBreakdown } from '@/lib/utils';

interface ProductBreakdownBadgesProps {
  breakdown: ProductBreakdown[];
  batchSize?: number;
  compact?: boolean;
  maxVisible?: number;
}

export function ProductBreakdownBadges({
  breakdown,
  batchSize,
  compact = false,
  maxVisible = 3,
}: ProductBreakdownBadgesProps) {
  const visibleItems = breakdown.slice(0, maxVisible);
  const hiddenCount = breakdown.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1.5">
      {breakdown.length > 0 ? (
        <>
          {visibleItems.map((item, idx) => (
            <Badge 
              key={idx} 
              variant="secondary" 
              className={`tabular-nums ${compact ? "text-[10px] px-1.5 py-0" : "text-xs"}`}
            >
              {item.count}× {item.label}
            </Badge>
          ))}
          {hiddenCount > 0 && (
            <Badge variant="outline" className={`tabular-nums ${compact ? "text-[10px] px-1.5 py-0" : "text-xs"}`}>
              +{hiddenCount}
            </Badge>
          )}
        </>
      ) : batchSize ? (
        <span className="text-xs text-muted-foreground tabular-nums">{batchSize} items</span>
      ) : null}
    </div>
  );
}
