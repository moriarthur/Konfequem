import { Label } from "./ui/Typography";
import { FEATURE_ICONS } from "./RoomFeatureBadges";

/**
 * RoomFilters component for filtering rooms by capacity and features
 * Features display with icons and text labels
 *
 * @param {Object} props
 * @param {Array} props.features - Available features to filter by
 * @param {Object} props.activeFilters - Currently active filters { capacity: number, features: [] }
 * @param {Function} props.onFilterChange - Callback when filters change (type, value)
 */
export default function RoomFilters({
  features = [],
  activeFilters = { capacity: null, features: [] },
  onFilterChange,
}) {
  const capacityOptions = [
    { value: "", label: "Any capacity" },
    { value: "2", label: "2+ people" },
    { value: "4", label: "4+ people" },
    { value: "6", label: "6+ people" },
    { value: "8", label: "8+ people" },
    { value: "12", label: "12+ people" },
  ];

  const handleCapacityChange = (e) => {
    const value = e.target.value ? parseInt(e.target.value) : null;
    onFilterChange?.("capacity", value);
  };

  const handleFeatureToggle = (featureId) => {
    const isActive = activeFilters.features?.includes(featureId);
    let newFeatures;

    if (isActive) {
      newFeatures = activeFilters.features.filter((id) => id !== featureId);
    } else {
      newFeatures = [...(activeFilters.features || []), featureId];
    }

    onFilterChange?.("features", newFeatures);
  };

  const hasActiveFilters =
    activeFilters.capacity !== null ||
    (activeFilters.features && activeFilters.features.length > 0);

  return (
    <div className="space-y-4">
      {/* Capacity filter */}
      <div>
        <Label className="mb-2 block">Capacity</Label>
        <select
          value={activeFilters.capacity ?? ""}
          onChange={handleCapacityChange}
          className="w-full border border-border-subtle rounded-xl px-4 py-3 text-sm bg-surface-base text-accent-secondary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary"
        >
          {capacityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Features filter - wrapped badges with icons and text */}
      {features.length > 0 && (
        <div>
          <Label className="mb-3 block">Features</Label>
          <div className="flex flex-wrap gap-2">
            {features.map((feature) => {
              const isActive = activeFilters.features?.includes(feature.id);
              const Icon = FEATURE_ICONS[feature.icon] || FEATURE_ICONS.projector;
              return (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => handleFeatureToggle(feature.id)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition ${
                    isActive
                      ? "bg-accent-primary/10 border-accent-primary text-accent-primary"
                      : "bg-surface-base border-border-subtle text-accent-secondary hover:bg-surface-muted hover:border-border-soft"
                  }`}
                >
                  <span className={isActive ? "text-accent-primary" : "text-accent-secondary/60"}>
                    {Icon}
                  </span>
                  <span className="text-sm font-medium">{feature.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Clear filters button */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => {
            onFilterChange?.({ capacity: null, features: [] });
          }}
          className="text-sm text-accent-primary hover:underline"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
