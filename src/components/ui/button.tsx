import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium",
    "ring-offset-background transition-all duration-normal ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "active:scale-[0.98]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground shadow-sm",
          "hover:bg-primary/90 hover:shadow-md",
        ].join(" "),
        destructive: [
          "bg-destructive text-destructive-foreground shadow-sm",
          "hover:bg-destructive/90 hover:shadow-md",
        ].join(" "),
        outline: [
          "border border-input bg-background",
          "hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/20",
        ].join(" "),
        secondary: [
          "bg-secondary text-secondary-foreground",
          "hover:bg-secondary/80",
        ].join(" "),
        ghost: [
          "hover:bg-accent hover:text-accent-foreground",
        ].join(" "),
        link: [
          "text-primary underline-offset-4 hover:underline",
        ].join(" "),
        success: [
          "bg-success text-success-foreground shadow-sm",
          "hover:bg-success/90 hover:shadow-md",
        ].join(" "),
        warning: [
          "bg-warning text-warning-foreground shadow-sm",
          "hover:bg-warning/90 hover:shadow-md",
        ].join(" "),
      },
      size: {
        default: "h-10 px-5 py-2 text-sm [&_svg]:size-4",
        sm: "h-9 rounded-md px-4 text-sm [&_svg]:size-4",
        lg: "h-12 rounded-md px-6 text-base [&_svg]:size-5",
        xl: "h-14 rounded-md px-8 text-lg [&_svg]:size-6",
        icon: "h-10 w-10 [&_svg]:size-5",
        "icon-sm": "h-9 w-9 [&_svg]:size-4",
        "icon-lg": "h-12 w-12 [&_svg]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
