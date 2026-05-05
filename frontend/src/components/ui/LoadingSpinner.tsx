interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function LoadingSpinner({ size = "md", className = "" }: LoadingSpinnerProps) {
  const sizes: Record<string, string> = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" };

  return (
    <div
      className={`animate-spin rounded-full border-2 border-border-subtle border-t-accent-primary ${sizes[size]} ${className}`}
    />
  );
}
