import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import { error as logError } from "../utils/logger";
import { DayPicker } from "react-day-picker";
import { DateTime } from "luxon";
import "react-day-picker/dist/style.css";
import "./DayPickerStyles.css";
import {
  OFFICE_HOURS,
  OFFICE_TIMEZONE,
} from "../utils/bookingUtils";
import { TimeSlot } from "../utils/timeSlots";
import {
  fetchMonthBookings,
  getCachedBookings,
  shouldFetchMonth,
  subscribeToMonth,
} from "../utils/bookingCache";
import {
  TIME_PERIODS,
  getAvailableSlots,
  getAvailableDurations,
  groupSlotsByPeriod,
  isDayFullyBooked,
  findNextAvailableDay,
} from "../utils/timeSlots";
import { checkBookingConflict, getConflictMessage } from "../utils/bookingConflict";
import Button from "./ui/Button";
import { Text, Label } from "./ui/Typography";
import Card from "./ui/Card";

export default function BookingForm({ roomId, onBookingCreated, onClose, onValidityChange, formRef, showSubmitButton = true, bookingToEdit, onBookingUpdated }) {
  const { authFetch } = useAuth();
  const { showAlert } = useAlert();
  const [isBookingSuccessful, setIsBookingSuccessful] = useState(false);

  const [selectedDate, setSelectedDate] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [groupedSlots, setGroupedSlots] = useState({});
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextAvailableDay, setNextAvailableDay] = useState(null);
  const [filteredDates, setFilteredDates] = useState(new Map());
  const [expandedPeriod, setExpandedPeriod] = useState(null);
  const [conflictInfo, setConflictInfo] = useState(null); // { hasConflict: boolean, message: string, conflictData: object }

  // Initialize form from bookingToEdit (edit mode)
  useEffect(() => {
    if (!bookingToEdit) return;

    const start = DateTime.fromISO(bookingToEdit.start_time).setZone(OFFICE_TIMEZONE);
    const end = DateTime.fromISO(bookingToEdit.end_time).setZone(OFFICE_TIMEZONE);
    const durationMinutes = end.diff(start, 'minutes').minutes;

    setSelectedDate(start.toJSDate());
    setSelectedSlot(new TimeSlot(start, end));
    setSelectedDuration({ minutes: durationMinutes, label: `${durationMinutes} min` });

    // Determine period to expand
    const slotHour = start.hour;
    for (const [key, period] of Object.entries(TIME_PERIODS)) {
      if (slotHour >= period.start && slotHour < period.end) {
        setExpandedPeriod(key);
        break;
      }
    }
  }, [bookingToEdit]);

  // Calculate date limits (persist for session)
  const [minDate] = useState(() =>
    DateTime.now().setZone(OFFICE_TIMEZONE).startOf("day").toJSDate()
  );
  const [maxDate] = useState(() =>
    DateTime.now().setZone(OFFICE_TIMEZONE).plus({ months: 6 }).endOf("day").toJSDate()
  );

  // Optimize date filtering for DayPicker
  useEffect(() => {
    const now = DateTime.now().setZone(OFFICE_TIMEZONE);
    const startDate = DateTime.fromJSDate(minDate)
      .setZone(OFFICE_TIMEZONE)
      .startOf("month");
    const endDate = DateTime.fromJSDate(maxDate)
      .setZone(OFFICE_TIMEZONE)
      .endOf("month");
    const newFilteredDates = new Map();

    let current = startDate;
    while (current <= endDate) {
      const dateStr = current.toISODate();
      const jsDate = current.toJSDate();
      const cachedBookings = getCachedBookings(jsDate);

      // Basic validation
      let isValid = current >= now.startOf("day");

      // Check office hours for today
      if (isValid && current.hasSame(now, "day")) {
        const currentHour = now.hour;
        if (currentHour >= 22) isValid = false;
        else {
          const minutesLeft = 22 * 60 - (currentHour * 60 + now.minute);
          if (minutesLeft < OFFICE_HOURS.minDuration) isValid = false;
        }
      }

      // Check bookings if available
      if (isValid && cachedBookings) {
        isValid = !isDayFullyBooked(current, cachedBookings);
      }

      newFilteredDates.set(dateStr, isValid);
      current = current.plus({ days: 1 });
    }

    setFilteredDates(newFilteredDates);
  }, [bookings, minDate, maxDate]);

  // Filter function for DayPicker
  const isDateDisabledInternal = useCallback(
    (date) => {
      const dateKey = DateTime.fromJSDate(date)
        .setZone(OFFICE_TIMEZONE)
        .toISODate();
      return !(filteredDates.get(dateKey) ?? true);
    },
    [filteredDates]
  );

  const isDateDisabled = useCallback(
    (date) => {
      if (date < minDate || date > maxDate) {
        return true;
      }
      return isDateDisabledInternal(date);
    },
    [minDate, maxDate, isDateDisabledInternal]
  );

  // Pre-fetch data for visible month
  useEffect(() => {
    const date = selectedDate || new Date();
    if (shouldFetchMonth(date)) {
      fetchMonthBookings(date, roomId, authFetch);
    }
  }, [selectedDate, roomId, authFetch]);

  // Update available slots when date changes
  useEffect(() => {
    if (!selectedDate) return;

    setLoading(true);
    setError(null);
    setSelectedSlot(null);
    setSelectedDuration(null);
    setExpandedPeriod(null);

    const now = DateTime.now().setZone(OFFICE_TIMEZONE);
    const selectedDateTime = DateTime.fromJSDate(selectedDate).setZone(
      OFFICE_TIMEZONE,
      { keepLocalTime: true }
    );

    const cachedBookings = getCachedBookings(selectedDate);
    if (cachedBookings) {
      if (isDayFullyBooked(selectedDateTime, cachedBookings)) {
        setError("This day is fully booked");
        const nextDay = findNextAvailableDay(selectedDate, cachedBookings, roomId);
        if (nextDay) {
          setNextAvailableDay(nextDay.toJSDate());
        }
        setLoading(false);
        return;
      }

      const isToday = now.hasSame(selectedDateTime, "day");

      const slots = getAvailableSlots(
        selectedDateTime,
        cachedBookings,
        15,
        isToday ? now : null
      );

      setError(slots.length === 0 ? "No available slots for this day" : null);
      setGroupedSlots(groupSlotsByPeriod(slots));
      setBookings(cachedBookings);
      setLoading(false);
    } else {
      const unsubscribe = subscribeToMonth(selectedDate, (monthData) => {
        const dateBookings =
          monthData.get(selectedDateTime.toFormat("yyyy-MM-dd")) || [];
        setBookings(dateBookings);
        setLoading(false);
      });

      return () => {
        unsubscribe();
      };
    }

    // No cleanup needed for cached data path
    return undefined;
  }, [selectedDate, roomId]);

  // Real-time conflict detection when date, slot, or duration changes
  useEffect(() => {
    if (!selectedDate || !selectedSlot || !bookings.length) {
      setConflictInfo(null);
      return;
    }

    // Check for booking conflicts
    const conflict = checkBookingConflict(
      selectedSlot.start,
      selectedSlot.end,
      bookings,
      roomId
    );

    if (conflict) {
      setConflictInfo({
        hasConflict: true,
        message: getConflictMessage(conflict),
        conflictData: conflict,
      });
    } else {
      setConflictInfo(null);
    }
  }, [selectedDate, selectedSlot, bookings, roomId]);

  // Get available durations based on selected slot
  const getAvailableDurationsForSlot = useCallback(() => {
    if (!selectedSlot || !selectedDate) return [];

    const selectedDateTime = DateTime.fromJSDate(selectedDate).setZone(
      OFFICE_TIMEZONE
    );
    const allDurations = getAvailableDurations(selectedDateTime);

    // Find which period the selected slot belongs to
    const slotHour = selectedSlot.start.hour;
    let periodKey = null;
    for (const [key, period] of Object.entries(TIME_PERIODS)) {
      if (slotHour >= period.start && slotHour < period.end) {
        periodKey = key;
        break;
      }
    }

    if (!periodKey) return allDurations;

    // Get max duration available in this period from this slot's start time
    const periodSlots = groupedSlots[periodKey] || [];
    const slotAtTime = periodSlots.find((s) =>
      s.start.equals(selectedSlot.start)
    );

    if (!slotAtTime) return allDurations;

    // Filter durations that fit in this slot
    return allDurations.filter((d) => slotAtTime.duration >= d.minutes);
  }, [selectedSlot, selectedDate, groupedSlots]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roomId || !selectedDate || !selectedSlot || !selectedDuration) {
      setError("Please fill in all required fields");
      return;
    }

    // Final validation before submission
    const selectedDateTime = DateTime.fromJSDate(selectedDate).setZone(
      OFFICE_TIMEZONE
    );
    const relevantBookings = bookings.filter((booking) => {
      const bookingStart = DateTime.fromISO(booking.start_time).setZone(
        OFFICE_TIMEZONE
      );
      const bookingRoomId = booking.room?.id || booking.room;
      // Exclude current booking from conflict check when editing
      if (bookingToEdit && booking.id === bookingToEdit.id) return false;
      return (
        bookingRoomId === roomId &&
        bookingStart.hasSame(selectedDateTime, "day")
      );
    });

    // Double-check for overlaps before submission
    for (const booking of relevantBookings) {
      const bookingStart = DateTime.fromISO(booking.start_time).setZone(
        OFFICE_TIMEZONE
      );
      const bookingEnd = DateTime.fromISO(booking.end_time).setZone(
        OFFICE_TIMEZONE
      );

      if (
        selectedSlot.start < bookingEnd &&
        selectedSlot.end > bookingStart
      ) {
        setError(
          "This time slot is no longer available. Please select a different time."
        );
        setSelectedSlot(null);
        return;
      }
    }

    setLoading(true);
    setError(null);
    const isEditing = !!bookingToEdit;

    try {
      const url = isEditing
        ? `/api/bookings/${bookingToEdit.id}/`
        : "/api/bookings/";
      const method = isEditing ? "PATCH" : "POST";

      const response = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomId,
          start_time: selectedSlot.start.toISO(),
          end_time: selectedSlot.end.toISO(),
        }),
      });

      const booking = response;

      // Trigger success animation
      setIsBookingSuccessful(true);

      // Show success message after a brief delay
      setTimeout(
        () => showAlert(isEditing ? "Booking updated successfully" : "Your booking was created successfully"),
        300
      );

      // Reset form state
      setSelectedDate(null);
      setSelectedSlot(null);
      setSelectedDuration(null);
      setError(null);

      // Notify parent component
      if (isEditing) {
        if (onBookingUpdated) onBookingUpdated(booking);
        if (onClose) onClose();
      } else {
        if (onBookingCreated) onBookingCreated(booking);
      }
    } catch (error) {
      logError(`Error ${isEditing ? "updating" : "creating"} booking:`, error);
      if (error.status === 401) {
        setError(
          "Your session has expired. Please refresh the page and try again."
        );
      } else if (error.general && Array.isArray(error.general)) {
        setError(error.general.join(". "));
      } else {
        setError(error.message || `Failed to ${isEditing ? "update" : "create"} booking. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const isValid = () => {
    return selectedDate && selectedDuration && selectedSlot;
  };

  // Format button label with booking info
  const getButtonLabel = () => {
    if (loading) return "Loading...";
    if (isBookingSuccessful) return bookingToEdit ? "✓ Booking Updated" : "✓ Booking Confirmed";
    if (conflictInfo?.hasConflict) return "Time Slot Unavailable";

    // Check edit mode - look at the prop directly
    if (bookingToEdit) {
      // We're editing, even if form isn't fully initialized yet
      if (!selectedDate || !selectedSlot || !selectedDuration) return "Update Booking";
      const timeStr = selectedSlot.format().start;
      return `Update for ${timeStr}`;
    }

    // Creating new booking
    if (!selectedDate || !selectedSlot || !selectedDuration) return "Book Room";
    const timeStr = selectedSlot.format().start;
    return `Book for ${timeStr}`;
  };

  // Notify parent when form validity changes
  useEffect(() => {
    const isFormValid = !!(selectedDate && selectedSlot && selectedDuration);
    onValidityChange?.(isFormValid);
  }, [selectedDate, selectedSlot, selectedDuration, onValidityChange]);

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Card className="p-4 border-status-danger/20 bg-status-danger/10">
          <Text className="font-medium text-status-danger-text">{error}</Text>
          {nextAvailableDay && (
            <div className="mt-2">
              <Text variant="small" className="text-status-danger-text">
                Next available day:{" "}
                {DateTime.fromJSDate(nextAvailableDay).toFormat("dd.MM.yyyy")}
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="ml-2 text-status-danger"
                  onClick={() => setSelectedDate(nextAvailableDay)}
                >
                  Select
                </Button>
              </Text>
            </div>
          )}
        </Card>
      )}

      {conflictInfo && conflictInfo.hasConflict && (
        <Card className="p-4 border-status-warning/20 bg-status-warning/10">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-status-warning flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <Text className="font-medium text-status-warning-text">Booking Conflict</Text>
              <Text variant="small" className="text-status-warning-text/80 mt-1">{conflictInfo.message}</Text>
              <Text variant="small" className="text-status-warning-text/60 mt-2">Please choose a different time or duration.</Text>
            </div>
          </div>
        </Card>
      )}

      {/* Step 1: Select Date */}
      <div>
        <Label>Select Date</Label>
        <div className="flex justify-center mt-2">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date);
              setSelectedSlot(null);
              setSelectedDuration(null);
            }}
            disabled={isDateDisabled}
            fromDate={minDate}
            toDate={maxDate}
            className="rdp-custom"
            styles={{
              caption: { color: "#3f3f46" },
              head_cell: { color: "#71717a" },
              nav_button: { color: "#3f3f46" },
              nav_button_disabled: { color: "#d4d4d8" },
              day: { color: "#3f3f46" },
              day_disabled: { color: "#d4d4d8" },
              day_selected: {
                backgroundColor: "#3f3f46",
                color: "white",
                fontWeight: "bold",
              },
              day_today: {
                backgroundColor: "#f4f4f5",
                color: "#3f3f46",
                fontWeight: "bold",
              },
            }}
          />
        </div>
        {selectedDate && (
          <div className="mt-4 text-center">
            <Text variant="small">
              Selected: {DateTime.fromJSDate(selectedDate).toFormat("dd.MM.yyyy")}
            </Text>
          </div>
        )}
      </div>

      {/* Step 2: Available Times (three buttons in a row) */}
      {selectedDate && !loading && Object.keys(groupedSlots).length > 0 && (
        <div>
          {/* Period buttons row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {Object.entries(TIME_PERIODS).map(([periodKey, period]) => {
              const slots = groupedSlots[periodKey] || [];
              if (slots.length === 0) return null;

              const isSelected = expandedPeriod === periodKey;
              const hasSelectedSlot = selectedSlot && slots.some(s =>
                s.start.equals(selectedSlot.start)
              );

              return (
                <button
                  key={periodKey}
                  type="button"
                  onClick={() => setExpandedPeriod(isSelected ? null : periodKey)}
                  className={`px-4 py-3 rounded-xl border font-medium transition ${
                    isSelected || hasSelectedSlot
                      ? "bg-accent-primary/10 border-accent-primary text-accent-primary"
                      : "bg-surface-base border-border-subtle text-accent-secondary hover:bg-surface-muted hover:border-border-soft"
                  }`}
                >
                  {period.label}
                </button>
              );
            })}
          </div>

          {/* Time slots for selected period */}
          {expandedPeriod && groupedSlots[expandedPeriod] && (
            <div className="grid grid-cols-4 gap-2">
              {groupedSlots[expandedPeriod].map((slot) => {
                const formattedTime = slot.format();
                const slotKey = `${formattedTime.start}-${formattedTime.end}`;
                const isSelected =
                  selectedSlot?.start &&
                  selectedSlot.start.equals(slot.start);

                // Check if this slot is available
                const selectedDateTime = DateTime.fromJSDate(
                  selectedDate
                ).setZone(OFFICE_TIMEZONE);
                const relevantBookings = bookings.filter((booking) => {
                  const bookingStart = DateTime.fromISO(
                    booking.start_time
                  ).setZone(OFFICE_TIMEZONE);
                  const bookingRoomId = booking.room?.id || booking.room;
                  return (
                    bookingRoomId === roomId &&
                    bookingStart.hasSame(selectedDateTime, "day")
                  );
                });

                // Check for overlaps
                let isAvailable = true;
                for (const booking of relevantBookings) {
                  const bookingStart = DateTime.fromISO(
                    booking.start_time
                  ).setZone(OFFICE_TIMEZONE);
                  const bookingEnd = DateTime.fromISO(
                    booking.end_time
                  ).setZone(OFFICE_TIMEZONE);

                  // Check 15-minute slot availability
                  const slotEnd = slot.start.plus({ minutes: 15 });
                  if (
                    slot.start < bookingEnd &&
                    slotEnd > bookingStart
                  ) {
                    isAvailable = false;
                    break;
                  }
                }

                return (
                  <Button
                    key={slotKey}
                    type="button"
                    variant={isSelected ? "primary" : "secondary"}
                    size="sm"
                    disabled={!isAvailable}
                    className={
                      !isAvailable
                        ? "bg-surface-muted text-accent-secondary/40 cursor-not-allowed"
                        : ""
                    }
                    onClick={() => {
                      if (isAvailable) {
                        // Create a 15-minute slot by default
                        const defaultSlot = new TimeSlot(
                          slot.start,
                          slot.start.plus({ minutes: 15 })
                        );
                        setSelectedSlot(defaultSlot);
                        setSelectedDuration({ minutes: 15, label: "15 min" });
                      }
                    }}
                  >
                    {formattedTime.start}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Duration (shown after slot selection) */}
      {selectedDate && selectedSlot && (
        <div>
          <Label>Duration</Label>
          <div className="grid grid-cols-3 gap-2">
            {(() => {
              const availableDurations = getAvailableDurationsForSlot();

              // Show durations in order
              const commonDurations = [15, 30, 45, 60, 90, 120];
              const displayDurations = commonDurations
                .map((mins) =>
                  availableDurations.find((d) => d.minutes === mins)
                )
                .filter(Boolean);

              return displayDurations.map((duration) => (
                <Button
                  key={duration.minutes}
                  type="button"
                  variant={
                    selectedDuration?.minutes === duration.minutes
                      ? "primary"
                      : "secondary"
                  }
                  size="sm"
                  onClick={() => {
                    setSelectedDuration(duration);
                    // Update the selected slot with new duration
                    const updatedSlot = new TimeSlot(
                      selectedSlot.start,
                      selectedSlot.start.plus({ minutes: duration.minutes })
                    );
                    setSelectedSlot(updatedSlot);
                  }}
                >
                  {duration.label}
                </Button>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Submit Button */}
      {showSubmitButton && selectedDate && selectedSlot && selectedDuration && (
        <Button
          type="submit"
          variant="primary"
          disabled={loading || conflictInfo?.hasConflict}
          className="w-full mt-4"
        >
          {getButtonLabel()}
        </Button>
      )}

    </form>
  );
}
