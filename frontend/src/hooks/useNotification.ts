import { useCallback, useState } from "react";

export type ToastSeverity = "success" | "error" | "info" | "warning";

export interface ToastState {
  open: boolean;
  message: string;
  severity: ToastSeverity;
}

export type NotifyFn = (message: string, severity?: ToastSeverity) => void;

export interface UseNotificationResult {
  toast: ToastState;
  notify: NotifyFn;
  closeToast: () => void;
}

export function useNotification(): UseNotificationResult {
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    severity: "info",
  });

  const notify: NotifyFn = useCallback((message: string, severity: ToastSeverity = "info") => {
    setToast({ open: true, message, severity });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  return { toast, notify, closeToast };
}
