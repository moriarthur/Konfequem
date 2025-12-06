import { DateTime } from "luxon";

// Office timezone and hours
export const OFFICE_TIMEZONE = "Europe/Berlin";
export const OFFICE_HOURS = {
  start: 8,
  end: 22,
  minDuration: 15, // minutes
  maxDuration: 8 * 60, // 8 hours in minutes
};

// Convert Date to Luxon DateTime in office timezone
export function toOfficeTime(date) {
  return DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE);
}

// Check if a time slot is within office hours
export function isWithinOfficeHours(startTime, endTime) {
  const start = toOfficeTime(startTime);
  const end = toOfficeTime(endTime);
  
  return start.hour >= OFFICE_HOURS.start && 
         start.hour < OFFICE_HOURS.end &&
         end.hour <= OFFICE_HOURS.end &&
         end.hour >= OFFICE_HOURS.start;
}

// Find available slots for a given day and existing bookings
export function findAvailableSlots(date, existingBookings, duration = OFFICE_HOURS.minDuration) {
  const dayStart = toOfficeTime(date).set({ hour: OFFICE_HOURS.start, minute: 0 });
  const dayEnd = toOfficeTime(date).set({ hour: OFFICE_HOURS.end, minute: 0 });
  
  // Convert bookings to Luxon DateTime objects in office timezone
  const bookings = existingBookings.map(booking => ({
    start: DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE),
    end: DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE)
  })).sort((a, b) => a.start.toMillis() - b.start.toMillis());

  const slots = [];
  let current = dayStart;

  while (current < dayEnd) {
    const slotEnd = current.plus({ minutes: duration });
    
    // Check if slot exceeds day end
    if (slotEnd > dayEnd) break;
    
    // Check for overlap with existing bookings
    const hasOverlap = bookings.some(booking => 
      current < booking.end && slotEnd > booking.start
    );

    if (!hasOverlap) {
      slots.push(current);
    }

    current = current.plus({ minutes: OFFICE_HOURS.minDuration });
  }

  return slots;
}

// Format slot for display
export function formatSlot(dateTime) {
  return dateTime.toFormat('HH:mm');
}

// Get available durations for a start time
export function getAvailableDurations(startTime, existingBookings, selectedDate) {
  const start = toOfficeTime(startTime);
  const dayEnd = toOfficeTime(selectedDate).set({ hour: OFFICE_HOURS.end, minute: 0 });
  
  // Convert bookings to Luxon and filter future bookings
  const futureBookings = existingBookings
    .map(booking => ({
      start: DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE),
      end: DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE)
    }))
    .filter(booking => booking.start > start)
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());

  const nextBooking = futureBookings[0];
  const maxEnd = nextBooking ? nextBooking.start : dayEnd;
  
  const durations = [];
  let duration = OFFICE_HOURS.minDuration;
  
  while (duration <= OFFICE_HOURS.maxDuration) {
    const end = start.plus({ minutes: duration });
    if (end > maxEnd) break;
    
    durations.push({
      minutes: duration,
      label: duration < 60 
        ? `${duration} min` 
        : `${Math.floor(duration/60)}h${duration%60 ? ` ${duration%60}m` : ''}`
    });
    
    duration += OFFICE_HOURS.minDuration;
  }
  
  return durations;
}

// Convert local datetime to UTC ISO string for API
export function toUTCString(dateTime) {
  return dateTime.toUTC().toISO();
}

// Check if a day has any available slots
export function hasDayAvailableSlots(date, existingBookings) {
  return findAvailableSlots(date, existingBookings).length > 0;
}