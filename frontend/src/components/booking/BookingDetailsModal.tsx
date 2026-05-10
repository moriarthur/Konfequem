import { DateTime } from "luxon";
import { OFFICE_TIMEZONE } from "../../utils/bookingUtils";
import Button from "../ui/Button";
import { Heading } from "../ui/Typography";
import StatusBadge from "../StatusBadge";

interface Booking {
  id: number;
  room_name?: string;
  room?: number | { id: number };
  start_time: string;
  end_time: string;
  status?: string;
  [key: string]: unknown;
}

interface BookingDetailsModalProps {
  booking: Booking;
  onClose: () => void;
  onEdit: (booking: Booking) => void;
  onCancel: (booking: Booking) => void;
}

function formatDuration(startTime: string, endTime: string): string {
  const start = DateTime.fromISO(startTime);
  const end = DateTime.fromISO(endTime);
  const diff = end.diff(start, ["hours", "minutes"]);
  const hours = diff.hours;
  const minutes = Math.round(diff.minutes);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function getBookingStatus(booking: Booking): "upcoming" | "ongoing" | "completed" {
  const now = DateTime.now().setZone(OFFICE_TIMEZONE);
  const start = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
  const end = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
  if (now < start) return "upcoming";
  if (now >= start && now < end) return "ongoing";
  return "completed";
}

export default function BookingDetailsModal({ booking, onClose, onEdit, onCancel }: BookingDetailsModalProps) {
  const start = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
  const end = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
  const status = getBookingStatus(booking);
  const roomName = booking.room_name || (typeof booking.room === "object" ? `Room ${booking.room.id}` : `Room ${booking.room}`);
  const canAct = status === "upcoming";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-surface-base border border-border-subtle rounded-2xl shadow-soft p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-4">
          <Heading level={3} className="text-lg font-semibold text-accent-secondary">Booking Details</Heading>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-muted transition-colors" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-accent-secondary/60">
              <path d="M4 4L20 20M20 4L4 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="bg-surface-muted rounded-xl p-4 mb-4">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-accent-secondary">{roomName}</span>
              <StatusBadge status={status} size="sm" />
            </div>
            <div className="flex items-center gap-2 text-accent-secondary/70">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M3 10H21" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M16 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>{start.toFormat("EEEE, dd.MM.yyyy")}</span>
            </div>
            <div className="flex items-center gap-2 text-accent-secondary/70">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 8V12L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>{start.toFormat("HH:mm")} – {end.toFormat("HH:mm")} ({formatDuration(booking.start_time, booking.end_time)})</span>
            </div>
          </div>
        </div>

        {canAct ? (
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => onEdit(booking)}>
              Edit
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => onCancel(booking)}>
              Cancel Booking
            </Button>
          </div>
        ) : (
          <Button variant="secondary" className="w-full" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </div>
  );
}
