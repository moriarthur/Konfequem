// Booking configuration constants
export const BOOKING_CONSTANTS = {
  MIN_DURATION: 15, // minutes
  MAX_DURATION: 480, // minutes (8 hours)
  MAX_ADVANCE_DAYS: 90, // days
  CANCEL_BEFORE_START_MINUTES: 15, // minutes before start time
};

export const OFFICE_HOURS = {
  START: 8, // 8:00 AM
  END: 22, // 10:00 PM
  TIMEZONE: "Europe/Berlin",
};

export const TIME_SLOT = {
  INTERVAL_MINUTES: 15,
};

export const AUTH = {
  ACCESS_TOKEN_LIFETIME_MINUTES: 30,
  TOKEN_REFRESH_BUFFER_SECONDS: 30,
};

export const PAGINATION = {
  INITIAL_PAGE_SIZE: 10,
  PAGE_INCREMENT: 10,
};

export const UI = {
  TOAST_DURATION_MS: 3000,
  DEBOUNCE_DELAY_MS: 300,
  ANIMATION_DURATION_MS: 300,
};
