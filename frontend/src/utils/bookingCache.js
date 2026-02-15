import { DateTime } from "luxon";
import { OFFICE_TIMEZONE, OFFICE_HOURS } from "./bookingUtils";

// Cache configuration
const MAX_CACHE_SIZE = 6; // Maximum months to cache (6 months = current + 5 future)
const MAX_LISTENERS_PER_MONTH = 10; // Prevent listener leaks

// Cache structure to store booking data
const bookingCache = {
  data: new Map(),
  loading: new Set(),
  listeners: new Map(),
};

// Clean up old cache entries when size limit is reached
function cleanupOldestEntries() {
  if (bookingCache.data.size <= MAX_CACHE_SIZE) return;

  const entries = Array.from(bookingCache.data.entries());
  // Sort by month key (oldest first)
  entries.sort((a, b) => a[0].localeCompare(b[0]));

  // Remove oldest entries beyond limit
  const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
  toRemove.forEach(([monthKey]) => {
    bookingCache.data.delete(monthKey);
    bookingCache.listeners.delete(monthKey);
    bookingCache.loading.delete(monthKey);
  });
}

// Convert date to YYYY-MM-DD string
function dateToKey(date) {
  return DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE).toFormat('yyyy-MM-dd');
}

// Quick check if a date might have available slots (without booking data)
function hasTimeSlots(date) {
  const now = DateTime.now().setZone(OFFICE_TIMEZONE);
  const checkDate = DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE);
  
  // Past dates are never available
  if (checkDate < now.startOf('day')) return false;
  
  // Future dates within 90 days are potentially available
  const maxDate = now.plus({ days: 90 });
  return checkDate <= maxDate;
}

// Check if we need to fetch data for this month
function shouldFetchMonth(date) {
  const monthStart = DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE).startOf('month');
  const monthKey = monthStart.toFormat('yyyy-MM');
  return !bookingCache.loading.has(monthKey) && !hasMonthData(monthStart);
}

// Check if we have data for this month
function hasMonthData(dateTime) {
  const monthKey = dateTime.toFormat('yyyy-MM');
  return bookingCache.data.has(monthKey);
}

// Fetch bookings for a whole month
async function fetchMonthBookings(date, roomId, authFetch) {
  const monthStart = DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE).startOf('month');
  const monthKey = monthStart.toFormat('yyyy-MM');

  if (bookingCache.loading.has(monthKey)) return;

  bookingCache.loading.add(monthKey);

  try {
    const response = await authFetch(
      `/api/bookings/?room=${roomId}&month=${monthStart.toFormat('yyyy-MM')}`
    );

    // Handle pagination - extract results array from paginated response
    const bookings = response.results || response;

    // Group bookings by date
    const bookingsByDate = new Map();
    bookings.forEach(booking => {
      const dateKey = DateTime.fromISO(booking.start_time)
        .setZone(OFFICE_TIMEZONE)
        .toFormat('yyyy-MM-dd');

      if (!bookingsByDate.has(dateKey)) {
        bookingsByDate.set(dateKey, []);
      }
      bookingsByDate.get(dateKey).push(booking);
    });

    bookingCache.data.set(monthKey, bookingsByDate);

    // Clean up old entries if cache is too large
    cleanupOldestEntries();

    // Notify listeners
    const listeners = bookingCache.listeners.get(monthKey) || [];
    listeners.forEach(callback => callback(bookingsByDate));
  } finally {
    bookingCache.loading.delete(monthKey);
  }
}

// Subscribe to updates for a specific month
function subscribeToMonth(date, callback) {
  const monthKey = DateTime.fromJSDate(date)
    .setZone(OFFICE_TIMEZONE)
    .toFormat('yyyy-MM');

  if (!bookingCache.listeners.has(monthKey)) {
    bookingCache.listeners.set(monthKey, new Set());
  }

  const listeners = bookingCache.listeners.get(monthKey);

  // Prevent unbounded listener growth
  if (listeners.size >= MAX_LISTENERS_PER_MONTH) {
    console.warn(`Max listeners (${MAX_LISTENERS_PER_MONTH}) reached for month ${monthKey}. Cleanup may be needed.`);
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

// Get cached bookings for a date
function getCachedBookings(date) {
  const dateKey = dateToKey(date);
  const monthKey = DateTime.fromJSDate(date)
    .setZone(OFFICE_TIMEZONE)
    .toFormat('yyyy-MM');
  
  const monthData = bookingCache.data.get(monthKey);
  if (!monthData) return null;
  
  return monthData.get(dateKey) || [];
}

// Quick check if a date is fully booked
function isDateFullyBooked(date, bookings) {
  if (!bookings) return false;
  
  const dayStart = DateTime.fromJSDate(date)
    .setZone(OFFICE_TIMEZONE)
    .set({ hour: OFFICE_HOURS.start, minute: 0 });
  
  const dayEnd = dayStart.set({ hour: OFFICE_HOURS.end });
  
  // Convert bookings to intervals
  const intervals = bookings.map(booking => ({
    start: DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE),
    end: DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE)
  })).sort((a, b) => a.start.toMillis() - b.start.toMillis());
  
  // Check if there's any free time between bookings
  let currentTime = dayStart;
  
  for (const interval of intervals) {
    if (currentTime < interval.start) {
      // Found a gap
      return false;
    }
    currentTime = interval.end;
  }
  
  // Check if there's time after the last booking
  return currentTime >= dayEnd;
}

export {
  fetchMonthBookings,
  getCachedBookings,
  isDateFullyBooked,
  hasTimeSlots,
  shouldFetchMonth,
  subscribeToMonth,
};