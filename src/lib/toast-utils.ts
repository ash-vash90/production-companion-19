import { toast } from "sonner";

interface ToastOptions {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

/**
 * Success toast - for completed actions (3s duration)
 */
export const showSuccessToast = (options: ToastOptions) => {
  toast.success(options.title, {
    description: options.description,
    duration: options.duration ?? 3000,
    action: options.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
  });
};

/**
 * Error toast - for failed actions (6s duration, needs attention)
 */
export const showErrorToast = (options: ToastOptions) => {
  toast.error(options.title, {
    description: options.description,
    duration: options.duration ?? 6000,
    action: options.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
  });
};

/**
 * Warning toast - for cautions (5s duration)
 */
export const showWarningToast = (options: ToastOptions) => {
  toast.warning(options.title, {
    description: options.description,
    duration: options.duration ?? 5000,
    action: options.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
  });
};

/**
 * Info toast - for neutral notifications (4s duration)
 */
export const showInfoToast = (options: ToastOptions) => {
  toast.info(options.title, {
    description: options.description,
    duration: options.duration ?? 4000,
    action: options.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
  });
};

// ============================================
// Contextual helpers for common scenarios
// ============================================

/**
 * Work order status change toast
 */
export const showWorkOrderStatusToast = (
  woNumber: string,
  newStatus: string,
  productType?: string
) => {
  const statusMessages: Record<string, { title: string; type: "success" | "warning" | "info" }> = {
    completed: { title: "Work order completed", type: "success" },
    cancelled: { title: "Work order cancelled", type: "warning" },
    in_progress: { title: "Work order started", type: "info" },
    on_hold: { title: "Work order on hold", type: "warning" },
    planned: { title: "Work order planned", type: "info" },
  };

  const config = statusMessages[newStatus] || { title: `Status: ${newStatus}`, type: "info" };
  const description = productType ? `${woNumber} • ${productType}` : woNumber;

  if (config.type === "success") {
    showSuccessToast({ title: config.title, description });
  } else if (config.type === "warning") {
    showWarningToast({ title: config.title, description });
  } else {
    showInfoToast({ title: config.title, description });
  }
};

/**
 * Save success toast
 */
export const showSaveSuccessToast = (itemName: string) => {
  showSuccessToast({
    title: "Changes saved",
    description: itemName,
  });
};

/**
 * Delete/remove confirmation toast with optional undo
 */
export const showDeleteToast = (
  itemName: string,
  undoFn?: () => void
) => {
  showWarningToast({
    title: "Item removed",
    description: itemName,
    action: undoFn
      ? {
          label: "Undo",
          onClick: undoFn,
        }
      : undefined,
  });
};

/**
 * Creation success toast
 */
export const showCreateSuccessToast = (
  itemType: string,
  itemName: string,
  viewAction?: () => void
) => {
  showSuccessToast({
    title: `${itemType} created`,
    description: itemName,
    action: viewAction
      ? {
          label: "View",
          onClick: viewAction,
        }
      : undefined,
  });
};

/**
 * Network/connection error toast
 */
export const showConnectionErrorToast = (retryFn?: () => void) => {
  showErrorToast({
    title: "Connection error",
    description: "Please check your network and try again",
    action: retryFn
      ? {
          label: "Retry",
          onClick: retryFn,
        }
      : undefined,
  });
};

/**
 * Permission denied toast
 */
export const showPermissionDeniedToast = () => {
  showErrorToast({
    title: "Permission denied",
    description: "You don't have access to perform this action",
  });
};

/**
 * Copied to clipboard toast
 */
export const showCopiedToast = (itemName?: string) => {
  showSuccessToast({
    title: "Copied to clipboard",
    description: itemName,
    duration: 2000,
  });
};

/**
 * Loading toast with promise
 */
export const showLoadingToast = <T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((err: Error) => string);
  }
) => {
  return toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
  });
};
