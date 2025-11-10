import { DateTime } from "luxon";
import { OFFICE_TIMEZONE, OFFICE_HOURS } from "./bookingUtils";

// Time periods for grouping slots
export const TIME_PERIODS = {
  morning: { start: 8, end: 12, label: "Morning" },
  afternoon: { start: 12, end: 17, label: "Afternoon" },
  evening: { start: 17, end: 22, label: "Evening" }
};

// Represents a time slot with status
export class TimeSlot {
  constructor(start, end, status = "available") {
    // Ensure start and end are DateTime objects in the office timezone
    if (typeof start === 'string') {
      const [hour, minute] = start.split(":").map(Number);
      start = DateTime.now()
        .setZone(OFFICE_TIMEZONE)
        .set({ hour, minute, second: 0, millisecond: 0 });
    } else if (DateTime.isDateTime(start) && !start.zone.equals(OFFICE_TIMEZONE)) {
      start = start.setZone(OFFICE_TIMEZONE);
    }

    if (typeof end === 'string') {
      const [hour, minute] = end.split(":").map(Number);
      end = DateTime.now()
        .setZone(OFFICE_TIMEZONE)
        .set({ hour, minute, second: 0, millisecond: 0 });
    } else if (DateTime.isDateTime(end) && !end.zone.equals(OFFICE_TIMEZONE)) {
      end = end.setZone(OFFICE_TIMEZONE);
    }

    this.start = start;
    this.end = end;
    this.status = status; // "available", "booked", "past"
  }

  get duration() {
    return this.end.diff(this.start, 'minutes').minutes;
  }

  get period() {
    const hour = this.start.hour;
    for (const [key, period] of Object.entries(TIME_PERIODS)) {
      if (hour >= period.start && hour < period.end) return key;
    }
    return "evening";
  }

  overlaps(other) {
    const otherStart = typeof other.start === 'string' 
      ? DateTime.fromISO(other.start).setZone(OFFICE_TIMEZONE)
      : other.start;
    const otherEnd = typeof other.end === 'string'
      ? DateTime.fromISO(other.end).setZone(OFFICE_TIMEZONE)
      : other.end;
    return this.start < otherEnd && this.end > otherStart;
  }

  canFitDuration(minutes) {
    return this.duration >= minutes;
  }

  format() {
    const startBerlin = this.start.setZone(OFFICE_TIMEZONE);
    const endBerlin = this.end.setZone(OFFICE_TIMEZONE);
    return {
      start: startBerlin.toFormat("HH:mm"),
      end: endBerlin.toFormat("HH:mm"),
      period: this.period,
      duration: this.duration,
      status: this.status
    };
  }

  static fromBooking(booking) {
    return new TimeSlot(
      DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE),
      DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE),
      "booked"
    );
  }
}

// Find next available day with slots
export function findNextAvailableDay(startDate, bookings, roomId) {
  let current = DateTime.fromJSDate(startDate).setZone(OFFICE_TIMEZONE);
  const maxDate = DateTime.now().plus({ days: 90 });

  while (current <= maxDate) {
    const dayBookings = bookings.filter(booking => {
      const bookingDate = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
      return bookingDate.hasSame(current, 'day') && booking.room === roomId;
    });

    if (!isDayFullyBooked(current, dayBookings)) {
      return current;
    }
    current = current.plus({ days: 1 });
  }
  return null;
}

// Check if a day is fully booked
export function isDayFullyBooked(date, bookings) {
  const slots = getAvailableSlots(date, bookings);
  return slots.length === 0;
}

// Get all slots for a day, marking their status
export function getDaySlots(date, bookings) {
  const dayStart = date.set({ hour: OFFICE_HOURS.start, minute: 0 });
  const dayEnd = date.set({ hour: OFFICE_HOURS.end, minute: 0 });
  const now = DateTime.now().setZone(OFFICE_TIMEZONE);

  // Convert bookings to TimeSlots
  const bookedSlots = bookings
    .filter(booking => {
      const bookingStart = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
      return bookingStart.hasSame(date, 'day');
    })
    .map(booking => TimeSlot.fromBooking(booking));

  // Create all possible slots
  const allSlots = [];
  let current = dayStart;

  while (current < dayEnd) {
    const slotEnd = current.plus({ minutes: OFFICE_HOURS.minDuration });
    const slot = new TimeSlot(current, slotEnd);

    // Check if slot is in the past
    if (current < now) {
      slot.status = "past";
    }
    // Check if slot overlaps with any booking
    else if (bookedSlots.some(bookedSlot => slot.overlaps(bookedSlot))) {
      slot.status = "booked";
    }

    allSlots.push(slot);
    current = slotEnd;
  }

  return allSlots;
}

