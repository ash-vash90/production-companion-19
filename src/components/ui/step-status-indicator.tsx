import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Circle, Clock, CheckCircle2, SkipForward } from "lucide-react";

const stepStatusIndicatorVariants = cva(
  [
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
    "text-[10px] font-medium uppercase tracking-wide",
    "whitespace-nowrap flex-shrink-0",
    "transition-colors duration-150",
  ].join(" "),
  {
    variants: {
      status: {
        pending: "bg-muted/50 text-muted-foreground border-muted-foreground/20",
        current: "bg-status-in-progress text-status-in-progress-foreground border-status-in-progress-border",
        in_progress: "bg-status-in-progress text-status-in-progress-foreground border-status-in-progress-border",
        completed: "bg-status-completed text-status-completed-foreground border-status-completed-border",
        skipped: "bg-muted/30 text-muted-foreground/70 border-muted-foreground/20",
      },
      size: {
        xs: "text-[9px] px-1.5 py-0 gap-1 h-5",
        sm: "text-[10px] px-2 py-0.5 gap-1",
        default: "text-[11px] px-2.5 py-1 gap-1.5",
      },
    },
    defaultVariants: {
      status: "pending",
      size: "default",
    },
  }
);

const stepStatusIcons: Record<string, React.ElementType> = {
  pending: Circle,
  current: Clock,
  in_progress: Clock,
  completed: CheckCircle2,
  skipped: SkipForward,
};

const stepStatusLabels: Record<string, { en: string; nl: string }> = {
  pending: { en: "Pending", nl: "Wachtend" },
  current: { en: "Current", nl: "Huidig" },
  in_progress: { en: "In Progress", nl: "Bezig" },
  completed: { en: "Completed", nl: "Voltooid" },
  skipped: { en: "Skipped", nl: "Overgeslagen" },
};

export interface StepStatusIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stepStatusIndicatorVariants> {
  showIcon?: boolean;
  language?: "en" | "nl";
  customLabel?: string;
}

const StepStatusIndicator = React.forwardRef<HTMLDivElement, StepStatusIndicatorProps>(
  ({ className, status, size, showIcon = true, language = "en", customLabel, ...props }, ref) => {
    const statusKey = status || "pending";
    const Icon = stepStatusIcons[statusKey];
    const label = customLabel || stepStatusLabels[statusKey]?.[language] || statusKey;
    
    const iconSize = size === "xs" ? "h-2.5 w-2.5" : size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

    return (
      <div
        ref={ref}
        className={cn(stepStatusIndicatorVariants({ status, size }), className)}
        {...props}
      >
        {showIcon && Icon && <Icon className={iconSize} />}
        <span>{label}</span>
      </div>
    );
  }
);
StepStatusIndicator.displayName = "StepStatusIndicator";

// Utility function to get step status color classes for custom usage
export const getStepStatusClasses = (status: string) => {
  const classes: Record<string, { bg: string; text: string; border: string }> = {
    pending: {
      bg: "bg-muted/50",
      text: "text-muted-foreground",
      border: "border-muted-foreground/20",
    },
    current: {
      bg: "bg-status-in-progress",
      text: "text-status-in-progress-foreground",
      border: "border-status-in-progress-foreground/30",
    },
    in_progress: {
      bg: "bg-status-in-progress",
      text: "text-status-in-progress-foreground",
      border: "border-status-in-progress-foreground/30",
    },
    completed: {
      bg: "bg-status-completed",
      text: "text-status-completed-foreground",
      border: "border-status-completed-foreground/30",
    },
    skipped: {
      bg: "bg-muted/30",
      text: "text-muted-foreground/70",
      border: "border-muted-foreground/20",
    },
  };
  return classes[status] || classes.pending;
};

export { StepStatusIndicator, stepStatusIndicatorVariants };
