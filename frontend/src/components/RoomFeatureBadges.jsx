const FEATURE_ICONS = {
  projector: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 14.25C2.25 16.077 3.923 17.75 5.75 17.75H9c1.726 0 3.228-1.077 3.822-2.588a.75.75 0 011.356 0C14.772 16.673 16.274 17.75 18 17.75h2.25c1.827 0 3.5-1.673 3.5-3.5v-3.181a7.495 7.495 0 00-2.658-5.816l-1.327-.842A9.014 9.014 0 0014.25 3.25h-3.5a9.014 9.014 0 00-4.515 1.161l-1.327.842A7.495 7.495 0 002.25 11.069v3.181zM9.75 21a.75.75 0 01-.75-.75v-4.5a.75.75 0 01.75-.75h4.5a.75.75 0 01.75.75v4.5a.75.75 0 01-.75.75h-4.5z" />
    </svg>
  ),
  wifi: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
    </svg>
  ),
  coffee: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75h4.5a4.5 4.5 0 014.5 4.5v0a4.5 4.5 0 01-4.5 4.5h-4.5a4.5 4.5 0 01-4.5-4.5v0a4.5 4.5 0 014.5-4.5zM9.75 9.75v6a6 6 0 006 6h0a6 6 0 006-6v-1.5m-6-4.5v-3a3 3 0 013-3h0a3 3 0 013 3v3" />
    </svg>
  ),
  whiteboard: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.077-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </svg>
  ),
  tv: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 3.75H3.375m0 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h1.5c.621 0 1.125.504 1.125 1.125M18 5.625h1.5c.621 0 1.125.504 1.125 1.125m0 0h1.5m-1.5 0v1.5c0 .621-.504 1.125-1.125 1.125m0 3.75H3.375m0 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125" />
    </svg>
  ),
  videoconf: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
};

export { FEATURE_ICONS };

/**
 * Display room features as badges
 * @param {Array} features - Array of feature objects with { id, name, icon }
 * @param {boolean} showLabels - Whether to show text labels (default: true)
 * @param {string} className - Additional CSS classes
 */
export function RoomFeatureBadges({ features = [], showLabels = true, className = "" }) {
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

/**
 * Display a single room feature as a standalone badge
 * @param {Object} feature - Feature object with { id, name, icon }
 * @param {boolean} selected - Whether the feature is selected/active
 * @param {Function} onClick - Click handler
 */
export function RoomFeatureBadge({ feature, selected = false, onClick }) {
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
      <span className={selected ? "text-accent-primary" : "text-accent-secondary/60"}>
        {icon}
      </span>
      <span className="text-sm font-medium">{feature.name}</span>
    </button>
  );
}
