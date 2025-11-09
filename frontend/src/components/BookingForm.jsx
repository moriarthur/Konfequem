import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import DatePicker from "react-datepicker";
import { DateTime } from "luxon";
import "react-datepicker/dist/react-datepicker.css";
import {
  findAvailableSlots,
  getAvailableDurations,
  formatSlot,
  toOfficeTime,
  toUTCString,
} from "../utils/bookingUtils";
import {
  fetchMonthBookings,
  getCachedBookings,
  isDateFullyBooked,
  hasTimeSlots,
  shouldFetchMonth,
  subscribeToMonth,
} from "../utils/bookingCache";

export default function BookingForm({ roomId, onBookingCreated, onClose }) {
  const { authFetch } = useAuth();

  const [selectedDate, setSelectedDate] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [durations, setDurations] = useState([]);
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Calculate date limits
  const minDate = new Date();
  const maxDate = DateTime.now().plus({ days: 90 }).toJSDate();

  // Pre-fetch data for visible month
  useEffect(() => {
    const date = selectedDate || new Date();
    if (shouldFetchMonth(date)) {
      fetchMonthBookings(date, roomId, authFetch);
    }
  }, [selectedDate, roomId, authFetch]);

  // Update slots when date is selected
  useEffect(() => {
    if (!selectedDate) return;

    setLoading(true);
    setError(null);

    const cachedBookings = getCachedBookings(selectedDate);
    if (cachedBookings) {
      const slots = findAvailableSlots(selectedDate, cachedBookings);
      setBookings(cachedBookings);
      setAvailableSlots(slots);
      
      if (slots.length === 0) {
        setError("No available slots for this date");
      }
      setLoading(false);
    } else {
      // Subscribe to updates for this month
      const unsubscribe = subscribeToMonth(selectedDate, (monthData) => {
        const dateBookings = monthData.get(DateTime.fromJSDate(selectedDate)
          .setZone("Europe/Berlin")
          .toFormat('yyyy-MM-dd')) || [];
        
        const slots = findAvailableSlots(selectedDate, dateBookings);
        setBookings(dateBookings);
        setAvailableSlots(slots);
        
        if (slots.length === 0) {
          setError("No available slots for this date");
        }
        setLoading(false);
      });

      return () => unsubscribe();
    }

    // Reset selections
    setSelectedSlot(null);
    setSelectedDuration(null);
    setDurations([]);
  }, [selectedDate, roomId]);

  // Update durations when slot is selected
  useEffect(() => {
    if (!selectedSlot || !selectedDate) return;
    
    const slotDate = new Date(selectedDate);
    const [hours, minutes] = selectedSlot.split(":").map(Number);
    slotDate.setHours(hours, minutes, 0, 0);
    
    const availableDurations = getAvailableDurations(slotDate, bookings, selectedDate);
    setDurations(availableDurations);
    setSelectedDuration(null);
  }, [selectedSlot, selectedDate, bookings]);

  // Quick filter for DatePicker - only checks basic rules
  const filterDate = useCallback((date) => {
    if (!hasTimeSlots(date)) return false;
    
    const cachedBookings = getCachedBookings(date);
    if (cachedBookings) {
      return !isDateFullyBooked(date, cachedBookings);
    }
    
    // If no cache yet, allow the date and we'll check when selected
    return true;
  }, []);

    const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDate || !selectedSlot || !selectedDuration) return;

    try {
      setLoading(true);
      setError(null);

      // Create start date in office timezone
      const [hours, minutes] = selectedSlot.split(":").map(Number);
      const startLocal = DateTime.fromJSDate(selectedDate)
        .setZone("Europe/Berlin")
        .set({ hour: hours, minute: minutes });

      // Calculate end time
      const endLocal = startLocal.plus({ minutes: selectedDuration.minutes });

      // Convert to UTC for API
      const startUTC = toUTCString(startLocal);
      const endUTC = toUTCString(endLocal);

      const newBooking = await authFetch("/api/bookings/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomId,
          start_time: startUTC,
          end_time: endUTC,
        }),
      });

      if (onBookingCreated) onBookingCreated(newBooking);
      if (onClose) onClose();

      // Reset form
      setSelectedDate(null);
      setSelectedSlot(null);
      setSelectedDuration(null);
      setAvailableSlots([]);
      setDurations([]);
      setError(null);
    } catch (err) {
      const errorMessage = err.general 
        ? err.general.join(", ") 
        : err.message || "Failed to create booking";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded shadow bg-white max-w-md mx-auto">
      {error && (
        <div className="bg-red-500 text-white p-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Select Date</label>
        <DatePicker
          selected={selectedDate}
          onChange={setSelectedDate}
          filterDate={filterDate}
          dateFormat="dd.MM.yyyy"
          className="w-full border rounded px-2 py-1 text-sm"
          placeholderText="Select date"
          minDate={minDate}
          maxDate={maxDate}
          disabled={loading}
        />
      </div>

      {availableSlots.length > 0 && (
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Start Time</label>
          <select
            value={selectedSlot || ""}
            onChange={(e) => setSelectedSlot(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
            disabled={loading}
          >
            <option value="" disabled>Select start time</option>
            {availableSlots.map((slot) => (
              <option key={formatSlot(slot)} value={formatSlot(slot)}>
                {formatSlot(slot)}
              </option>
            ))}
          </select>
        </div>
      )}

      {durations.length > 0 && (
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Duration</label>
          <select
            value={selectedDuration ? selectedDuration.minutes : ""}
            onChange={(e) => {
              const minutes = parseInt(e.target.value);
              const duration = durations.find(d => d.minutes === minutes);
              setSelectedDuration(duration);
            }}
            className="w-full border rounded px-2 py-1 text-sm"
            disabled={loading}
          >
            <option value="" disabled>Select duration</option>
            {durations.map((duration) => (
              <option key={duration.minutes} value={duration.minutes}>
                {duration.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={!selectedDate || !selectedSlot || !selectedDuration || loading}
        className={`w-full px-4 py-2 rounded transition relative ${
          !selectedDate || !selectedSlot || !selectedDuration || loading
            ? "bg-gray-400 text-gray-700 cursor-not-allowed"
            : "bg-blue-500 text-white hover:bg-blue-600"
        }`}
      >
        {loading ? "Booking..." : "Book"}
      </button>
    </form>
  );
}
