import { DateTime } from "luxon";
import { OFFICE_TIMEZONE, OFFICE_HOURS } from "./bookingUtils";
import { warn } from "./logger";
import type { BookingData } from "./bookingUtils";

const MAX_CACHE_SIZE = 6;
const MAX_LISTENERS_PER_MONTH = 10;

// Availability data is per-room, so every cache bucket is keyed by
// "<roomId>:<yyyy-MM>" — a month-only key leaked Room A's slots into
// Room B whenever both were opened in the same month.
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

function monthKey(dateTime: DateTime): string {
  return dateTime.toFormat("yyyy-MM");
}

function cacheKey(dateTime: DateTime, roomId: number): string {
  return `${roomId}:${monthKey(dateTime)}`;
}

function monthPartOfKey(key: string): string {
  return key.slice(key.indexOf(":") + 1);
}

/** Test hook: wipe all cached availability data. */
export function resetBookingCache(): void {
  bookingCache.data.clear();
  bookingCache.loading.clear();
  bookingCache.listeners.clear();
}

function cleanupOldestEntries(): void {
  if (bookingCache.data.size <= MAX_CACHE_SIZE) return;

  const entries = Array.from(bookingCache.data.entries());
  // Evict by oldest month, not by composite key (room ids would skew a
  // plain lexicographic sort).
  entries.sort((a, b) =>
    monthPartOfKey(a[0]).localeCompare(monthPartOfKey(b[0]))
  );

  const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
  toRemove.forEach(([key]) => {
    bookingCache.data.delete(key);
    bookingCache.listeners.delete(key);
    bookingCache.loading.delete(key);
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

function hasMonthData(dateTime: DateTime, roomId: number): boolean {
  return bookingCache.data.has(cacheKey(dateTime, roomId));
}

export function shouldFetchMonth(date: Date, roomId: number): boolean {
  const monthStart = DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE).startOf("month");
  const key = cacheKey(monthStart, roomId);
  return !bookingCache.loading.has(key) && !hasMonthData(monthStart, roomId);
}

export async function fetchMonthBookings(
  date: Date,
  roomId: number,
  authFetch: (url: string) => Promise<Record<string, unknown>>
): Promise<void> {
  const monthStart = DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE).startOf("month");
  const key = cacheKey(monthStart, roomId);

  if (bookingCache.loading.has(key)) return;

  bookingCache.loading.add(key);

  try {
    // Org-wide availability (not personal /bookings/): conflicts must be
    // checked against everyone's bookings, not just the user's own.
    const response = await authFetch(
      `/api/availability/?room=${roomId}&month=${monthStart.toFormat("yyyy-MM")}`
    );

    const rawBookings = (response.results || response) as BookingData[];
    // Cancelled bookings don't block slots — the server already excludes
    // them; the filter stays as defense for stale mock/edge data.
    const bookings = rawBookings.filter((booking) => booking.status !== "cancelled");

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

    bookingCache.data.set(key, bookingsByDate);

    cleanupOldestEntries();

    const listeners = bookingCache.listeners.get(key) || [];
    listeners.forEach((callback) => callback(bookingsByDate));
  } finally {
    bookingCache.loading.delete(key);
  }
}

export function subscribeToMonth(
  date: Date,
  roomId: number,
  callback: (data: Map<string, BookingData[]>) => void
): () => void {
  const key = cacheKey(DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE), roomId);

  if (!bookingCache.listeners.has(key)) {
    bookingCache.listeners.set(key, new Set());
  }

  const listeners = bookingCache.listeners.get(key)!;

  if (listeners.size >= MAX_LISTENERS_PER_MONTH) {
    warn(
      `Max listeners (${MAX_LISTENERS_PER_MONTH}) reached for ${key}. Cleanup may be needed.`
    );
    return () => {};
  }

  listeners.add(callback);

  return () => {
    const currentListeners = bookingCache.listeners.get(key);
    if (currentListeners) {
      currentListeners.delete(callback);
      if (currentListeners.size === 0) {
        bookingCache.listeners.delete(key);
      }
    }
  };
}

export function getCachedBookings(date: Date, roomId: number): BookingData[] | null {
  const dateKey = dateToKey(date);
  const monthData = bookingCache.data.get(
    cacheKey(DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE), roomId)
  );
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
