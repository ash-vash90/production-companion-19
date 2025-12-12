import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4 md:mb-6">
      <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight truncate">{title}</h1>
        {description && (
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground line-clamp-2 sm:line-clamp-1">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 mt-1 sm:mt-0">
          {actions}
        </div>
      )}
    </div>
  );
}
