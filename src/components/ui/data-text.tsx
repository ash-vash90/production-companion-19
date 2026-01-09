import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * DataText - For displaying numeric data, IDs, codes with tabular numbers
 * Use for: counts, prices, quantities, progress values
 */
interface DataTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  /** Apply semibold weight (default: false) */
  bold?: boolean;
  /** Text size variant */
  size?: 'xs' | 'sm' | 'base' | 'lg';
  /** Muted color (default: false) */
  muted?: boolean;
}

const DataText = React.forwardRef<HTMLSpanElement, DataTextProps>(
  ({ className, children, bold = false, size = 'base', muted = false, ...props }, ref) => {
    const sizeClasses = {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'tabular-nums',
          sizeClasses[size],
          bold && 'font-semibold',
          muted && 'text-muted-foreground',
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);
DataText.displayName = 'DataText';

/**
 * CodeText - For displaying identifiers, serial numbers, order numbers
 * Use for: WO numbers, serial numbers, external IDs, batch numbers
 */
interface CodeTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  /** Text size variant */
  size?: 'xs' | 'sm' | 'base' | 'lg';
  /** Muted color (default: false) */
  muted?: boolean;
}

const CodeText = React.forwardRef<HTMLSpanElement, CodeTextProps>(
  ({ className, children, size = 'base', muted = false, ...props }, ref) => {
    const sizeClasses = {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'font-semibold tabular-nums tracking-wide',
          sizeClasses[size],
          muted && 'text-muted-foreground',
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);
CodeText.displayName = 'CodeText';

export { DataText, CodeText };
