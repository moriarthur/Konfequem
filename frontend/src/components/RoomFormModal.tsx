import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { FEATURE_ICONS } from "./RoomFeatureBadges";
import { Heading, Label } from "./ui/Typography";
import Button from "./ui/Button";
import type { Room, Feature } from "../types";

const ROOM_NAME_REGEX = /^[a-zA-Z0-9 .-]+$/;

interface FormErrors {
  name?: string;
  location?: string;
  capacity?: string;
}

const validateForm = ({
  name = "",
  location = "",
  capacity = "",
}: {
  name: string;
  location: string;
  capacity: string;
}): FormErrors => {
  const errors: FormErrors = {};
  const n = name.trim();
  const capacityNum = Number(capacity);

  if (!n) errors.name = "Room name is required";
  else if (n.length > 100) errors.name = "Too long (max 100 characters)";
  else if (!ROOM_NAME_REGEX.test(n))
    errors.name = "Only letters, numbers, spaces, hyphens, and periods";

  if (location.trim().length > 100) errors.location = "Too long (max 100 characters)";

  if (!capacity.trim()) errors.capacity = "Capacity is required";
  else if (!Number.isInteger(capacityNum) || capacityNum < 1 || capacityNum > 50)
    errors.capacity = "Capacity must be between 1 and 50";

  return errors;
};

const flattenServerError = (err: unknown): string => {
  const e = err as Record<string, unknown> | null | undefined;
  if (!e || typeof e !== "object") return "Could not save room. Please try again.";
  const general = e.general as string[] | undefined;
  if (Array.isArray(general) && general.length > 0) return general[0];
  const firstField = Object.values(e).find(
    (v) => Array.isArray(v) && v.length > 0
  ) as string[] | undefined;
  if (firstField) return firstField[0];
  if (typeof e.detail === "string") return e.detail;
  if (typeof e.error === "string") return e.error;
  return "Could not save room. Please try again.";
};

interface RoomFormModalProps {
  room: Room | null; // null = create mode
  features: Feature[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

export default function RoomFormModal({
  room,
  features,
  onClose,
  onSaved,
}: RoomFormModalProps) {
  const { authFetch } = useAuth();

  const [name, setName] = useState(room?.name ?? "");
  const [location, setLocation] = useState(room?.location ?? "");
  const [capacity, setCapacity] = useState(room ? String(room.capacity) : "");
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<number[]>(
    room?.features?.map((f) => f.id) ?? []
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const validationErrors = useMemo(
    () => validateForm({ name, location, capacity }),
    [name, location, capacity]
  );
  const hasErrors = Object.keys(validationErrors).length > 0;

  const handleBlur = (field: keyof FormErrors) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const showFieldError = (field: keyof FormErrors) =>
    touched[field] && validationErrors[field];

  const handleFeatureToggle = (featureId: number) => {
    setSelectedFeatureIds((prev) =>
      prev.includes(featureId)
        ? prev.filter((id) => id !== featureId)
        : [...prev, featureId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, location: true, capacity: true });
    setServerError("");

    if (hasErrors) return;

    try {
      setSubmitting(true);
      await authFetch(room ? `/api/rooms/${room.id}/` : "/api/rooms/", {
        method: room ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim(),
          capacity: Number(capacity),
          features: selectedFeatureIds,
        }),
      });
      await onSaved();
    } catch (err) {
      setServerError(flattenServerError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = (field: keyof FormErrors) =>
    `w-full px-3 py-2 rounded-lg border transition focus:ring-2 focus:outline-none bg-surface-base text-accent-secondary ${
      showFieldError(field)
        ? "border-status-danger-border focus:ring-status-danger/40"
        : "border-border-subtle focus:ring-accent-primary/40"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-form-title"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-surface-base border border-border-subtle rounded-2xl shadow-soft p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <Heading level={3} className="text-lg font-semibold text-accent-secondary" id="room-form-title">
            {room ? "Edit Room" : "Add Room"}
          </Heading>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-muted transition-colors"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-accent-secondary/60">
              <path d="M4 4L20 20M20 4L4 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {serverError && (
            <div
              className="p-3 bg-status-danger-soft border border-status-danger-border rounded-lg text-status-danger-text text-sm flex items-start justify-between gap-2"
              role="alert"
            >
              <span>{serverError}</span>
              <button
                type="button"
                onClick={() => setServerError("")}
                className="text-status-danger-text/60 hover:text-status-danger-text"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          <div>
            <Label htmlFor="room-name" className="block text-sm font-medium text-accent-secondary mb-1">
              Room name
            </Label>
            <input
              id="room-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => handleBlur("name")}
              className={fieldClass("name")}
              placeholder="e.g. Conference Room A"
              maxLength={120}
            />
            {showFieldError("name") && (
              <p className="text-status-danger-text text-sm mt-1">{validationErrors.name}</p>
            )}
          </div>

          <div>
            <Label htmlFor="room-location" className="block text-sm font-medium text-accent-secondary mb-1">
              Location <span className="text-accent-secondary/50">(optional)</span>
            </Label>
            <input
              id="room-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={() => handleBlur("location")}
              className={fieldClass("location")}
              placeholder="e.g. Floor 1"
              maxLength={120}
            />
            {showFieldError("location") && (
              <p className="text-status-danger-text text-sm mt-1">{validationErrors.location}</p>
            )}
          </div>

          <div>
            <Label htmlFor="room-capacity" className="block text-sm font-medium text-accent-secondary mb-1">
              Capacity
            </Label>
            <input
              id="room-capacity"
              type="number"
              min={1}
              max={50}
              inputMode="numeric"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              onBlur={() => handleBlur("capacity")}
              className={fieldClass("capacity")}
              placeholder="1–50 people"
            />
            {showFieldError("capacity") && (
              <p className="text-status-danger-text text-sm mt-1">{validationErrors.capacity}</p>
            )}
          </div>

          {features.length > 0 && (
            <fieldset>
              <Label className="block text-sm font-medium text-accent-secondary mb-2">
                Features <span className="text-accent-secondary/50">(optional)</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {features.map((feature) => {
                  const isActive = selectedFeatureIds.includes(feature.id);
                  const Icon = FEATURE_ICONS[feature.icon] || FEATURE_ICONS.projector;
                  return (
                    <button
                      key={feature.id}
                      type="button"
                      onClick={() => handleFeatureToggle(feature.id)}
                      aria-pressed={isActive}
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
            </fieldset>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={submitting}>
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
                  Saving...
                </span>
              ) : room ? (
                "Save Changes"
              ) : (
                "Add Room"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
