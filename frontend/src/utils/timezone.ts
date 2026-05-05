import { DateTime } from "luxon";

export const OFFICE_TZ = "Europe/Berlin";

export const OFFICE_HOURS = {
  start: 8,
  end: 22,
};

export function utcToLocal(isoString: string): DateTime {
  return DateTime.fromISO(isoString, { zone: "utc" }).setZone(OFFICE_TZ);
}

export function localToUTC(dateTime: Date): string {
  return DateTime.fromJSDate(dateTime).setZone(OFFICE_TZ).toUTC().toISO()!;
}

export function formatTime(isoString: string): string {
  return utcToLocal(isoString).toFormat("HH:mm");
}

export function formatDate(isoString: string): string {
  return utcToLocal(isoString).toFormat("dd.MM.yyyy");
}
