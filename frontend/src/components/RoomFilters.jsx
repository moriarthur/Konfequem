import React from "react";
import { Label } from "./ui/Typography";
import { RoomFeatureBadge } from "./RoomFeatureBadges";

/**
 * RoomFilters component for filtering rooms by capacity and features
 * Optimized for mobile with horizontal scrolling
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

      {/* Features filter - horizontal scroll on mobile */}
      {features.length > 0 && (
        <div>
          <Label className="mb-2 block">Features</Label>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {features.map((feature) => {
              const isActive =
                activeFilters.features?.includes(feature.id);
              return (
                <RoomFeatureBadge
                  key={feature.id}
                  feature={feature}
                  selected={isActive}
                  onClick={() => handleFeatureToggle(feature.id)}
                />
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
