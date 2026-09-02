import { DateTime } from "luxon";
import { Text } from "../ui/Typography";
import { OFFICE_TIMEZONE } from "../../utils/bookingUtils";
import type { CalendarBooking } from "./useCalendarBookings";

interface BookingCardInlineProps {
  booking: CalendarBooking;
  isNext: boolean;
  isEditing: boolean;
  canEdit: boolean;
  editForm: { start_time: string; end_time: string };
  saving: boolean;
  validationErrors: Record<string, string>;
  onEdit: (booking: CalendarBooking) => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDeleteClick: (booking: CalendarBooking) => void;
  onEditFormChange: (form: { start_time: string; end_time: string }) => void;
  onClearErrors: (keys: string[]) => void;
}

const STATUS_STYLES: Record<string, string> = {
  past: "bg-surface-muted border-border-subtle text-accent-secondary/40",
  current: "bg-status-success/10 border-status-success/20 text-status-success",
  next: "bg-status-warning/10 border-status-warning/20 text-status-warning",
  future: "bg-accent-primary/5 border-accent-primary/10 text-accent-secondary",
  cancelled: "bg-status-danger/10 border-status-danger/20 text-status-danger-text",
};

const STATUS_LABELS: Record<string, string> = { past: "Past", current: "Now", next: "Next", future: "Upcoming", cancelled: "Cancelled" };

