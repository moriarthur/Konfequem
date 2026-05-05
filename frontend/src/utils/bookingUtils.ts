import { DateTime } from "luxon";

export const OFFICE_TIMEZONE = "Europe/Berlin";

export const OFFICE_HOURS = {
  start: 8,
  end: 22,
  minDuration: 15,
  maxDuration: 8 * 60,
};

export const TOAST_DURATION_MS = 3000;

export interface BookingData {
  start_time: string;
  end_time: string;
  room?: number | { id: number };
  [key: string]: unknown;
}

export interface DurationOption {
  minutes: number;
  label: string;
}

export function toOfficeTime(date: Date): DateTime {
  return DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE);
}

export function isWithinOfficeHours(startTime: Date, endTime: Date): boolean {
  const start = toOfficeTime(startTime);
  const end = toOfficeTime(endTime);

  return (
    start.hour >= OFFICE_HOURS.start &&
    start.hour < OFFICE_HOURS.end &&
    end.hour <= OFFICE_HOURS.end &&
    end.hour >= OFFICE_HOURS.start
  );
}

export function findAvailableSlots(
  date: Date,
  existingBookings: BookingData[],
  duration: number = OFFICE_HOURS.minDuration
): DateTime[] {
  const dayStart = toOfficeTime(date).set({ hour: OFFICE_HOURS.start, minute: 0 });
  const dayEnd = toOfficeTime(date).set({ hour: OFFICE_HOURS.end, minute: 0 });

  const bookings = existingBookings
    .map((booking) => ({
      start: DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE),
      end: DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE),
    }))
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());

  const slots: DateTime[] = [];
  let current = dayStart;

  while (current < dayEnd) {
    const slotEnd = current.plus({ minutes: duration });

    if (slotEnd > dayEnd) break;

    const hasOverlap = bookings.some(
      (booking) => current < booking.end && slotEnd > booking.start
    );

    if (!hasOverlap) {
      slots.push(current);
    }

    current = current.plus({ minutes: OFFICE_HOURS.minDuration });
  }

  return slots;
}

export function formatSlot(dateTime: DateTime): string {
  return dateTime.toFormat("HH:mm");
}

export function getAvailableDurations(
  startTime: Date,
  existingBookings: BookingData[],
  selectedDate: Date
): DurationOption[] {
  const start = toOfficeTime(startTime);
  const dayEnd = toOfficeTime(selectedDate).set({ hour: OFFICE_HOURS.end, minute: 0 });

  const futureBookings = existingBookings
    .map((booking) => ({
      start: DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE),
      end: DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE),
    }))
    .filter((booking) => booking.start > start)
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());

  const nextBooking = futureBookings[0];
  const maxEnd = nextBooking ? nextBooking.start : dayEnd;

  const durations: DurationOption[] = [];
  let dur = OFFICE_HOURS.minDuration;

  while (dur <= OFFICE_HOURS.maxDuration) {
    const end = start.plus({ minutes: dur });
    if (end > maxEnd) break;

    durations.push({
      minutes: dur,
      label:
        dur < 60
          ? `${dur} min`
          : `${Math.floor(dur / 60)}h${dur % 60 ? ` ${dur % 60}m` : ""}`,
    });

    dur += OFFICE_HOURS.minDuration;
  }

  return durations;
}

export function toUTCString(dateTime: DateTime): string {
  return dateTime.toUTC().toISO()!;
}

export function hasDayAvailableSlots(date: Date, existingBookings: BookingData[]): boolean {
  return findAvailableSlots(date, existingBookings).length > 0;
}
