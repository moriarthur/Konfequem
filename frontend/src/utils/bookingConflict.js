import { DateTime } from "luxon";

/**
 * Check if a time slot conflicts with existing bookings
 * @param {DateTime} slotStart - Start of the slot to check
 * @param {DateTime} slotEnd - End of the slot to check
 * @param {Array} bookings - Array of existing bookings
 * @param {number|string} roomId - Room ID to filter bookings
 * @returns {Object|null} - Returns conflicting booking object or null if no conflict
 */
export function checkBookingConflict(slotStart, slotEnd, bookings, roomId) {
  // Filter bookings for the same room and day
  const relevantBookings = bookings.filter((booking) => {
    const bookingStart = DateTime.fromISO(booking.start_time);
    const bookingRoomId = booking.room?.id || booking.room;
    return (
      bookingRoomId === roomId &&
      bookingStart.hasSame(slotStart, "day")
    );
  });

  // Check for overlaps
  for (const booking of relevantBookings) {
    const bookingStart = DateTime.fromISO(booking.start_time);
    const bookingEnd = DateTime.fromISO(booking.end_time);

    // Two intervals overlap if: start1 < end2 AND end1 > start2
    if (slotStart < bookingEnd && slotEnd > bookingStart) {
      return {
        booking,
        conflictType: getConflictType(slotStart, slotEnd, bookingStart, bookingEnd),
      };
    }
  }

  return null;
}

/**
 * Determine the type of conflict for better error messages
 */
function getConflictType(slotStart, slotEnd, bookingStart, bookingEnd) {
  if (slotStart >= bookingStart && slotEnd <= bookingEnd) {
    return "completely_inside"; // New slot is entirely within existing booking
  }
  if (slotStart <= bookingStart && slotEnd >= bookingEnd) {
    return "completely_covers"; // New slot completely covers existing booking
  }
  if (slotStart < bookingStart && slotEnd > bookingStart) {
    return "end_overlap"; // New slot ends during existing booking
  }
  return "start_overlap"; // New slot starts during existing booking
}

/**
 * Get a user-friendly error message for the conflict
 */
export function getConflictMessage(conflict) {
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

/**
 * Check if the current form selection has a conflict
 */
export function useFormConflict(selectedDate, selectedSlot, bookings, roomId) {
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
