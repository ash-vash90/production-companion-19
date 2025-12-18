import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const progressVariants = cva("h-full w-full flex-1 transition-all", {
  variants: {
    status: {
      default: "bg-primary",
      planned: "bg-status-planned-foreground",
      in_progress: "bg-status-in-progress-foreground",
      on_hold: "bg-status-on-hold-foreground",
      completed: "bg-status-completed-foreground",
      cancelled: "bg-status-cancelled-foreground",
      // Auto mode - determined by value
      auto: "",
    },
  },
  defaultVariants: {
    status: "default",
  },
});

// Get auto status based on percentage value
const getAutoStatus = (value: number | null | undefined): string => {
  const percent = value || 0;
  if (percent === 100) return "bg-status-completed-foreground";
  if (percent >= 50) return "bg-status-in-progress-foreground";
  if (percent > 0) return "bg-status-planned-foreground";
  return "bg-muted-foreground/40";
};

interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants> {}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, status, ...props }, ref) => {
  const indicatorClass = status === "auto" 
    ? getAutoStatus(value) 
    : progressVariants({ status });

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(indicatorClass)}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
