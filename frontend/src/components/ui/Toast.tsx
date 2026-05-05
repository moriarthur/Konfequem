import { useEffect, useState, useRef } from "react";
import { FiX, FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiInfo } from "react-icons/fi";
import { TOAST_DURATION_MS } from "../../utils/bookingUtils";

type ToastType = "success" | "error" | "warning" | "info";

const toastIcons: Record<string, typeof FiInfo> = {
  success: FiCheckCircle,
  error: FiAlertCircle,
  warning: FiAlertTriangle,
  info: FiInfo,
};

const toastStyles: Record<string, string> = {
  success: "bg-status-success-soft text-status-success-text border-status-success-border",
  error: "bg-status-danger-soft text-status-danger-text border-status-danger-border",
  warning: "bg-status-warning-soft text-status-warning-text border-status-warning-border",
  info: "bg-status-info-soft text-status-info-text border-status-info-border",
};

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, type = "info", duration = TOAST_DURATION_MS, onClose }: ToastProps) {
  const [, setIsPaused] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef(Date.now());
  const remainingTimeRef = useRef(duration);
  const Icon = toastIcons[type] || FiInfo;

  useEffect(() => {
    if (duration <= 0) return;

    const startTimer = () => {
      timeoutRef.current = setTimeout(() => {
        onClose();
      }, remainingTimeRef.current);
    };

    startTimeRef.current = Date.now();
    startTimer();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [duration, onClose]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    }
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    startTimeRef.current = Date.now();
    if (remainingTimeRef.current > 0) {
      timeoutRef.current = setTimeout(() => {
        onClose();
      }, remainingTimeRef.current);
    }
    setIsPaused(false);
  };

  return (
    <div
      className="min-w-[300px] max-w-[400px] pointer-events-auto"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`px-4 py-3 rounded-xl shadow-soft border ${toastStyles[type]}`}>
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium flex-1 break-words">{message}</p>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors flex items-center justify-center"
            aria-label="Close notification"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
