import { DateTime } from "luxon";

export interface BookingConflictInput {
  start_time: string;
  end_time: string;
  room?: number | { id: number };
  id?: number;
  [key: string]: unknown;
}

export type ConflictType =
  | "completely_inside"
  | "completely_covers"
  | "end_overlap"
  | "start_overlap";

export interface ConflictResult {
  booking: BookingConflictInput;
  conflictType: ConflictType;
}

export interface FormConflictResult {
  hasConflict: boolean;
  conflict: ConflictResult | null;
  message: string | null;
}

export function checkBookingConflict(
  slotStart: DateTime,
  slotEnd: DateTime,
  bookings: BookingConflictInput[],
  roomId: number | string,
  excludeBookingId: number | string | null = null
): ConflictResult | null {
  const relevantBookings = bookings.filter((booking) => {
    const bookingStart = DateTime.fromISO(booking.start_time);
    const bookingRoomId =
      typeof booking.room === "object" && booking.room !== null
        ? (booking.room as { id: number }).id
        : booking.room;
    if (excludeBookingId && booking.id === excludeBookingId) return false;
    return bookingRoomId === roomId && bookingStart.hasSame(slotStart, "day");
  });

  for (const booking of relevantBookings) {
    const bookingStart = DateTime.fromISO(booking.start_time);
    const bookingEnd = DateTime.fromISO(booking.end_time);

    if (slotStart < bookingEnd && slotEnd > bookingStart) {
      return {
        booking,
        conflictType: getConflictType(slotStart, slotEnd, bookingStart, bookingEnd),
      };
    }
  }

  return null;
}

function getConflictType(
  slotStart: DateTime,
  slotEnd: DateTime,
  bookingStart: DateTime,
  bookingEnd: DateTime
): ConflictType {
  if (slotStart >= bookingStart && slotEnd <= bookingEnd) return "completely_inside";
  if (slotStart <= bookingStart && slotEnd >= bookingEnd) return "completely_covers";
  if (slotStart < bookingStart && slotEnd > bookingStart) return "end_overlap";
  return "start_overlap";
}

export function getConflictMessage(conflict: ConflictResult | null): string | null {
  if (!conflict) return null;

  const { booking, conflictType } = conflict;
  const startTime = DateTime.fromISO(booking.start_time).toFormat("HH:mm");
  const endTime = DateTime.fromISO(booking.end_time).toFormat("HH:mm");

  switch (conflictType) {
    case "completely_inside":
      return `This time overlaps with an existing booking (${startTime}–${endTime}).`;
    case "completely_covers":
      return `You cannot book over an existing meeting (${startTime}–${endTime}).`;
    case "end_overlap":
      return `Your booking would end during an existing meeting (${startTime}–${endTime}).`;
    case "start_overlap":
      return `Your booking would start during an existing meeting (${startTime}–${endTime}).`;
    default:
      return `This room is already booked from ${startTime} to ${endTime}.`;
  }
}

export function useFormConflict(
  selectedDate: DateTime | null,
  selectedSlot: { start: DateTime; end: DateTime } | null,
  bookings: BookingConflictInput[],
  roomId: number | string | null
): FormConflictResult {
  if (!selectedDate || !selectedSlot || !bookings || !roomId) {
    return { hasConflict: false, conflict: null, message: null };
  }

  const conflict = checkBookingConflict(
    selectedSlot.start,
    selectedSlot.end,
    bookings,
    roomId
  );

  return {
    hasConflict: !!conflict,
    conflict,
    message: conflict ? getConflictMessage(conflict) : null,
  };
}
