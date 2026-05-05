import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "gray";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function Badge({ children, variant = "default", size = "md", className = "" }: BadgeProps) {
  const baseClasses = "inline-flex items-center font-medium rounded-pill border";

  const variants: Record<string, string> = {
    default: "bg-status-neutral-soft text-status-neutral-text border-status-neutral-border",
    success: "bg-status-success-soft text-status-success-text border-status-success-border",
    warning: "bg-status-warning-soft text-status-warning-text border-status-warning-border",
    danger: "bg-status-danger-soft text-status-danger-text border-status-danger-border",
    info: "bg-status-info-soft text-status-info-text border-status-info-border",
    gray: "bg-status-neutral-soft text-status-neutral-text border-status-neutral-border",
  };

  const sizes: Record<string, string> = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-0.5 text-sm",
    lg: "px-3 py-1 text-base",
  };

  return (
    <span className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
}