// Get available slots that can fit the requested duration
export function getAvailableSlots(date, bookings, minDuration = OFFICE_HOURS.minDuration, currentTime = null) {
  // Create slots at specified intervals
  const slots = [];
  const startTime = date.set({ hour: OFFICE_HOURS.start, minute: 0, second: 0, millisecond: 0 });
  const endTime = date.set({ hour: OFFICE_HOURS.end, minute: 0, second: 0, millisecond: 0 });
  let current = startTime;

  // If we have a current time and it's today, start from the next available slot
  if (currentTime && date.hasSame(currentTime, 'day')) {
    current = currentTime.set({ 
      minute: Math.ceil(currentTime.minute / 15) * 15,
      second: 0,
      millisecond: 0
    });
    if (current.minute === 0) {
      current = current.plus({ hours: 1 });
    }
  }

  // Generate slots at 15-minute intervals
  while (current < endTime) {
    // Find the next booking that would block this slot
    const nextBooking = bookings
      .map(booking => ({
        start: DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE),
        end: DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE)
      }))
      .filter(booking => booking.start > current)
      .sort((a, b) => a.start < b.start ? -1 : 1)[0];

    // Calculate maximum possible duration for this slot
    let maxEnd = endTime;
    if (nextBooking) {
      maxEnd = nextBooking.start < endTime ? nextBooking.start : endTime;
    }

    // Create a slot with maximum possible duration
    const slot = new TimeSlot(current, maxEnd);

    // Check if slot is valid (at least minimum duration)
    if (slot.duration >= OFFICE_HOURS.minDuration) {
      // Check if slot doesn't overlap with any previous booking
      const isAvailable = !bookings.some(booking => {
        const bookingStart = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
        const bookingEnd = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
        return current < bookingEnd && maxEnd > bookingStart;
      });

      if (isAvailable) {
        slots.push(slot);
      }
    }

    current = current.plus({ minutes: minDuration });
  }

  return slots;
}

// Group available times by period
export function groupSlotsByPeriod(slots) {
  const groups = {};
  
  for (const slot of slots) {
    // For slots that span multiple periods, we need to split them
    const startHour = slot.start.hour;
    const endHour = slot.end.hour;
    
    // Find all periods this slot spans
    Object.entries(TIME_PERIODS).forEach(([periodKey, period]) => {
      if (startHour < period.end && endHour >= period.start) {
        // This slot is at least partially in this period
        if (!groups[periodKey]) {
          groups[periodKey] = [];
        }
        
        // Calculate slot boundaries within this period
        const periodStart = slot.start.hour < period.start 
          ? slot.start.set({ hour: period.start, minute: 0 })
          : slot.start;
        
        // For end time, we need to limit it to either the original slot end or the period end
        let periodEnd;
        if (slot.end.hour > period.end) {
          // If original slot extends beyond period, limit to period end
          periodEnd = slot.start.set({ hour: period.end, minute: 0 });
        } else if (slot.end.hour < period.end) {
          // If original slot ends before period end, keep original end time
          periodEnd = slot.end;
        } else {
          // If slot ends exactly at period end hour, use slot's end time to preserve minutes
          periodEnd = slot.end;
        }
        
        // Only add the slot if it has valid duration and doesn't already exist
        if (periodEnd > periodStart) {
          const periodSlot = new TimeSlot(periodStart, periodEnd);
          
          // Check for duplicates before adding
          const isDuplicate = groups[periodKey].some(existingSlot => 
            existingSlot.start.equals(periodSlot.start) && 
            existingSlot.end.equals(periodSlot.end)
          );
          
          if (!isDuplicate) {
            groups[periodKey].push(periodSlot);
          }
        }
      }
    });
  }
  
  return groups;
}

// Get available durations that could fit in a slot
export function getSlotDurations(slot) {
  const standardDurations = [
    { minutes: 15, label: "15 min" },
    { minutes: 30, label: "30 min" },
    { minutes: 45, label: "45 min" },
    { minutes: 60, label: "1 hour" },
    { minutes: 90, label: "1.5 hours" },
    { minutes: 120, label: "2 hours" },
    { minutes: 180, label: "3 hours" },
    { minutes: 240, label: "4 hours" }
  ];

    return standardDurations.filter(d => slot.canFitDuration(d.minutes));
  }

// Get all available durations for current day/time
export function getAvailableDurations(date) {
  const standardDurations = [
    { minutes: 15, label: "15 min" },
    { minutes: 30, label: "30 min" },
    { minutes: 45, label: "45 min" },
    { minutes: 60, label: "1 hour" },
    { minutes: 90, label: "1.5 hours" },
    { minutes: 120, label: "2 hours" },
    { minutes: 180, label: "3 hours" },
    { minutes: 240, label: "4 hours" }
  ];

  // Filter based on time of day and remaining office hours
  const now = DateTime.now().setZone(OFFICE_TIMEZONE);
  if (!date) return standardDurations;

  // Handle both Date and DateTime objects
  const dateTime = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE);

  if (dateTime.hasSame(now, 'day')) {
    const remainingMinutes = (OFFICE_HOURS.end - now.hour) * 60 - now.minute;
    return standardDurations.filter(d => d.minutes <= remainingMinutes);
  }

  // For future dates, ensure the duration fits within office hours
  const maxMinutes = (OFFICE_HOURS.end - OFFICE_HOURS.start) * 60;
  return standardDurations.filter(d => d.minutes <= maxMinutes);
}