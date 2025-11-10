import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import { error as logError } from "../utils/logger";
import DatePicker from "react-datepicker";
import { DateTime } from "luxon";
import "react-datepicker/dist/react-datepicker.css";
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

export default function BookingForm({ roomId, onBookingCreated, onClose }) {
  const { authFetch } = useAuth();
  const { showAlert } = useAlert();
  const [selectedPeriod, setSelectedPeriod] = useState(null); // morning, afternoon, evening
  const [selectedDate, setSelectedDate] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [selectedDuration, setSelectedDuration] = useState(null);
  // availableSlots state removed (we use groupedSlots derived from slots)
  const [groupedSlots, setGroupedSlots] = useState({});
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [nextAvailableDay, setNextAvailableDay] = useState(null);
  // removed unused states: showExtendedDurations, datePickerLoading
  const [filteredDates, setFilteredDates] = useState(new Map());

  // Calculate date limits
  const minDate = new Date();
  const maxDate = DateTime.now().plus({ days: 90 }).toJSDate();

  // Optimize DatePicker performance by caching filtered dates
  useEffect(() => {
    const now = DateTime.now().setZone("Europe/Berlin");
    const startDate = now.startOf('month');
    const endDate = now.plus({ months: 3 }).endOf('month');
    const newFilteredDates = new Map();
    
    let current = startDate;
    while (current <= endDate) {
      const dateStr = current.toISODate();
      const cachedBookings = getCachedBookings(current.toJSDate());
      
      // Basic validation
      let isValid = current >= now.startOf('day');
      
      // Check office hours for today
      if (isValid && current.hasSame(now, 'day')) {
        const currentHour = now.hour;
        if (currentHour >= 22) isValid = false;
        else {
          const minutesLeft = (22 * 60) - (currentHour * 60 + now.minute);
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
  }, [bookings]);
  
  // Optimized filter using cached results
  const filterDate = useCallback((date) => {
    const dateStr = DateTime.fromJSDate(date).toISODate();
    return filteredDates.get(dateStr) ?? true;
  }, [filteredDates]);

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
    setSelectedPeriod(null);

    const now = DateTime.now().setZone(OFFICE_TIMEZONE);
    const selectedDateTime = DateTime.fromJSDate(selectedDate)
      .setZone(OFFICE_TIMEZONE, { keepLocalTime: true });

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

      const isToday = now.hasSame(selectedDateTime, 'day');

      // Get all available slots for the selected date
      const slots = getAvailableSlots(
        selectedDateTime,
        cachedBookings,
        15, // minimum duration
        isToday ? now : null
      );

  // Update UI state
  setError(slots.length === 0 ? "No available slots for this day" : null);
      const grouped = groupSlotsByPeriod(slots);
      setGroupedSlots(grouped);

      setBookings(cachedBookings);
      setLoading(false);
    } else {
      const unsubscribe = subscribeToMonth(selectedDate, (monthData) => {
        const dateBookings = monthData.get(selectedDateTime.toFormat('yyyy-MM-dd')) || [];
        setBookings(dateBookings);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [selectedDate, roomId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roomId || !selectedDate || !selectedSlot || !selectedDuration) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      const startLocal = selectedSlot.start
        .setZone(OFFICE_TIMEZONE)
        .set({
          year: selectedDate.getFullYear(),
          month: selectedDate.getMonth() + 1,
          day: selectedDate.getDate(),
        });

      const endLocal = startLocal.plus({ minutes: selectedDuration.minutes });

      if (endLocal.diff(startLocal, 'minutes').minutes !== selectedDuration.minutes) {
        setError("Selected time slot duration does not match the required duration");
        return;
      }

      const startTime = startLocal.toUTC().toISO();
      const endTime = endLocal.toUTC().toISO();

      const result = await authFetch("/api/bookings/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          room: roomId,
          start_time: startTime,
          end_time: endTime,
        }),
      });

      onBookingCreated(result);
      // Close the modal first, then show a global success toast (matching LoginForm style)
      onClose();
      // Delay slightly to ensure modal has closed before toast appears
      setTimeout(() => showAlert("Your booking was created successfully"), 50);
      setSelectedDate(null);
      setSelectedSlot(null);
      setSelectedDuration(null);
      setSelectedPeriod(null);
      setError(null);
    } catch (error) {
      logError("Error creating booking:", error);
      if (error.status === 401) {
        setError("Your session has expired. Please refresh the page and try again.");
      } else if (error.general && Array.isArray(error.general)) {
        setError(error.general.join(". "));
      } else {
        setError(error.message || "Failed to create booking. Please try again.");
      }
    }
  };

  const isValid = () => {
    return selectedDate && selectedDuration && selectedSlot;
  };

  return (
    // make form vertically scrollable on small screens so DatePicker and Book button are reachable
    <form
      onSubmit={handleSubmit}
      className="p-4 border rounded shadow bg-white max-w-md mx-auto max-h-[calc(100vh-6rem)] overflow-auto"
    >
      {error && (
        <div className="bg-red-500 text-white p-2 rounded mb-4 text-sm">
          <p>{error}</p>
          {nextAvailableDay && (
            <p className="mt-1">
              Next available day: {DateTime.fromJSDate(nextAvailableDay).toFormat('dd.MM.yyyy')}
              <button
                type="button"
                onClick={() => setSelectedDate(nextAvailableDay)}
                className="ml-2 text-white underline hover:no-underline"
              >
                Select
              </button>
            </p>
          )}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Select Date</label>
        <DatePicker
          selected={selectedDate}
          onChange={(date) => {
            setSelectedDate(date);
            setSelectedPeriod(null);
            setSelectedDuration(null);
            setSelectedSlot(null);
          }}
          filterDate={filterDate}
          dateFormat="dd.MM.yyyy"
          className="w-full border rounded px-2 py-1 text-sm"
          placeholderText="Select date"
          minDate={minDate}
          maxDate={maxDate}
          disabled={loading}
        />
      </div>

      {selectedDate && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Time of Day</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(TIME_PERIODS).map(([key, period]) => {
              const hasAvailableSlots = groupedSlots[key] && groupedSlots[key].length > 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedPeriod(key);
                    setSelectedDuration(null);
                    setSelectedSlot(null);
                  }}
                  disabled={!hasAvailableSlots}
                  className={`px-3 py-2 rounded text-sm ${
                    !hasAvailableSlots 
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : selectedPeriod === key
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  {period.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedDate && selectedPeriod && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Duration</label>
          <div className="grid grid-cols-3 gap-2">
            {(() => {
              // Get available durations for the selected period only
              const periodSlots = groupedSlots[selectedPeriod] || [];
              
              const selectedDateTime = DateTime.fromJSDate(selectedDate).setZone("Europe/Berlin");
              const allDurations = getAvailableDurations(selectedDateTime);
              
              const availableDurations = allDurations.filter(duration => {
                const hasSuitableSlot = periodSlots.some(slot => {
                  const fits = slot.duration >= duration.minutes;
                  return fits;
                });
                return hasSuitableSlot;
              });

              // Show only durations that have available slots in this period
              return (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const newDuration = { minutes: 15, label: "15 min" };
                      setSelectedDuration(newDuration);
                      // If there's a selected slot, update it with new duration
                      if (selectedSlot) {
                        const updatedSlot = new TimeSlot(
                          selectedSlot.start,
                          selectedSlot.start.plus({ minutes: newDuration.minutes })
                        );
                        setSelectedSlot(updatedSlot);
                      }
                    }}
                    disabled={!availableDurations.some(d => d.minutes === 15)}
                    className={`px-3 py-2 rounded text-sm ${
                      !availableDurations.some(d => d.minutes === 15)
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : selectedDuration?.minutes === 15
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    15 min
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const newDuration = { minutes: 30, label: "30 min" };
                      setSelectedDuration(newDuration);
                      // If there's a selected slot, update it with new duration
                      if (selectedSlot) {
                        const updatedSlot = new TimeSlot(
                          selectedSlot.start,
                          selectedSlot.start.plus({ minutes: newDuration.minutes })
                        );
                        setSelectedSlot(updatedSlot);
                      }
                    }}
                    disabled={!availableDurations.some(d => d.minutes === 30)}
                    className={`px-3 py-2 rounded text-sm ${
                      !availableDurations.some(d => d.minutes === 30)
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : selectedDuration?.minutes === 30
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    30 min
                  </button>
                  <select
                    value={selectedDuration?.minutes || ""}
                    onChange={(e) => {
                      const minutes = parseInt(e.target.value);
                      if (!minutes) return;
                      const duration = availableDurations.find(d => d.minutes === minutes);
                      if (duration) {
                        setSelectedDuration(duration);
                        // If there's a selected slot, update it with new duration
                        if (selectedSlot) {
                          const updatedSlot = new TimeSlot(
                            selectedSlot.start,
                            selectedSlot.start.plus({ minutes: duration.minutes })
                          );
                          setSelectedSlot(updatedSlot);
                        }
                      }
                    }}
                    className={`border rounded px-2 py-1 text-sm ${
                      availableDurations.filter(d => ![15, 30].includes(d.minutes)).length === 0 
                        ? "hidden" : ""
                    }`}
                  >
                    <option value="">More options...</option>
                    {availableDurations
                      .filter(d => ![15, 30].includes(d.minutes))
                      .map(duration => (
                        <option key={duration.minutes} value={duration.minutes}>
                          {duration.label}
                        </option>
                      ))}
                  </select>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {selectedDate && selectedPeriod && selectedDuration && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            Available Times ({TIME_PERIODS[selectedPeriod].label})
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(groupedSlots[selectedPeriod] || []).map((slot) => {
  const formattedTime = slot.format();
  const slotKey = `${formattedTime.start}-${formattedTime.end}`;
  // build a potential slot with the currently selected duration
  const potentialSlot = new TimeSlot(
    slot.start,
    slot.start.plus({ minutes: selectedDuration.minutes })
  );

  let isAvailable = true;
  let overlapBooking = null;

  // slot too short for selected duration
  if (slot.duration < selectedDuration.minutes) {
    isAvailable = false;
  }

  // check overlaps with existing bookings
  for (const booking of bookings) {
    const bookingStart = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
    const bookingEnd = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);

    if (potentialSlot.start < bookingEnd && potentialSlot.end > bookingStart) {
      isAvailable = false;
      overlapBooking = booking;
      break;
    }
  }

  return (
    <button
      key={slotKey}
      type="button"
      onClick={() => isAvailable && setSelectedSlot(potentialSlot)}
      disabled={!isAvailable}
      className={`px-3 py-2 text-sm rounded ${
        selectedSlot?.start.equals(slot.start)
          ? "bg-blue-500 text-white"
          : isAvailable
            ? "bg-gray-100 hover:bg-gray-200"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
      }`}
      title={!isAvailable && overlapBooking ? 
        `Already booked: ${
          DateTime.fromISO(overlapBooking.start_time).setZone(OFFICE_TIMEZONE).toFormat('HH:mm')
        } - ${
          DateTime.fromISO(overlapBooking.end_time).setZone(OFFICE_TIMEZONE).toFormat('HH:mm')
        }` : undefined}
    >
      {formattedTime.start}
    </button>
  );
})}
          </div>
        </div>
      )}

      {selectedDate && selectedDuration && selectedSlot && (
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <h4 className="text-sm font-medium mb-2">Booking Summary</h4>
          <div className="text-sm space-y-1">
            <p>Date: {DateTime.fromJSDate(selectedDate).toFormat('dd.MM.yyyy')}</p>
            <p>Time: {selectedSlot.format().start} - {selectedSlot.format().end}</p>
            <p>Duration: {selectedDuration.label}</p>
          </div>
        </div>
      )}

      <button
        type="submit"
        className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:bg-gray-400"
        disabled={!isValid() || loading}
      >
        {loading ? "Loading..." : "Book Room"}
      </button>
    </form>
  );
}