import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  className?: string;
  overscan?: number;
  maxHeight?: number;
}

/**
 * Simple virtualized list component for rendering large lists efficiently.
 * Only renders items that are visible in the viewport plus an overscan buffer.
 */
export function VirtualizedList<T>({ 
  items, 
  renderItem, 
  itemHeight, 
  className = '',
  overscan = 5,
  maxHeight = 600
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(maxHeight);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    const updateHeight = () => {
      setContainerHeight(Math.min(maxHeight, window.innerHeight - 200));
    };

    container.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', updateHeight);
    updateHeight();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateHeight);
    };
  }, [maxHeight]);

  // For small lists, render without virtualization
  if (items.length <= 50) {
    return (
      <div className={className}>
        {items.map((item, index) => (
          <div key={index}>{renderItem(item, index)}</div>
        ))}
      </div>
    );
  }

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / itemHeight) + 2 * overscan;
  const endIndex = Math.min(items.length, startIndex + visibleCount);

  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  return (
    <div 
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight, position: 'relative' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, i) => (
            <div 
              key={startIndex + i} 
              style={{ height: itemHeight }}
            >
              {renderItem(item, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ResponsiveVirtualizedGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  minItemWidth?: number;
  gap?: number;
  className?: string;
  maxHeight?: number;
  threshold?: number;
}

/**
 * Responsive virtualized grid that calculates columns based on container width.
 * Falls back to regular grid for small item counts.
 */
export function ResponsiveVirtualizedGrid<T>({ 
  items, 
  renderItem, 
  itemHeight, 
  minItemWidth = 280,
  gap = 8,
  className = '',
  maxHeight = 800,
  threshold = 50
}: ResponsiveVirtualizedGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      setDimensions({ 
        width: rect.width, 
        height: Math.min(maxHeight, window.innerHeight - 200) 
      });
    };

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    updateDimensions();
    container.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateDimensions);
    };
  }, [maxHeight]);

  const columnCount = useMemo(() => 
    Math.max(1, Math.floor((dimensions.width || 300) / minItemWidth)), 
    [dimensions.width, minItemWidth]
  );

  // For small lists or unmeasured container, just render normally without virtualization
  if (items.length <= threshold || dimensions.width === 0) {
    return (
      <div ref={containerRef} className={className}>
        <div 
          className="grid"
          style={{ 
            gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
            gap: gap
          }}
        >
          {items.map((item, index) => (
            <div key={index}>{renderItem(item, index)}</div>
          ))}
        </div>
      </div>
    );
  }

  const rowCount = Math.ceil(items.length / columnCount);
  const totalHeight = rowCount * itemHeight;
  const overscan = 2;

  const startRow = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const visibleRowCount = Math.ceil(dimensions.height / itemHeight) + 2 * overscan;
  const endRow = Math.min(rowCount, startRow + visibleRowCount);

  const offsetY = startRow * itemHeight;

  // Build rows
  const rows = [];
  for (let row = startRow; row < endRow; row++) {
    const rowItems = [];
    for (let col = 0; col < columnCount; col++) {
      const index = row * columnCount + col;
      if (index < items.length) {
        rowItems.push(
          <div key={col} style={{ flex: `0 0 calc(${100 / columnCount}% - ${gap}px)` }}>
            {renderItem(items[index], index)}
          </div>
        );
      }
    }
    rows.push(
      <div 
        key={row} 
        style={{ 
          display: 'flex', 
          gap, 
          height: itemHeight,
          paddingBottom: gap / 2,
          paddingTop: gap / 2 
        }}
      >
        {rowItems}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: dimensions.height, position: 'relative' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {rows}
        </div>
      </div>
    </div>
  );
}

export default VirtualizedList;
