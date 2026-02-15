import { useEffect, useState } from "react";
import { FiX, FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiInfo } from "react-icons/fi";
import { TOAST_DURATION_MS } from "../../config/booking";

const toastIcons = {
  success: FiCheckCircle,
  error: FiAlertCircle,
  warning: FiAlertTriangle,
  info: FiInfo,
};

const toastStyles = {
  success: "bg-status-success-soft text-status-success-text border-status-success-border",
  error: "bg-status-danger-soft text-status-danger-text border-status-danger-border",
  warning: "bg-status-warning-soft text-status-warning-text border-status-warning-border",
  info: "bg-status-info-soft text-status-info-text border-status-info-border",
};

export default function Toast({ message, type = "info", duration = TOAST_DURATION_MS, onClose }) {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const Icon = toastIcons[type] || FiInfo;

  useEffect(() => {
    if (duration <= 0) return;

    const startTime = Date.now();
    const endTime = startTime + duration;
    let animationFrame;
    let timeoutId;

    const updateProgress = () => {
      if (isPaused) {
        animationFrame = requestAnimationFrame(updateProgress);
        return;
      }

      const remaining = endTime - Date.now();
      const newProgress = (remaining / duration) * 100;

      if (remaining <= 0) {
        onClose();
      } else {
        setProgress(newProgress);
        animationFrame = requestAnimationFrame(updateProgress);
      }
    };

    animationFrame = requestAnimationFrame(updateProgress);

    timeoutId = setTimeout(() => {
      onClose();
    }, duration);

    return () => {
      cancelAnimationFrame(animationFrame);
      clearTimeout(timeoutId);
    };
  }, [duration, isPaused, onClose]);

  return (
    <div
      className="flex items-start gap-3 min-w-[300px] max-w-[400px] pointer-events-auto"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className={`flex-1 px-4 py-3 rounded-xl shadow-soft border ${toastStyles[type]}`}>
        <div className="flex items-start gap-3">
          <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium break-words">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors"
            aria-label="Close notification"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
        {duration > 0 && (
          <div className="mt-2 h-1 bg-black/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-current opacity-50 transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-label="Notification dismiss timer"
            />
          </div>
        )}
      </div>
    </div>
  );
}
