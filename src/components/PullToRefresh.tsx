import React from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function PullToRefresh({
  onRefresh,
  children,
  className,
  disabled = false,
}: PullToRefreshProps) {
  const { containerRef, isPulling, isRefreshing, pullDistance, progress } = usePullToRefresh({
    onRefresh,
    threshold: 80,
    disabled,
  });

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-auto', className)}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          'absolute left-0 right-0 flex items-center justify-center transition-opacity duration-200 pointer-events-none z-10',
          (isPulling || isRefreshing) && pullDistance > 10 ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          top: Math.max(0, pullDistance - 40),
          height: 40,
        }}
      >
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-full bg-background border shadow-sm transition-transform',
            progress >= 1 && !isRefreshing && 'scale-110'
          )}
          style={{
            transform: `rotate(${isRefreshing ? 0 : progress * 180}deg)`,
          }}
        >
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : (
            <ArrowDown
              className={cn(
                'h-5 w-5 transition-colors',
                progress >= 1 ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          )}
        </div>
      </div>

      {/* Content with pull offset */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
