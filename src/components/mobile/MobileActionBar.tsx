/**
 * Mobile Action Bar
 *
 * A bottom-fixed action bar for mobile devices.
 * Provides quick access to common actions with large touch targets.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export interface ActionBarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'primary';
  disabled?: boolean;
  loading?: boolean;
  badge?: number | string;
}

interface MobileActionBarProps {
  actions: ActionBarItem[];
  className?: string;
  showOnDesktop?: boolean;
}

export function MobileActionBar({
  actions,
  className,
  showOnDesktop = false,
}: MobileActionBarProps) {
  const isMobile = useIsMobile();

  // Don't render on desktop unless explicitly requested
  if (!isMobile && !showOnDesktop) {
    return null;
  }

  // Limit to 4 actions max for mobile
  const visibleActions = actions.slice(0, 4);

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'bg-background/95 backdrop-blur-md border-t border-border',
        'px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]',
        'safe-area-pb',
        className
      )}
    >
      <div className="flex items-center justify-around gap-1 max-w-lg mx-auto">
        {visibleActions.map((action) => {
          const Icon = action.icon;
          const buttonVariant = action.variant === 'primary' ? 'default' : action.variant || 'ghost';

          return (
            <Button
              key={action.id}
              variant={buttonVariant}
              size="lg"
              onClick={action.onClick}
              disabled={action.disabled || action.loading}
              className={cn(
                'flex-1 flex-col h-16 gap-1 px-2 rounded-xl',
                'active:scale-95 transition-transform',
                action.variant === 'primary' && 'bg-primary text-primary-foreground shadow-lg'
              )}
            >
              <div className="relative">
                <Icon className={cn('h-5 w-5', action.loading && 'animate-pulse')} />
                {action.badge !== undefined && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                    {action.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-tight truncate max-w-full">
                {action.label}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Floating Action Button for mobile
 */
interface FABProps {
  icon: LucideIcon;
  onClick: () => void;
  label?: string;
  variant?: 'default' | 'destructive';
  position?: 'bottom-right' | 'bottom-center' | 'bottom-left';
  className?: string;
  showOnDesktop?: boolean;
}

export function FloatingActionButton({
  icon: Icon,
  onClick,
  label,
  variant = 'default',
  position = 'bottom-right',
  className,
  showOnDesktop = false,
}: FABProps) {
  const isMobile = useIsMobile();

  if (!isMobile && !showOnDesktop) {
    return null;
  }

  const positionClasses = {
    'bottom-right': 'right-4 bottom-20',
    'bottom-center': 'left-1/2 -translate-x-1/2 bottom-20',
    'bottom-left': 'left-4 bottom-20',
  };

  return (
    <Button
      variant={variant}
      onClick={onClick}
      aria-label={label}
      className={cn(
        'fixed z-40 h-14 rounded-full shadow-lg',
        'active:scale-95 transition-transform',
        'safe-area-bottom',
        positionClasses[position],
        label ? 'px-5 gap-2' : 'w-14 p-0',
        className
      )}
    >
      <Icon className="h-5 w-5" />
      {label && <span className="font-medium">{label}</span>}
    </Button>
  );
}

/**
 * Bottom Sheet for mobile
 * A slide-up panel for additional actions
 */
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: BottomSheetProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50',
          'bg-background rounded-t-2xl shadow-2xl',
          'animate-in slide-in-from-bottom duration-300',
          'max-h-[85vh] overflow-hidden',
          'safe-area-pb',
          className
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-4 pb-3 border-b">
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-60px)] p-4">
          {children}
        </div>
      </div>
    </>
  );
}

/**
 * Action Sheet - iOS-style action menu
 */
interface ActionSheetAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface ActionSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  actions: ActionSheetAction[];
  cancelLabel?: string;
}

export function ActionSheet({
  open,
  onClose,
  title,
  description,
  actions,
  cancelLabel = 'Cancel',
}: ActionSheetProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-300">
        {/* Actions group */}
        <div className="bg-card rounded-2xl overflow-hidden shadow-xl">
          {(title || description) && (
            <div className="px-4 py-3 text-center border-b">
              {title && <p className="text-sm font-semibold">{title}</p>}
              {description && (
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              )}
            </div>
          )}

          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => {
                  action.onClick();
                  onClose();
                }}
                disabled={action.disabled}
                className={cn(
                  'w-full px-4 py-4 text-center text-base font-medium',
                  'active:bg-muted transition-colors',
                  'flex items-center justify-center gap-3',
                  index > 0 && 'border-t border-border',
                  action.destructive && 'text-destructive',
                  action.disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {Icon && <Icon className="h-5 w-5" />}
                {action.label}
              </button>
            );
          })}
        </div>

        {/* Cancel button */}
        <button
          onClick={onClose}
          className="w-full mt-2 px-4 py-4 bg-card rounded-2xl text-center text-base font-semibold text-primary active:bg-muted transition-colors shadow-xl"
        >
          {cancelLabel}
        </button>
      </div>
    </>
  );
}

export default MobileActionBar;
