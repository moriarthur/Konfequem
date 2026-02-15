import { createContext, useContext, useState, useCallback, useRef } from "react";
import { TOAST_DURATION_MS } from "../config/booking";
import ToastContainer from "../components/ui/ToastContainer";

const AlertContext = createContext();

let toastIdCounter = 0;

export function AlertProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toastsRef = useRef(toasts);

  // Keep ref in sync for stale closure issues
  const updateRef = useCallback((newToasts) => {
    toastsRef.current = newToasts;
  }, []);

  const addToast = useCallback((message, options = {}) => {
    const {
      type = "info",
      duration = TOAST_DURATION_MS,
    } = options;

    const id = ++toastIdCounter;
    const newToast = { id, message, type, duration };

    setToasts((prev) => {
      const updated = [...prev, newToast];
      updateRef(updated);
      return updated;
    });

    return id;
  }, [updateRef]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      updateRef(updated);
      return updated;
    });
  }, [updateRef]);

  // Convenience methods for each toast type
  const success = useCallback((message, options = {}) => {
    return addToast(message, { ...options, type: "success" });
  }, [addToast]);

  const error = useCallback((message, options = {}) => {
    return addToast(message, { ...options, type: "error" });
  }, [addToast]);

  const warning = useCallback((message, options = {}) => {
    return addToast(message, { ...options, type: "warning" });
  }, [addToast]);

  const info = useCallback((message, options = {}) => {
    return addToast(message, { ...options, type: "info" });
  }, [addToast]);

  // Legacy method for backward compatibility
  const showAlert = useCallback((message, options = {}) => {
    const { type = "success", duration = TOAST_DURATION_MS } = options;
    return addToast(message, { type, duration });
  }, [addToast]);

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

export function useAlert() {
  return useContext(AlertContext);
}

export default AlertContext;
