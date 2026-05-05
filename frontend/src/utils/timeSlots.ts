import { DateTime } from "luxon";
import { OFFICE_TIMEZONE, OFFICE_HOURS, type BookingData, type DurationOption } from "./bookingUtils";

export interface TimePeriod {
  start: number;
  end: number;
  label: string;
}

export const TIME_PERIODS: Record<string, TimePeriod> = {
  morning: { start: 8, end: 12, label: "Morning" },
  afternoon: { start: 12, end: 17, label: "Afternoon" },
  evening: { start: 17, end: 22, label: "Evening" },
};

export type SlotStatus = "available" | "booked" | "past";

export interface FormattedSlot {
  start: string;
  end: string;
  period: string;
  duration: number;
  status: SlotStatus;
}

export class TimeSlot {
  start: DateTime;
  end: DateTime;
  status: SlotStatus;

  constructor(start: DateTime | string, end: DateTime | string, status: SlotStatus = "available") {
    this.start = this.normalizeDateTime(start);
    this.end = this.normalizeDateTime(end);
    this.status = status;
  }

  private normalizeDateTime(dt: DateTime | string): DateTime {
    if (typeof dt === "string") {
      const [hour, minute] = dt.split(":").map(Number);
      return DateTime.now()
        .setZone(OFFICE_TIMEZONE)
        .set({ hour, minute, second: 0, millisecond: 0 });
    }
    if (DateTime.isDateTime(dt) && !dt.zoneName?.endsWith(OFFICE_TIMEZONE)) {
      return dt.setZone(OFFICE_TIMEZONE);
    }
    return dt;
  }

  get duration(): number {
    return this.end.diff(this.start, "minutes").minutes;
  }

  get period(): string {
    const hour = this.start.hour;
    for (const [key, period] of Object.entries(TIME_PERIODS)) {
      if (hour >= period.start && hour < period.end) return key;
    }
    return "evening";
  }

  overlaps(other: { start: string | DateTime; end: string | DateTime }): boolean {
    const otherStart =
      typeof other.start === "string"
        ? DateTime.fromISO(other.start).setZone(OFFICE_TIMEZONE)
        : other.start;
    const otherEnd =
      typeof other.end === "string"
        ? DateTime.fromISO(other.end).setZone(OFFICE_TIMEZONE)
        : other.end;
    return this.start < otherEnd && this.end > otherStart;
  }

  canFitDuration(minutes: number): boolean {
    return this.duration >= minutes;
  }

  format(): FormattedSlot {
    const startBerlin = this.start.setZone(OFFICE_TIMEZONE);
    const endBerlin = this.end.setZone(OFFICE_TIMEZONE);
    return {
      start: startBerlin.toFormat("HH:mm"),
      end: endBerlin.toFormat("HH:mm"),
      period: this.period,
      duration: this.duration,
      status: this.status,
    };
  }

  static fromBooking(booking: BookingData): TimeSlot {
    return new TimeSlot(
      DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE),
      DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE),
      "booked"
    );
  }
}

const STANDARD_DURATIONS: DurationOption[] = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 45, label: "45 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 90, label: "1.5 hours" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" },
  { minutes: 240, label: "4 hours" },
];

export function getSlotDurations(slot: TimeSlot): DurationOption[] {
  return STANDARD_DURATIONS.filter((d) => slot.canFitDuration(d.minutes));
}

export function getAvailableDurationsForDate(date: DateTime | Date | null): DurationOption[] {
  return _getAvailableDurations(date);
}

/** @deprecated Use getAvailableDurationsForDate instead */
export function getAvailableDurations(date: DateTime | Date | null): DurationOption[] {
  return _getAvailableDurations(date);
}

function _getAvailableDurations(date: DateTime | Date | null): DurationOption[] {
  if (!date) return STANDARD_DURATIONS;

  const now = DateTime.now().setZone(OFFICE_TIMEZONE);
  const dateTime = DateTime.isDateTime(date)
    ? date
    : DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE);

  if (dateTime.hasSame(now, "day")) {
    const remainingMinutes = (OFFICE_HOURS.end - now.hour) * 60 - now.minute;
    return STANDARD_DURATIONS.filter((d) => d.minutes <= remainingMinutes);
  }

  const maxMinutes = (OFFICE_HOURS.end - OFFICE_HOURS.start) * 60;
  return STANDARD_DURATIONS.filter((d) => d.minutes <= maxMinutes);
}

