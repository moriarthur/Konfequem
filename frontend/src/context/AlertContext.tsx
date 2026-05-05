import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { TOAST_DURATION_MS } from "../config/booking";
import ToastContainer from "../components/ui/ToastContainer";

interface Toast {
  id: number;
  message: string;
  type: "info" | "success" | "error" | "warning";
  duration: number;
}

interface ToastOptions {
  type?: "info" | "success" | "error" | "warning";
  duration?: number;
}

interface AlertContextValue {
  toasts: Toast[];
  showAlert: (message: string, options?: ToastOptions & { type?: string }) => number;
  hideAlert: () => void;
  success: (message: string, options?: ToastOptions) => number;
  error: (message: string, options?: ToastOptions) => number;
  warning: (message: string, options?: ToastOptions) => number;
  info: (message: string, options?: ToastOptions) => number;
  clear: () => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

let toastIdCounter = 0;

export function AlertProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastsRef = useRef(toasts);

  const updateRef = useCallback((newToasts: Toast[]) => {
    toastsRef.current = newToasts;
  }, []);

  const addToast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const { type = "info", duration = TOAST_DURATION_MS } = options;

      const id = ++toastIdCounter;
      const newToast: Toast = { id, message, type, duration };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        updateRef(updated);
        return updated;
      });

      return id;
    },
    [updateRef]
  );

  const removeToast = useCallback(
    (id: number) => {
      setToasts((prev) => {
        const updated = prev.filter((t) => t.id !== id);
        updateRef(updated);
        return updated;
      });
    },
    [updateRef]
  );

  const success = useCallback(
    (message: string, options: ToastOptions = {}) => addToast(message, { ...options, type: "success" }),
    [addToast]
  );

  const error = useCallback(
    (message: string, options: ToastOptions = {}) => addToast(message, { ...options, type: "error" }),
    [addToast]
  );

  const warning = useCallback(
    (message: string, options: ToastOptions = {}) => addToast(message, { ...options, type: "warning" }),
    [addToast]
  );

  const info = useCallback(
    (message: string, options: ToastOptions = {}) => addToast(message, { ...options, type: "info" }),
    [addToast]
  );

  const showAlert = useCallback(
    (message: string, options: ToastOptions & { type?: string } = {}) => {
      const { type = "success", duration = TOAST_DURATION_MS } = options;
      return addToast(message, { type: type as Toast["type"], duration });
    },
    [addToast]
  );

  const hideAlert = useCallback(() => {
    setToasts([]);
    updateRef([]);
  }, [updateRef]);

  const clear = useCallback(() => {
    setToasts([]);
    updateRef([]);
  }, [updateRef]);

  return (
    <AlertContext.Provider value={{ toasts, showAlert, hideAlert, success, error, warning, info, clear }}>
      {children}
      <ToastContainer toasts={toasts} position="top" onRemove={removeToast} />
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextValue {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
}

export default AlertContext;
