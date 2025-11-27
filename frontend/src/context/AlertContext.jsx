import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const AlertContext = createContext();

export function AlertProvider({ children }) {
  const [alert, setAlert] = useState(null);
  const [useEmoji, setUseEmoji] = useState(false);

  const showAlert = useCallback((message, options = {}) => {
    // increase default duration by 2000ms (was 4000)
    const { type = "success", duration = 6000 } = options;
    setUseEmoji(false);
    setAlert({ message, type });
    if (duration > 0) {
      setTimeout(() => setAlert(null), duration);
    }
  }, []);

  const hideAlert = useCallback(() => setAlert(null), []);

  return (
    <AlertContext.Provider value={{ alert, showAlert, hideAlert }}>
      {children}
      {/* Alert container rendered here so it sits above app UI */}
      {alert && (
        // Full-width fixed container with horizontal padding for small screens;
        // we position the inner toast absolutely at 50% and translate -50% to guarantee precise centering.
        <div key={alert.message} className={`fixed top-6 left-0 right-0 z-50 px-4 pointer-events-none`}>
          <div className={`absolute left-1/2 transform -translate-x-1/2 pointer-events-auto px-5 py-3 rounded-2xl shadow-soft text-sm font-medium backdrop-blur-sm animate-fadeInOut max-w-[min(90vw,720px)] w-auto flex items-center gap-3 ${
            alert.type === 'error' 
              ? 'bg-status-danger-soft text-status-danger-text border border-status-danger-border' 
              : 'bg-status-success-soft text-status-success-text border border-status-success-border'
          }`} role="status" aria-live="polite">
            {/* show different icons based on alert type */}
            {alert.type === 'error' ? (
              !useEmoji ? (
                <img
                  src="/error-symbol.svg"
                  alt="error"
                  className="w-5 h-5 flex-shrink-0 block"
                  onError={() => setUseEmoji(true)}
                  onLoad={() => setUseEmoji(false)}
                />
              ) : (
                <span className="w-5 h-5 inline-flex items-center justify-center flex-shrink-0">❌</span>
              )
            ) : (
              !useEmoji ? (
                <img
                  src="/check-symbol.svg"
                  alt="check"
                  className="w-5 h-5 flex-shrink-0 block"
                  onError={() => setUseEmoji(true)}
                  onLoad={() => setUseEmoji(false)}
                />
              ) : (
                <span className="w-5 h-5 inline-flex items-center justify-center flex-shrink-0">✅</span>
              )
            )}
            <span className="break-words">{alert.message}</span>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  return useContext(AlertContext);
}

export default AlertContext;