function formatDuration(startTime: string | null, endTime: string | null): string {
  if (!startTime || !endTime) return "--";
  const start = DateTime.fromISO(startTime);
  const end = DateTime.fromISO(endTime);
  if (!start.isValid || !end.isValid) return "--";
  const diff = end.diff(start, ["hours", "minutes"]);
  const hours = diff.hours;
  const minutes = Math.round(diff.minutes);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export default function BookingCardInline({
  booking, isNext, isEditing, canEdit,
  editForm, saving, validationErrors,
  onEdit, onCancelEdit, onSave, onDeleteClick,
  onEditFormChange, onClearErrors,
}: BookingCardInlineProps) {
  const now = DateTime.now().setZone(OFFICE_TIMEZONE);
  const bookingStart = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
  const bookingEnd = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
  const isPast = bookingEnd < now;
  const isCurrent = now >= bookingStart && now < bookingEnd;
  const status = booking.status === "cancelled"
    ? "cancelled"
    : isPast ? "past" : isCurrent ? "current" : isNext ? "next" : "future";
  // Cancelled bookings are history — never editable, regardless of canEdit.
  const editable = canEdit && status !== "cancelled";

  return (
    <div className={`border rounded-xl transition-all ${STATUS_STYLES[status]} ${
      !isEditing && editable ? "cursor-pointer hover:ring-2 hover:ring-accent-primary/30" : ""
    }`}>
      {isEditing ? (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Text className="font-medium">Edit booking</Text>
            <button onClick={onCancelEdit} className="text-accent-secondary/60 hover:text-accent-secondary">Cancel</button>
          </div>

          {validationErrors.overlap && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <Text className="text-sm text-red-600">{validationErrors.overlap}</Text>
            </div>
          )}
          {validationErrors.duration && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <Text className="text-sm text-red-600">{validationErrors.duration}</Text>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-accent-secondary mb-1">Start time</label>
              <input
                type="time"
                value={editForm.start_time ? DateTime.fromISO(editForm.start_time).toFormat("HH:mm") : ""}
                onChange={(e) => {
                  const [hours, minutes] = e.target.value.split(":");
                  const newStart = bookingStart.set({ hour: parseInt(hours), minute: parseInt(minutes) });
                  const currentEnd = editForm.end_time ? DateTime.fromISO(editForm.end_time).setZone(OFFICE_TIMEZONE) : null;
                  if (currentEnd && newStart >= currentEnd.minus({ minutes: 15 })) {
                    onEditFormChange({ start_time: newStart.toISO()!, end_time: newStart.plus({ minutes: 15 }).toISO()! });
                  } else {
                    const duration = bookingEnd.diff(bookingStart);
                    onEditFormChange({ start_time: newStart.toISO()!, end_time: newStart.plus(duration).toISO()! });
                  }
                  onClearErrors(["start_time", "overlap"]);
                }}
                className={`w-full px-3 py-2 border rounded-lg bg-surface-base text-accent-secondary ${
                  validationErrors.start_time ? "border-red-500" : "border-border-subtle"
                }`}
              />
              <div className="mt-1 flex justify-between">
                <Text variant="muted" className="text-xs">{bookingStart.toFormat("EEE, MMM d")}</Text>
                {validationErrors.start_time && <Text className="text-xs text-red-500">{validationErrors.start_time}</Text>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-accent-secondary mb-1">End time</label>
              <input
                type="time"
                value={editForm.end_time ? DateTime.fromISO(editForm.end_time).toFormat("HH:mm") : ""}
                onChange={(e) => {
                  const [hours, minutes] = e.target.value.split(":");
                  const newEnd = bookingStart.set({ hour: parseInt(hours), minute: parseInt(minutes) });
                  const currentStart = editForm.start_time ? DateTime.fromISO(editForm.start_time).setZone(OFFICE_TIMEZONE) : null;
                  if (currentStart && newEnd <= currentStart.plus({ minutes: 15 })) return;
                  onEditFormChange({ ...editForm, end_time: newEnd.toISO()! });
                  onClearErrors(["end_time", "duration", "overlap"]);
                }}
                className={`w-full px-3 py-2 border rounded-lg bg-surface-base text-accent-secondary ${
                  validationErrors.end_time ? "border-red-500" : "border-border-subtle"
                }`}
              />
              {validationErrors.end_time && <Text className="text-xs text-red-500 mt-1 block">{validationErrors.end_time}</Text>}
            </div>

            <div className="flex justify-between items-center">
              <Text variant="muted" className="text-xs">Duration: {formatDuration(editForm.start_time, editForm.end_time)}</Text>
              {(validationErrors.duration || validationErrors.overlap) && (
                <Text className="text-xs text-red-500">{validationErrors.duration || validationErrors.overlap}</Text>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={onSave} disabled={saving} className="flex-1 px-4 py-2 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={() => onDeleteClick(booking)} className="px-4 py-2 border border-red-500/30 text-red-600 rounded-lg hover:bg-red-50" title="Delete booking">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                <path d="M5 8H19M5 8C5 6.11438 5 5.17157 5.58579 4.58579C6.17157 4 7.11438 4 9 4H15C16.8856 4 17.8284 4 18.4142 4.58579C19 5.17157 19 6.11438 19 8M5 8V18C5 19.8856 5 20.8284 5.58579 21.4142C6.17157 22 7.11438 22 9 22H15C16.8856 22 17.8284 22 18.4142 21.4142C19 20.8284 19 19.8856 19 18V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 12V16M14 12V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4" onClick={() => editable && onEdit(booking)}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {(isCurrent || isNext || status === "cancelled") && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/50">{STATUS_LABELS[status]}</span>
                )}
                <Text className="font-medium truncate">{booking.room_name || (typeof booking.room === "object" ? booking.room.id : booking.room)}</Text>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0 opacity-70">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 8V12L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>{bookingStart.toFormat("HH:mm")} - {bookingEnd.toFormat("HH:mm")}</span>
                <span className="text-xs opacity-60">({formatDuration(booking.start_time, booking.end_time)})</span>
              </div>
            </div>
            {editable && (
              <div className="flex-shrink-0 p-1">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-40">
                  <path d="M13.5203 3.83582C14.0787 3.27745 14.9871 3.27745 15.5455 3.83582L20.1642 8.4545C20.7225 9.01287 20.7225 9.92127 20.1642 10.4796L18.9497 11.6942L12.3058 5.05025L13.5203 3.83582ZM10.8984 6.45762L3.02019 14.3358L2.75166 18.9834L7.39929 18.7149L15.2775 10.8367L10.8984 6.45762Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
