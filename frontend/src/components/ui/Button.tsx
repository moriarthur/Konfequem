import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
  ...props
}: ButtonProps) {
  const baseClasses =
    "font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed";

  const variants: Record<string, string> = {
    primary:
      "bg-accent-primary text-white hover:bg-accent-primary/90 focus:ring-accent-primary/40 focus:ring-offset-surface-base disabled:bg-border-subtle disabled:text-white/70",
    secondary:
      "bg-surface-muted text-accent-secondary hover:bg-surface-base focus:ring-border-soft/80 focus:ring-offset-surface-base disabled:bg-border-subtle disabled:text-accent-secondary/40",
    danger:
      "bg-accent-danger text-white hover:bg-accent-danger/90 focus:ring-accent-danger/40 focus:ring-offset-surface-base disabled:bg-border-subtle disabled:text-white/70",
    ghost:
      "text-accent-secondary hover:bg-surface-muted focus:ring-border-subtle focus:ring-offset-surface-base disabled:text-accent-secondary/40",
  };

  const sizes: Record<string, string> = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
