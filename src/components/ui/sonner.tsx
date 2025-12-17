import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      closeButton={true}
      richColors={false}
      duration={4000}
      gap={12}
      visibleToasts={3}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white dark:group-[.toaster]:bg-zinc-900 group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg group-[.toaster]:border-l-4 group-[.toaster]:pl-4",
          title: "group-[.toast]:font-sans group-[.toast]:font-semibold group-[.toast]:text-sm",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:font-medium group-[.toast]:text-xs group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:rounded-md group-[.toast]:hover:bg-primary/90",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:font-medium group-[.toast]:text-xs",
          closeButton: "group-[.toast]:bg-transparent group-[.toast]:border-0 group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground group-[.toast]:opacity-70 group-[.toast]:hover:opacity-100 group-[.toast]:transition-opacity",
          success: "group-[.toaster]:border-l-emerald-500 group-[.toaster]:bg-emerald-50 dark:group-[.toaster]:bg-emerald-950/50 group-[.toaster]:[&>div>svg]:text-emerald-500 dark:group-[.toaster]:[&>div>svg]:text-emerald-400",
          error: "group-[.toaster]:border-l-red-500 group-[.toaster]:bg-red-50 dark:group-[.toaster]:bg-red-950/50 group-[.toaster]:[&>div>svg]:text-red-500 dark:group-[.toaster]:[&>div>svg]:text-red-400",
          warning: "group-[.toaster]:border-l-amber-500 group-[.toaster]:bg-amber-50 dark:group-[.toaster]:bg-amber-950/50 group-[.toaster]:[&>div>svg]:text-amber-500 dark:group-[.toaster]:[&>div>svg]:text-amber-400",
          info: "group-[.toaster]:border-l-sky-500 group-[.toaster]:bg-sky-50 dark:group-[.toaster]:bg-sky-950/50 group-[.toaster]:[&>div>svg]:text-sky-500 dark:group-[.toaster]:[&>div>svg]:text-sky-400",
        },
      }}
      icons={{
        success: <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />,
        error: <XCircle className="h-5 w-5 text-red-500 dark:text-red-400" />,
        warning: <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400" />,
        info: <Info className="h-5 w-5 text-sky-500 dark:text-sky-400" />,
        close: <X className="h-4 w-4" />,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
