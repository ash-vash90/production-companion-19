import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center rounded-full border px-2.5 py-0.5",
    "text-[10px] font-semibold uppercase tracking-wide",
    "pointer-events-none select-none whitespace-nowrap flex-shrink-0",
    "transition-colors duration-quick",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow-xs",
        outline: "text-foreground border-border",
        success: "bg-status-completed text-status-completed-foreground border-status-completed-border",
        warning: "bg-status-in-progress text-status-in-progress-foreground border-status-in-progress-border",
        info: "bg-status-planned text-status-planned-foreground border-status-planned-border",
        muted: "bg-status-on-hold text-status-on-hold-foreground border-status-on-hold-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
