import type { ReactNode } from "react";
import { Text } from "./Typography";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center px-6 py-12 bg-surface-base border border-border-subtle rounded-2xl shadow-soft">
      {icon && <div className="mx-auto h-12 w-12 text-accent-secondary/50 mb-4">{icon}</div>}
      <Text className="font-semibold text-accent-secondary mb-2">{title}</Text>
      <Text variant="muted" className="mb-6 max-w-sm mx-auto">
        {description}
      </Text>
      {action}
    </div>
  );
}
