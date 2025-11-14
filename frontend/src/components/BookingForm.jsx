import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import { error as logError } from "../utils/logger";
import { DayPicker } from "react-day-picker";
import { DateTime } from "luxon";
import { motion, AnimatePresence } from "framer-motion";
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

export default function BookingForm({ roomId, onBookingCreated, onClose }) {
  const { authFetch } = useAuth();
  const { showAlert } = useAlert();
  
  // Progressive reveal animation variants
  const progressiveRevealVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.8,
      filter: "blur(2px)"
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      filter: "blur(0px)",
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.8,
      filter: "blur(2px)",
      transition: {
        duration: 0.3,
        ease: "easeIn"
      }
    }
  };

  // Container variants with stagger for Available Times
  const containerVariants = {
    hidden: {},
    visible: { 
      transition: {
        staggerChildren: 0.03,
        delayChildren: 0.1
      }
    },
    exit: {}
  };

  // Item variants for individual time slots
  const slotVariants = {
    hidden: { 
      scale: 0.85,
      filter: "blur(1px)"
    },
    visible: { 
      scale: 1,
      filter: "blur(0px)",
      transition: {
        duration: 0.4,
        ease: [0.23, 1, 0.32, 1]
      }
    }
  };
  
  // Step-based delay for progressive reveal
  const getStepDelay = (step) => step * 0.2;
  
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

  // Optimize date filtering for DayPicker
  useEffect(() => {
    const now = DateTime.now().setZone("Europe/Berlin");
    const startDate = now.startOf('month');
    const endDate = now.plus({ months: 3 }).endOf('month');
    const newFilteredDates = new Map();
    
    let current = startDate;
    while (current <= endDate) {
      const dateStr = current.toISODate();
      const jsDate = current.toJSDate();
      const cachedBookings = getCachedBookings(jsDate);
      
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
  
  // Filter function for DayPicker
  const isDateDisabled = useCallback((date) => {
    const dateStr = DateTime.fromJSDate(date).toISODate();
    return !(filteredDates.get(dateStr) ?? true);
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

    // Final validation before submission
    const selectedDateTime = DateTime.fromJSDate(selectedDate).setZone(OFFICE_TIMEZONE);
    const relevantBookings = bookings.filter(booking => {
      const bookingStart = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
      const bookingRoomId = booking.room?.id || booking.room;
      return bookingRoomId === roomId && bookingStart.hasSame(selectedDateTime, 'day');
    });

    // Double-check for overlaps before submission
    for (const booking of relevantBookings) {
      const bookingStart = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
      const bookingEnd = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);

      if (selectedSlot.start < bookingEnd && selectedSlot.end > bookingStart) {
        setError("This time slot is no longer available. Please select a different time.");
        setSelectedSlot(null);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/api/bookings/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomId,
          start_time: selectedSlot.start.toISO(),
          end_time: selectedSlot.end.toISO(),
        }),
      });

      // authFetch already returns parsed JSON data
      const newBooking = response;
      
      // Delay slightly to ensure modal has closed before toast appears
      setTimeout(() => showAlert("Your booking was created successfully"), 50);
      setSelectedDate(null);
      setSelectedSlot(null);
      setSelectedDuration(null);
      setSelectedPeriod(null);
      setError(null);
      
      if (onBookingCreated) onBookingCreated(newBooking);
    } catch (error) {
      logError("Error creating booking:", error);
      if (error.status === 401) {
        setError("Your session has expired. Please refresh the page and try again.");
      } else if (error.general && Array.isArray(error.general)) {
        setError(error.general.join(". "));
      } else {
        setError(error.message || "Failed to create booking. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const isValid = () => {
    return selectedDate && selectedDuration && selectedSlot;
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
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
        <label className="block text-sm font-medium mb-3">Select Date</label>
        <div className="flex justify-center">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date);
              setSelectedPeriod(null);
              setSelectedDuration(null);
              setSelectedSlot(null);
            }}
            disabled={isDateDisabled}
            fromDate={minDate}
            toDate={maxDate}
            className="rdp-custom"
            styles={{
              caption: { color: '#1f2937' },
              head_cell: { color: '#6b7280' },
              nav_button: { color: '#374151' },
              nav_button_disabled: { color: '#d1d5db' },
              day: { color: '#374151' },
              day_disabled: { color: '#d1d5db' },
              day_selected: { 
                backgroundColor: '#3b82f6', 
                color: 'white',
                fontWeight: 'bold'
              },
              day_today: { 
                backgroundColor: '#eff6ff', 
                color: '#1d4ed8',
                fontWeight: 'bold'
              }
            }}
          />
        </div>
        {selectedDate && (
          <div className="mt-3 text-center">
            <span className="text-sm text-gray-600">
              Selected: {DateTime.fromJSDate(selectedDate).toFormat('dd.MM.yyyy')}
            </span>
          </div>
        )}
      </div>

    <AnimatePresence mode="wait">
      {selectedDate && (
        <motion.div
          key="time-period"
          variants={progressiveRevealVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ delay: getStepDelay(1) }}
          className="mb-4"
        >
          <label className="block text-sm font-medium mb-1">Time of Day</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(TIME_PERIODS).map(([key, period], index) => {
              const hasAvailableSlots = groupedSlots[key] && groupedSlots[key].length > 0;
              return (
                <motion.button
                  key={key}
                  type="button"
                  variants={progressiveRevealVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: getStepDelay(1) + index * 0.1 }}
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
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence mode="wait">
      {selectedDate && selectedPeriod && (
        <motion.div
          key="duration"
          variants={progressiveRevealVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ delay: getStepDelay(2) }}
          className="mb-4"
        >
          <label className="block text-sm font-medium mb-1">Duration</label>
          <motion.div 
            className="grid grid-cols-3 gap-2"
            variants={progressiveRevealVariants}
            initial="hidden"
            animate="visible"
          >
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
                  <motion.button
                    key="15min"
                    type="button"
                    variants={progressiveRevealVariants}
                    transition={{ delay: getStepDelay(2) + 0.1 }}
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
                  </motion.button>
                  <motion.button
                    key="30min"
                    type="button"
                    variants={progressiveRevealVariants}
                    transition={{ delay: getStepDelay(2) + 0.2 }}
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
                  </motion.button>
                  <motion.select
                    key="more-options"
                    variants={progressiveRevealVariants}
                    transition={{ delay: getStepDelay(2) + 0.3 }}
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
                  </motion.select>
                </>
              );
            })()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence mode="wait">
      {selectedDate && selectedPeriod && selectedDuration && (
        <motion.div
          key="available-times"
          variants={progressiveRevealVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ delay: getStepDelay(3) }}
          className="mb-4"
        >
          <label className="block text-sm font-medium mb-1">
            Available Times ({TIME_PERIODS[selectedPeriod].label})
          </label>
          <motion.div 
            className="grid grid-cols-4 gap-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {(groupedSlots[selectedPeriod] || []).map((slot, index) => {
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

              // check overlaps with existing bookings for this room and date
              const selectedDateTime = DateTime.fromJSDate(selectedDate).setZone(OFFICE_TIMEZONE);
              const relevantBookings = bookings.filter(booking => {
                const bookingStart = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
                const bookingRoomId = booking.room?.id || booking.room;
                return bookingRoomId === roomId && bookingStart.hasSame(selectedDateTime, 'day');
              });

              for (const booking of relevantBookings) {
                const bookingStart = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
                const bookingEnd = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);

                // Check if potential slot overlaps with existing booking
                // Two slots overlap if: start1 < end2 AND end1 > start2
                if (potentialSlot.start < bookingEnd && potentialSlot.end > bookingStart) {
                  isAvailable = false;
                  overlapBooking = booking;
                  break;
                }
              }

              return (
                <motion.button
                  key={slotKey}
                  type="button"
                  variants={slotVariants}
                  onClick={() => {
                    if (isAvailable) {
                      setSelectedSlot(potentialSlot);
                    }
                  }}
                  disabled={!isAvailable}
                  className={`px-3 py-2 text-sm rounded transition-all ${
                    selectedSlot?.start.equals(slot.start)
                      ? "bg-blue-500 text-white shadow-md"
                      : isAvailable
                        ? "bg-gray-100 hover:bg-gray-200 hover:shadow-sm"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
                  }`}
                  title={!isAvailable && overlapBooking ? 
                    `Already booked: ${
                      DateTime.fromISO(overlapBooking.start_time).setZone(OFFICE_TIMEZONE).toFormat('HH:mm')
                    } - ${
                      DateTime.fromISO(overlapBooking.end_time).setZone(OFFICE_TIMEZONE).toFormat('HH:mm')
                    }` : (!isAvailable ? "Time slot not available" : "Click to select this time")
                  }
                >
                  <div className="flex flex-col items-center">
                    <span className="font-medium">{formattedTime.start}</span>
                    {!isAvailable && overlapBooking && (
                      <span className="text-xs mt-1">Busy</span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence mode="wait">
      {selectedDate && selectedDuration && selectedSlot && (
        <motion.div
          key="booking-summary"
          variants={progressiveRevealVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ delay: getStepDelay(4) }}
          className="mb-4 p-3 bg-gray-50 rounded"
        >
          <motion.h4 
            className="text-sm font-medium mb-2"
            variants={progressiveRevealVariants}
            transition={{ delay: getStepDelay(4) + 0.1 }}
          >
            Booking Summary
          </motion.h4>
          <motion.div 
            className="text-sm space-y-1"
            variants={progressiveRevealVariants}
            transition={{ delay: getStepDelay(4) + 0.2 }}
          >
            <motion.p variants={progressiveRevealVariants} transition={{ delay: getStepDelay(4) + 0.3 }}>
              Date: {DateTime.fromJSDate(selectedDate).toFormat('dd.MM.yyyy')}
            </motion.p>
            <motion.p variants={progressiveRevealVariants} transition={{ delay: getStepDelay(4) + 0.4 }}>
              Time: {selectedSlot.format().start} - {selectedSlot.format().end}
            </motion.p>
            <motion.p variants={progressiveRevealVariants} transition={{ delay: getStepDelay(4) + 0.5 }}>
              Duration: {selectedDuration.label}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

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