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
import Button from "./ui/Button";
import { Text, Label } from "./ui/Typography";

export default function BookingForm({ roomId, onBookingCreated, onClose }) {
  const { authFetch } = useAuth();
  const { showAlert } = useAlert();
  const [isBookingSuccessful, setIsBookingSuccessful] = useState(false);
  
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
    },
    success: {
      scale: [1, 1.05, 1],
      transition: {
        duration: 0.4,
        ease: [0.68, -0.55, 0.265, 1.55]
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

  // Calculate date limits (persist for session)
  const [minDate] = useState(() => DateTime.now().setZone(OFFICE_TIMEZONE).startOf('day').toJSDate());
  const [maxDate] = useState(() => DateTime.now().setZone(OFFICE_TIMEZONE).plus({ months: 6 }).endOf('day').toJSDate());

  // Optimize date filtering for DayPicker
  useEffect(() => {
    const now = DateTime.now().setZone(OFFICE_TIMEZONE);
    const startDate = DateTime.fromJSDate(minDate).setZone(OFFICE_TIMEZONE).startOf('month');
    const endDate = DateTime.fromJSDate(maxDate).setZone(OFFICE_TIMEZONE).endOf('month');
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
  }, [bookings, minDate, maxDate]);

  // Filter function for DayPicker
  const isDateDisabledInternal = useCallback((date) => {
    const dateKey = DateTime.fromJSDate(date).setZone(OFFICE_TIMEZONE).toISODate();
    return !(filteredDates.get(dateKey) ?? true);
  }, [filteredDates]);

  const isDateDisabled = useCallback((date) => {
    if (date < minDate || date > maxDate) {
      return true;
    }
    return isDateDisabledInternal(date);
  }, [minDate, maxDate, isDateDisabledInternal]);

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

      // Trigger success animation
      setIsBookingSuccessful(true);

      // Show success message after a brief delay
      setTimeout(() => showAlert("Your booking was created successfully"), 300);

      // Reset form state
      setSelectedDate(null);
      setSelectedSlot(null);
      setSelectedDuration(null);
      setSelectedPeriod(null);
      setError(null);

      // Notify parent component
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
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-4"
      animate={isBookingSuccessful ? "success" : "visible"}
      variants={progressiveRevealVariants}
    >
      {error && (
        <Card className="p-4 mb-6 border-status-danger/20 bg-status-danger/10">
          <Text className="font-medium text-status-danger-text">{error}</Text>
          {nextAvailableDay && (
            <div className="mt-2">
              <Text variant="small" className="text-status-danger-text">
                Next available day: {DateTime.fromJSDate(nextAvailableDay).toFormat('dd.MM.yyyy')}
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

      <div className="mb-6">
        <Label>Select Date</Label>
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
          <div className="mt-4 text-center">
            <Text variant="small">
              Selected: {DateTime.fromJSDate(selectedDate).toFormat('dd.MM.yyyy')}
            </Text>
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
          className="mb-6"
        >
          <Label>Time of Day</Label>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(TIME_PERIODS).map(([key, period], index) => {
              const hasAvailableSlots = groupedSlots[key] && groupedSlots[key].length > 0;
              return (
                <Button
                  key={key}
                  type="button"
                  variant={!hasAvailableSlots ? "secondary" : selectedPeriod === key ? "primary" : "secondary"}
                  size="sm"
                  disabled={!hasAvailableSlots}
                  className={`${!hasAvailableSlots ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : ''} ${selectedPeriod === key ? 'bg-blue-600 text-white' : ''}`}
                  onClick={() => {
                    setSelectedPeriod(key);
                    setSelectedDuration(null);
                    setSelectedSlot(null);
                  }}
                >
                  {period.label}
                </Button>
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
          className="mb-6"
        >
          <Label>Duration</Label>
          <motion.div 
            className="grid grid-cols-3 gap-3"
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
                  <Button
                    key="15min"
                    type="button"
                    variant={selectedDuration?.minutes === 15 ? "primary" : "secondary"}
                    size="sm"
                    disabled={!availableDurations.some(d => d.minutes === 15)}
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
                  >
                    15 min
                  </Button>
                  <Button
                    key="30min"
                    type="button"
                    variant={selectedDuration?.minutes === 30 ? "primary" : "secondary"}
                    size="sm"
                    disabled={!availableDurations.some(d => d.minutes === 30)}
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
                  >
                    30 min
                  </Button>
                  <select
                    key="more-options"
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
                    className={`border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
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
          className="mb-6"
        >
          <Label>
            Available Times ({TIME_PERIODS[selectedPeriod].label})
          </Label>
          <motion.div 
            className="grid grid-cols-4 gap-3"
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
                <Button
                  key={slotKey}
                  type="button"
                  variant={selectedSlot?.start.equals(slot.start) ? "primary" : "secondary"}
                  size="sm"
                  disabled={!isAvailable}
                  className={`${!isAvailable ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60' : ''} ${selectedSlot?.start.equals(slot.start) ? 'bg-blue-600 text-white shadow-md' : ''} ${isAvailable && !selectedSlot?.start.equals(slot.start) ? 'hover:shadow-sm' : ''}`}
                  onClick={() => {
                    if (isAvailable) {
                      setSelectedSlot(potentialSlot);
                    }
                  }}
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
                      <Text variant="small" className="mt-1">Busy</Text>
                    )}
                  </div>
                </Button>
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
          className="mb-6 p-4 bg-surface-muted rounded-xl"
        >
          <Text className="font-medium text-accent-secondary mb-3 block">
            Booking Summary
          </Text>
          <div className="space-y-2">
            <Text variant="default">
              Date: {DateTime.fromJSDate(selectedDate).toFormat('dd.MM.yyyy')}
            </Text>
            <Text variant="default">
              Time: {selectedSlot.format().start} - {selectedSlot.format().end}
            </Text>
            <Text variant="default">
              Duration: {selectedDuration.label}
            </Text>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

      <motion.div
        animate={isBookingSuccessful ? {
          scale: [1, 1.02, 1],
          transition: { duration: 0.3 }
        } : {}}
      >
        <Button
          variant="primary"
          size="lg"
          type="submit"
          disabled={!isValid() || loading || isBookingSuccessful}
          className={`w-full ${
            isBookingSuccessful
              ? 'bg-status-success hover:bg-status-success focus:ring-status-success/40'
              : ''
          }`}
        >
          {loading ? "Loading..." : isBookingSuccessful ? "✓ Booking Confirmed" : "Book Room"}
        </Button>
      </motion.div>
    </motion.form>
  );
}