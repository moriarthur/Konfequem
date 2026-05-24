import { DateTime } from "luxon";
import { OFFICE_TIMEZONE, OFFICE_HOURS } from "./bookingUtils";
import { warn } from "./logger";
import type { BookingData } from "./bookingUtils";

const MAX_CACHE_SIZE = 6;
const MAX_LISTENERS_PER_MONTH = 10;

interface CacheData {
  data: Map<string, Map<string, BookingData[]>>;
  loading: Set<string>;
  listeners: Map<string, Set<(data: Map<string, BookingData[]>) => void>>;
}

const bookingCache: CacheData = {
  data: new Map(),
  loading: new Set(),
  listeners: new Map(),
};

function cleanupOldestEntries(): void {
  if (bookingCache.data.size <= MAX_CACHE_SIZE) return;

  const entries = Array.from(bookingCache.data.entries());
  entries.sort((a, b) => a[0].localeCompare(b[0]));

  const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
  toRemove.forEach(([monthKey]) => {
    bookingCache.data.delete(monthKey);
    bookingCache.listeners.delete(monthKey);
    bookingCache.loading.delete(monthKey);
  });
}

function dateToKey(date: Date): string {
  return DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE).toFormat("yyyy-MM-dd");
}

export function hasTimeSlots(date: Date): boolean {
  const now = DateTime.now().setZone(OFFICE_TIMEZONE);
  const checkDate = DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE);

  if (checkDate < now.startOf("day")) return false;

  const maxDate = now.plus({ days: 90 });
  return checkDate <= maxDate;
}

function hasMonthData(dateTime: DateTime): boolean {
  const monthKey = dateTime.toFormat("yyyy-MM");
  return bookingCache.data.has(monthKey);
}

export function shouldFetchMonth(date: Date): boolean {
  const monthStart = DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE).startOf("month");
  const monthKey = monthStart.toFormat("yyyy-MM");
  return !bookingCache.loading.has(monthKey) && !hasMonthData(monthStart);
}

export async function fetchMonthBookings(
  date: Date,
  roomId: number,
  authFetch: (url: string) => Promise<Record<string, unknown>>
): Promise<void> {
  const monthStart = DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE).startOf("month");
  const monthKey = monthStart.toFormat("yyyy-MM");

  if (bookingCache.loading.has(monthKey)) return;

  bookingCache.loading.add(monthKey);

  try {
    const response = await authFetch(
      `/api/bookings/?room=${roomId}&month=${monthStart.toFormat("yyyy-MM")}`
    );

    const bookings = (response.results || response) as BookingData[];

    const bookingsByDate = new Map<string, BookingData[]>();
    bookings.forEach((booking) => {
      const dateKey = DateTime.fromISO(booking.start_time)
        .setZone(OFFICE_TIMEZONE)
        .toFormat("yyyy-MM-dd");

      if (!bookingsByDate.has(dateKey)) {
        bookingsByDate.set(dateKey, []);
      }
      bookingsByDate.get(dateKey)!.push(booking);
    });

    bookingCache.data.set(monthKey, bookingsByDate);

    cleanupOldestEntries();

    const listeners = bookingCache.listeners.get(monthKey) || [];
    listeners.forEach((callback) => callback(bookingsByDate));
  } finally {
    bookingCache.loading.delete(monthKey);
  }
}

export function subscribeToMonth(
  date: Date,
  callback: (data: Map<string, BookingData[]>) => void
): () => void {
  const monthKey = DateTime.fromJSDate(date)
    .setZone(OFFICE_TIMEZONE)
    .toFormat("yyyy-MM");

  if (!bookingCache.listeners.has(monthKey)) {
    bookingCache.listeners.set(monthKey, new Set());
  }

  const listeners = bookingCache.listeners.get(monthKey)!;

  if (listeners.size >= MAX_LISTENERS_PER_MONTH) {
    warn(
      `Max listeners (${MAX_LISTENERS_PER_MONTH}) reached for month ${monthKey}. Cleanup may be needed.`
    );
    return () => {};
  }

  listeners.add(callback);

  return () => {
    const currentListeners = bookingCache.listeners.get(monthKey);
    if (currentListeners) {
      currentListeners.delete(callback);
      if (currentListeners.size === 0) {
        bookingCache.listeners.delete(monthKey);
      }
    }
  };
}

export function getCachedBookings(date: Date): BookingData[] | null {
  const dateKey = dateToKey(date);
  const monthKey = DateTime.fromJSDate(date)
    .setZone(OFFICE_TIMEZONE)
    .toFormat("yyyy-MM");

  const monthData = bookingCache.data.get(monthKey);
  if (!monthData) return null;

  return monthData.get(dateKey) || [];
}

export function isDateFullyBooked(date: Date, bookings: BookingData[] | null): boolean {
  if (!bookings) return false;

  const dayStart = DateTime.fromJSDate(date)
    .setZone(OFFICE_TIMEZONE)
    .set({ hour: OFFICE_HOURS.start, minute: 0 });

  const dayEnd = dayStart.set({ hour: OFFICE_HOURS.end });

  const intervals = bookings
    .map((booking) => ({
      start: DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE),
      end: DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE),
    }))
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());

  let currentTime = dayStart;

  for (const interval of intervals) {
    if (currentTime < interval.start) return false;
    currentTime = interval.end;
  }

  return currentTime >= dayEnd;
}