export function findNextAvailableDay(
  startDate: Date,
  bookings: BookingData[],
  roomId: number
): DateTime | null {
  let current = DateTime.fromJSDate(startDate).setZone(OFFICE_TIMEZONE);
  const maxDate = DateTime.now().plus({ days: 90 });

  while (current <= maxDate) {
    const dayBookings = bookings.filter((booking) => {
      const bookingDate = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
      return bookingDate.hasSame(current, "day") && booking.room === roomId;
    });

    if (!isDayFullyBooked(current, dayBookings)) {
      return current;
    }
    current = current.plus({ days: 1 });
  }
  return null;
}

export function isDayFullyBooked(date: DateTime, bookings: BookingData[]): boolean {
  const slots = getAvailableSlots(date, bookings);
  return slots.length === 0;
}

export function getDaySlots(date: DateTime, bookings: BookingData[]): TimeSlot[] {
  const dayStart = date.set({ hour: OFFICE_HOURS.start, minute: 0 });
  const dayEnd = date.set({ hour: OFFICE_HOURS.end, minute: 0 });
  const now = DateTime.now().setZone(OFFICE_TIMEZONE);

  const bookedSlots = bookings
    .filter((booking) => {
      const bookingStart = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
      return bookingStart.hasSame(date, "day");
    })
    .map((booking) => TimeSlot.fromBooking(booking));

  const allSlots: TimeSlot[] = [];
  let current = dayStart;

  while (current < dayEnd) {
    const slotEnd = current.plus({ minutes: OFFICE_HOURS.minDuration });
    const slot = new TimeSlot(current, slotEnd);

    if (current < now) {
      slot.status = "past";
    } else if (bookedSlots.some((bookedSlot) => slot.overlaps(bookedSlot))) {
      slot.status = "booked";
    }

    allSlots.push(slot);
    current = slotEnd;
  }

  return allSlots;
}

export function getAvailableSlots(
  date: DateTime,
  bookings: BookingData[],
  minDuration: number = OFFICE_HOURS.minDuration,
  currentTime: DateTime | null = null
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const startTime = date.set({
    hour: OFFICE_HOURS.start,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const endTime = date.set({ hour: OFFICE_HOURS.end, minute: 0, second: 0, millisecond: 0 });
  let current = startTime;

  if (currentTime && date.hasSame(currentTime, "day")) {
    current = currentTime.set({
      minute: Math.ceil(currentTime.minute / 15) * 15,
      second: 0,
      millisecond: 0,
    });
    if (current.minute === 0) {
      current = current.plus({ hours: 1 });
    }
  }

  while (current < endTime) {
    const nextBooking = bookings
      .map((booking) => ({
        start: DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE),
        end: DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE),
      }))
      .filter((booking) => booking.start > current)
      .sort((a, b) => (a.start < b.start ? -1 : 1))[0];

    let maxEnd = endTime;
    if (nextBooking) {
      maxEnd = nextBooking.start < endTime ? nextBooking.start : endTime;
    }

    const slot = new TimeSlot(current, maxEnd);

    if (slot.duration >= OFFICE_HOURS.minDuration) {
      const isAvailable = !bookings.some((booking) => {
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

export function groupSlotsByPeriod(slots: TimeSlot[]): Record<string, TimeSlot[]> {
  const groups: Record<string, TimeSlot[]> = {};

  for (const slot of slots) {
    const startHour = slot.start.hour;
    const endHour = slot.end.hour;

    Object.entries(TIME_PERIODS).forEach(([periodKey, period]) => {
      if (startHour < period.end && endHour >= period.start) {
        if (!groups[periodKey]) {
          groups[periodKey] = [];
        }

        const periodStart =
          slot.start.hour < period.start
            ? slot.start.set({ hour: period.start, minute: 0 })
            : slot.start;

        let periodEnd: DateTime;
        if (slot.end.hour > period.end) {
          periodEnd = slot.start.set({ hour: period.end, minute: 0 });
        } else if (slot.end.hour < period.end) {
          periodEnd = slot.end;
        } else {
          periodEnd = slot.end;
        }

        if (periodEnd > periodStart) {
          const periodSlot = new TimeSlot(periodStart, periodEnd);

          const isDuplicate = groups[periodKey].some(
            (existingSlot) =>
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
