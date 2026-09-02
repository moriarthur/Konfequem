import type { HTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
  className?: string;
}

export function Heading({ level = 1, children, className = "", ...props }: HeadingProps) {
  const baseClasses = "font-semibold text-accent-secondary";

  const sizes: Record<number, string> = {
    1: "text-4xl",
    2: "text-3xl",
    3: "text-2xl",
    4: "text-xl",
    5: "text-lg",
    6: "text-base",
  };

  const Tag = `h${level}` as "h1";

  return (
    <Tag className={`${baseClasses} ${sizes[level]} ${className}`} {...props}>
      {children}
    </Tag>
  );
}

interface SubheadingProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
  className?: string;
}

export function Subheading({ children, className = "", ...props }: SubheadingProps) {
  return (
    <h3 className={`text-lg font-medium text-accent-secondary ${className}`} {...props}>
      {children}
    </h3>
  );
}

interface TextProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
  variant?: "default" | "muted" | "large" | "small";
  className?: string;
}

export function Text({ children, variant = "default", className = "", ...props }: TextProps) {
  const variants: Record<string, string> = {
    default: "text-sm text-accent-secondary/80",
    muted: "text-sm text-accent-secondary/60",
    large: "text-base text-accent-secondary",
    small: "text-xs text-accent-secondary/60",
  };

  return (
    <p className={`${variants[variant]} ${className}`} {...props}>
      {children}
    </p>
  );
}

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
  className?: string;
}

export function Label({ children, className = "", ...props }: LabelProps) {
  return (
    <label className={`block text-sm font-medium text-accent-secondary mb-1 ${className}`} {...props}>
      {children}
    </label>
  );
}
