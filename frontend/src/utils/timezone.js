import { DateTime } from "luxon";

// Office timezone
export const OFFICE_TZ = "Europe/Berlin";

// Office hours (8:00 - 22:00)
export const OFFICE_HOURS = {
  start: 8,
  end: 22,
};

// Convert UTC ISO string to local time
export function utcToLocal(isoString) {
  return DateTime.fromISO(isoString, { zone: "utc" })
    .setZone(OFFICE_TZ);
}

// Convert local time to UTC for API
export function localToUTC(dateTime) {
  return DateTime.fromJSDate(dateTime)
    .setZone(OFFICE_TZ)
    .toUTC()
    .toISO();
}

// Format time in office timezone
export function formatTime(isoString) {
  return utcToLocal(isoString).toFormat("HH:mm");
}

// Format date in office timezone
export function formatDate(isoString) {
  return utcToLocal(isoString).toFormat("dd.MM.yyyy");
}