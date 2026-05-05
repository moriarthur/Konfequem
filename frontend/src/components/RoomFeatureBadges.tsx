import type { ReactNode } from "react";

interface Feature {
  id: number;
  name: string;
  icon: string;
}

const FEATURE_ICONS: Record<string, ReactNode> = {
  projector: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M5 7 3 5" /><path d="M9 6V3" /><path d="m13 7 2-2" />
      <circle cx="9" cy="13" r="3" />
      <path d="M11.83 12H20a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h2.17" />
      <path d="M16 16h2" />
    </svg>
  ),
  wifi: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M12 20h.01" /><path d="M2 8.82a15 15 0 0 1 20 0" />
      <path d="M5 12.859a10 10 0 0 1 14 0" /><path d="M8.5 16.429a5 5 0 0 1 7 0" />
    </svg>
  ),
  coffee: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M10 2v2" /><path d="M14 2v2" />
      <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
      <path d="M6 2v2" />
    </svg>
  ),
  whiteboard: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M2 3h20" /><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" />
      <path d="m7 21 5-5 5 5" />
    </svg>
  ),
  tv: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M7 21h10" /><rect width="20" height="14" x="2" y="3" rx="2" />
    </svg>
  ),
  videoconf: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  ),
};

export { FEATURE_ICONS };

interface RoomFeatureBadgesProps {
  features?: Feature[];
  showLabels?: boolean;
  className?: string;
}

export function RoomFeatureBadges({ features = [], showLabels = true, className = "" }: RoomFeatureBadgesProps) {
  if (!features || features.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {features.map((feature) => {
        const icon = FEATURE_ICONS[feature.icon] || FEATURE_ICONS.projector;
        return (
          <span
            key={feature.id}
            className={`inline-flex items-center justify-center border rounded-lg ${
              showLabels
                ? "gap-2 px-3 py-1.5 bg-surface-muted border-border-subtle"
                : "w-9 h-9 bg-surface-base border-border-subtle text-accent-secondary/50"
            }`}
            title={!showLabels ? feature.name : undefined}
          >
            <span className={`flex-shrink-0 ${showLabels ? "text-accent-secondary" : ""}`}>{icon}</span>
            {showLabels && <span className="text-sm text-accent-secondary">{feature.name}</span>}
          </span>
        );
      })}
    </div>
  );
}

interface RoomFeatureBadgeProps {
  feature: Feature;
  selected?: boolean;
  onClick?: () => void;
}

export function RoomFeatureBadge({ feature, selected = false, onClick }: RoomFeatureBadgeProps) {
  const icon = FEATURE_ICONS[feature.icon] || FEATURE_ICONS.projector;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border transition ${
        selected
          ? "bg-accent-primary/10 border-accent-primary text-accent-primary"
          : "bg-surface-base border-border-subtle text-accent-secondary hover:bg-surface-muted hover:border-border-soft"
      }`}
    >
      <span className={selected ? "text-accent-primary" : "text-accent-secondary/60"}>{icon}</span>
      <span className="text-sm font-medium">{feature.name}</span>
    </button>
  );
}
