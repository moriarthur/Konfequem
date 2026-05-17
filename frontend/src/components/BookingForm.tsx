import React, { useState, useEffect, useCallback } from "react";
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
  BookingData,
  DurationOption,
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
import { checkBookingConflict, getConflictMessage, ConflictResult } from "../utils/bookingConflict";
import Button from "./ui/Button";
import { Text, Label } from "./ui/Typography";
import Card from "./ui/Card";
import { Room } from "../types";

interface ConflictInfo {
  hasConflict: boolean;
  message: string;
  conflictData: ConflictResult | null;
}

interface BookingFormProps {
  roomId: number;
  rooms?: Room[];
  onBookingCreated?: (booking: unknown) => void;
  onBookingUpdated?: (booking: unknown) => void;
  onClose?: () => void;
  onValidityChange?: (isValid: boolean) => void;
  onConflictChange?: (hasConflict: boolean) => void;
  formRef?: React.Ref<HTMLFormElement>;
  showSubmitButton?: boolean;
  bookingToEdit?: BookingData | null;
  onCancel?: () => void;
}

export default function BookingForm({ roomId, onBookingCreated, onClose, onValidityChange, onConflictChange, formRef, showSubmitButton = true, bookingToEdit, onBookingUpdated }: BookingFormProps) {
  const { authFetch } = useAuth();
  const { showAlert } = useAlert();
  const [isBookingSuccessful, setIsBookingSuccessful] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<DurationOption | null>(null);
  const [groupedSlots, setGroupedSlots] = useState<Record<string, TimeSlot[]>>({});
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextAvailableDay, setNextAvailableDay] = useState<Date | null>(null);
  const [filteredDates, setFilteredDates] = useState<Map<string, boolean>>(new Map());
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);

  useEffect(() => {
    if (!bookingToEdit) return;

    const start = DateTime.fromISO(bookingToEdit.start_time).setZone(OFFICE_TIMEZONE);
    const end = DateTime.fromISO(bookingToEdit.end_time).setZone(OFFICE_TIMEZONE);
    const durationMinutes = end.diff(start, 'minutes').minutes;

    setSelectedDate(start.toJSDate());
    setSelectedSlot(new TimeSlot(start, end));
    setSelectedDuration({ minutes: durationMinutes, label: `${durationMinutes} min` });

    const slotHour = start.hour;
    for (const [key, period] of Object.entries(TIME_PERIODS)) {
      if (slotHour >= period.start && slotHour < period.end) {
        setExpandedPeriod(key);
        break;
      }
    }
  }, [bookingToEdit]);

  const [minDate] = useState(() =>
    DateTime.now().setZone(OFFICE_TIMEZONE).startOf("day").toJSDate()
  );
  const [maxDate] = useState(() =>
    DateTime.now().setZone(OFFICE_TIMEZONE).plus({ months: 6 }).endOf("day").toJSDate()
  );

  useEffect(() => {
    const now = DateTime.now().setZone(OFFICE_TIMEZONE);
    const startDate = DateTime.fromJSDate(minDate)
      .setZone(OFFICE_TIMEZONE)
      .startOf("month");
    const endDate = DateTime.fromJSDate(maxDate)
      .setZone(OFFICE_TIMEZONE)
      .endOf("month");
    const newFilteredDates = new Map<string, boolean>();

    let current = startDate;
    while (current <= endDate) {
      const dateStr = current.toISODate();
      const jsDate = current.toJSDate();
      const cachedBookings = getCachedBookings(jsDate);

      let isValid = current >= now.startOf("day");

      if (isValid && current.hasSame(now, "day")) {
        const currentHour = now.hour;
        if (currentHour >= 22) isValid = false;
        else {
          const minutesLeft = 22 * 60 - (currentHour * 60 + now.minute);
          if (minutesLeft < OFFICE_HOURS.minDuration) isValid = false;
        }
      }

      if (isValid && cachedBookings) {
        isValid = !isDayFullyBooked(current, cachedBookings);
      }

      newFilteredDates.set(dateStr!, isValid);
      current = current.plus({ days: 1 });
    }

    setFilteredDates(newFilteredDates);
  }, [bookings, minDate, maxDate]);

  const isDateDisabledInternal = useCallback(
    (date: Date): boolean => {
      const dateKey = DateTime.fromJSDate(date)
        .setZone(OFFICE_TIMEZONE)
        .toISODate();
      return !(filteredDates.get(dateKey!) ?? true);
    },
    [filteredDates]
  );

  const isDateDisabled = useCallback(
    (date: Date): boolean => {
      if (date < minDate || date > maxDate) {
        return true;
      }
      return isDateDisabledInternal(date);
    },
    [minDate, maxDate, isDateDisabledInternal]
  );

  useEffect(() => {
    const date = selectedDate || new Date();
    if (shouldFetchMonth(date)) {
      fetchMonthBookings(date, roomId, authFetch);
    }
  }, [selectedDate, roomId, authFetch]);

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
  }, [selectedDate, roomId]);

  useEffect(() => {
    if (!selectedDate || !selectedSlot || !bookings.length) {
      setConflictInfo(null);
      return;
    }

    const conflict = checkBookingConflict(
      selectedSlot.start,
      selectedSlot.end,
      bookings,
      roomId,
      bookingToEdit?.id as number | undefined
    );

    if (conflict) {
      setConflictInfo({
        hasConflict: true,
        message: getConflictMessage(conflict) || "Conflict detected",
        conflictData: conflict,
      });
    } else {
      setConflictInfo(null);
    }
  }, [selectedDate, selectedSlot, bookings, roomId, bookingToEdit?.id]);

  const getAvailableDurationsForSlot = useCallback((): DurationOption[] => {
    if (!selectedSlot || !selectedDate) return [];

    const selectedDateTime = DateTime.fromJSDate(selectedDate).setZone(
      OFFICE_TIMEZONE
    );
    const allDurations = getAvailableDurations(selectedDateTime);

    const slotHour = selectedSlot.start.hour;
    let periodKey: string | null = null;
    for (const [key, period] of Object.entries(TIME_PERIODS)) {
      if (slotHour >= period.start && slotHour < period.end) {
        periodKey = key;
        break;
      }
    }

    if (!periodKey) return allDurations;

    const periodSlots = groupedSlots[periodKey] || [];
    const slotAtTime = periodSlots.find((s) =>
      s.start.equals(selectedSlot.start)
    );

    if (!slotAtTime) return allDurations;

    return allDurations.filter((d) => slotAtTime.duration >= d.minutes);
  }, [selectedSlot, selectedDate, groupedSlots]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!roomId || !selectedDate || !selectedSlot || !selectedDuration) {
      setError("Please fill in all required fields");
      return;
    }

    const selectedDateTime = DateTime.fromJSDate(selectedDate).setZone(
      OFFICE_TIMEZONE
    );
    const relevantBookings = bookings.filter((booking) => {
      const bookingStart = DateTime.fromISO(booking.start_time).setZone(
        OFFICE_TIMEZONE
      );
      const bookingRoomId = typeof booking.room === "object" ? booking.room?.id : booking.room;
      if (bookingToEdit && booking.id === bookingToEdit.id) return false;
      return (
        bookingRoomId === roomId &&
        bookingStart.hasSame(selectedDateTime, "day")
      );
    });

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
        const conflict = checkBookingConflict(
          selectedSlot.start,
          selectedSlot.end,
          bookings,
          roomId,
          bookingToEdit?.id as number | undefined
        );
        if (conflict) {
          setConflictInfo({
            hasConflict: true,
            message: getConflictMessage(conflict) || "Conflict detected",
            conflictData: conflict,
          });
        }
        setSelectedSlot(null);
        return;
      }
    }

    setLoading(true);
    setError(null);
    const isEditing = !!bookingToEdit;

    try {
      const url = isEditing
        ? `/api/bookings/${bookingToEdit!.id}/`
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

      setIsBookingSuccessful(true);

      setTimeout(
        () => showAlert(isEditing ? "Booking updated successfully" : "Your booking was created successfully"),
        300
      );

      setSelectedDate(null);
      setSelectedSlot(null);
      setSelectedDuration(null);
      setError(null);

      if (isEditing) {
        if (onBookingUpdated) onBookingUpdated(booking);
        if (onClose) onClose();
      } else {
        if (onBookingCreated) onBookingCreated(booking);
      }
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string; general?: string[] };
      logError(`Error ${isEditing ? "updating" : "creating"} booking:`, err);
      if (error.status === 401) {
        setError(
          "Your session has expired. Please refresh the page and try again."
        );
      } else if (error.status === 400) {
        const errorMsg = error.message || error.general?.join(". ") || "";
        if (errorMsg.toLowerCase().includes("booked") || errorMsg.toLowerCase().includes("overlap") || errorMsg.toLowerCase().includes("conflict")) {
          setConflictInfo({
            hasConflict: true,
            message: errorMsg,
            conflictData: null,
          });
        } else {
          setError(errorMsg);
        }
      } else if (error.general && Array.isArray(error.general)) {
        setError(error.general.join(". "));
      } else {
        setError(error.message || `Failed to ${isEditing ? "update" : "create"} booking. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const getButtonLabel = (): string => {
    if (loading) return "Loading...";
    if (isBookingSuccessful) return bookingToEdit ? "Booking Updated" : "Booking Confirmed";
    if (conflictInfo?.hasConflict) return "Time Slot Unavailable";

    if (bookingToEdit) {
      if (!selectedDate || !selectedSlot || !selectedDuration) return "Update Booking";
      const timeStr = selectedSlot.format().start;
      return `Update for ${timeStr}`;
    }

    if (!selectedDate || !selectedSlot || !selectedDuration) return "Book Room";
    const timeStr = selectedSlot.format().start;
    return `Book for ${timeStr}`;
  };

  useEffect(() => {
    const isFormValid = !!(selectedDate && selectedSlot && selectedDuration);
    onValidityChange?.(isFormValid);
  }, [selectedDate, selectedSlot, selectedDuration, onValidityChange]);

  useEffect(() => {
    onConflictChange?.(conflictInfo?.hasConflict || false);
  }, [conflictInfo, onConflictChange]);

  return (
    <form ref={formRef as React.Ref<HTMLFormElement>} onSubmit={handleSubmit} className="space-y-4">
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

      <div>
        <Label>Select Date</Label>
        <div className="flex justify-center mt-2">
          <DayPicker
            mode="single"
            selected={selectedDate ?? undefined}
            onSelect={(date: Date | undefined) => {
              setSelectedDate(date !== undefined ? date : null);
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
            } as Record<string, React.CSSProperties>}
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

      {selectedDate && !loading && Object.keys(groupedSlots).length > 0 && (
        <div>
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

          {expandedPeriod && groupedSlots[expandedPeriod] && (
            <div className="grid grid-cols-4 gap-2">
              {groupedSlots[expandedPeriod].map((slot) => {
                const formattedTime = slot.format();
                const slotKey = `${formattedTime.start}-${formattedTime.end}`;
                const isSelected =
                  selectedSlot?.start &&
                  selectedSlot.start.equals(slot.start);

                const selectedDateTime = DateTime.fromJSDate(
                  selectedDate
                ).setZone(OFFICE_TIMEZONE);
                const relevantBookings = bookings.filter((booking) => {
                  const bookingStart = DateTime.fromISO(
                    booking.start_time
                  ).setZone(OFFICE_TIMEZONE);
                  const bookingRoomId = typeof booking.room === "object" ? booking.room?.id : booking.room;
                  return (
                    bookingRoomId === roomId &&
                    bookingStart.hasSame(selectedDateTime, "day")
                  );
                });

                let isAvailable = true;
                for (const booking of relevantBookings) {
                  const bookingStart = DateTime.fromISO(
                    booking.start_time
                  ).setZone(OFFICE_TIMEZONE);
                  const bookingEnd = DateTime.fromISO(
                    booking.end_time
                  ).setZone(OFFICE_TIMEZONE);

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

      {selectedDate && selectedSlot && (
        <div>
          <Label>Duration</Label>
          <div className="grid grid-cols-3 gap-2">
            {(() => {
              const availableDurations = getAvailableDurationsForSlot();

              const commonDurations = [15, 30, 45, 60, 90, 120];
              const displayDurations = commonDurations
                .map((mins) =>
                  availableDurations.find((d) => d.minutes === mins)
                )
                .filter(Boolean) as DurationOption[];

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
