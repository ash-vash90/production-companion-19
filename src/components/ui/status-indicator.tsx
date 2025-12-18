import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Pause, XCircle, Calendar } from "lucide-react";

const statusIndicatorVariants = cva(
  [
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1",
    "text-[11px] font-mono font-medium uppercase tracking-wide",
    "whitespace-nowrap flex-shrink-0 shadow-sm",
    "transition-colors duration-150",
  ].join(" "),
  {
    variants: {
      status: {
        planned: "bg-status-planned text-status-planned-foreground border-status-planned-border",
        in_progress: "bg-status-in-progress text-status-in-progress-foreground border-status-in-progress-border",
        on_hold: "bg-status-on-hold text-status-on-hold-foreground border-status-on-hold-border",
        completed: "bg-status-completed text-status-completed-foreground border-status-completed-border",
        cancelled: "bg-status-cancelled text-status-cancelled-foreground border-status-cancelled-border",
      },
      size: {
        sm: "text-[10px] px-2 py-0.5 gap-1",
        default: "text-[11px] px-3 py-1 gap-1.5",
        lg: "text-xs px-4 py-1.5 gap-2",
      },
    },
    defaultVariants: {
      status: "planned",
      size: "default",
    },
  }
);

const statusIcons: Record<string, React.ElementType> = {
  planned: Calendar,
  in_progress: Clock,
  on_hold: Pause,
  completed: CheckCircle2,
  cancelled: XCircle,
};

const statusLabels: Record<string, { en: string; nl: string }> = {
  planned: { en: "Planned", nl: "Gepland" },
  in_progress: { en: "In Progress", nl: "In Uitvoering" },
  on_hold: { en: "On Hold", nl: "In Wacht" },
  completed: { en: "Completed", nl: "Voltooid" },
  cancelled: { en: "Cancelled", nl: "Geannuleerd" },
};

export interface StatusIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusIndicatorVariants> {
  showIcon?: boolean;
  language?: "en" | "nl";
  customLabel?: string;
}

const StatusIndicator = React.forwardRef<HTMLDivElement, StatusIndicatorProps>(
  ({ className, status, size, showIcon = false, language = "en", customLabel, ...props }, ref) => {
    const statusKey = status || "planned";
    const Icon = statusIcons[statusKey];
    const label = customLabel || statusLabels[statusKey]?.[language] || statusKey;
    
    const iconSize = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";

    return (
      <div
        ref={ref}
        className={cn(statusIndicatorVariants({ status, size }), className)}
        {...props}
      >
        {showIcon && Icon && <Icon className={iconSize} />}
        <span>{label}</span>
      </div>
    );
  }
);
StatusIndicator.displayName = "StatusIndicator";

// Utility function to get status color classes for custom usage
export const getStatusClasses = (status: string) => {
  const classes: Record<string, { bg: string; text: string; border: string }> = {
    planned: {
      bg: "bg-status-planned",
      text: "text-status-planned-foreground",
      border: "border-status-planned-foreground/30",
    },
    in_progress: {
      bg: "bg-status-in-progress",
      text: "text-status-in-progress-foreground",
      border: "border-status-in-progress-foreground/30",
    },
    on_hold: {
      bg: "bg-status-on-hold",
      text: "text-status-on-hold-foreground",
      border: "border-status-on-hold-foreground/30",
    },
    completed: {
      bg: "bg-status-completed",
      text: "text-status-completed-foreground",
      border: "border-status-completed-foreground/30",
    },
    cancelled: {
      bg: "bg-status-cancelled",
      text: "text-status-cancelled-foreground",
      border: "border-status-cancelled-foreground/30",
    },
  };
  return classes[status] || classes.planned;
};

export { StatusIndicator, statusIndicatorVariants };
