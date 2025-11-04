import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Office hours
const OFFICE_START = 8; // 08:00
const OFFICE_END = 22;  // 22:00
const MIN_DURATION = 15; // minutes

export default function BookingForm({ roomId, onBookingCreated }) {
  const { authFetch } = useAuth();

  const [selectedDate, setSelectedDate] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [availableStartTimes, setAvailableStartTimes] = useState([]);
  const [startTime, setStartTime] = useState("");
  const [durationOptions, setDurationOptions] = useState([]);
  const [selectedDuration, setSelectedDuration] = useState("");
  const [errorMessages, setErrorMessages] = useState([]);

  const minDate = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 90);

  // Fetch bookings for selected date and room
  useEffect(() => {
    if (!selectedDate) return;

    const fetchBookings = async () => {
      try {
        const dateStr = selectedDate.toISOString().split("T")[0];
        const data = await authFetch(`/api/bookings/?room=${roomId}&date=${dateStr}`);
        setBookings(data);
      } catch (err) {
        console.error(err);
        setErrorMessages(["Failed to load bookings."]);
      }
    };

    fetchBookings();
    setStartTime("");
    setSelectedDuration("");
    setDurationOptions([]);
  }, [selectedDate, roomId]);

  // Generate available start times based on bookings
  const generateStartTimes = useCallback(() => {
    if (!selectedDate) return [];

    const slots = [];
    const dayStart = new Date(selectedDate);
    dayStart.setHours(OFFICE_START, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(OFFICE_END, 0, 0, 0);

    const sortedBookings = bookings
      .map(b => ({ start: new Date(b.start_time), end: new Date(b.end_time) }))
      .sort((a, b) => a.start - b.start);

    let current = new Date(dayStart);
    while (current < dayEnd) {
      const currentEnd = new Date(current.getTime() + MIN_DURATION * 60000);
      const overlap = sortedBookings.some(
        b => current < b.end && currentEnd > b.start
      );
      if (!overlap) slots.push(current.toTimeString().slice(0, 5));
      current.setMinutes(current.getMinutes() + 15);
    }

    return slots;
  }, [bookings, selectedDate]);

  // Compute durations for selected start time
  const computeDurations = useCallback(() => {
    if (!startTime || !selectedDate) return [];

    const start = new Date(selectedDate);
    const [hour, minute] = startTime.split(":").map(Number);
    start.setHours(hour, minute, 0, 0);

    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(OFFICE_END, 0, 0, 0);

    // Sort bookings for the day
    const sortedBookings = bookings
      .map(b => ({ start: new Date(b.start_time), end: new Date(b.end_time) }))
      .sort((a, b) => a.start - b.start);

    // Find the next booking after selected start
    const nextBooking = sortedBookings.find(b => b.start > start);
    const maxEnd = nextBooking ? nextBooking.start : dayEnd;

    const options = [];
    let dur = 15;

    while (true) {
      const nextTime = new Date(start.getTime() + dur * 60 * 1000);
      if (nextTime > maxEnd) break;

      // Format duration string
      if (dur < 60) options.push(`${dur} min`);
      else {
        const h = Math.floor(dur / 60);
        const m = dur % 60;
        options.push(m === 0 ? `${h}h` : `${h}h${m}`);
      }

      // Increment duration
      if (dur < 45) dur += 15;      // 15 → 30 → 45
      else dur += 15;               // 1h → 1h15 → 1h30 → ...
    }

    return options;
  }, [bookings, startTime, selectedDate]);


  // Update available start times
  useEffect(() => {
    if (!selectedDate) return;
    const slots = generateStartTimes();
    setAvailableStartTimes(slots);

    if (slots.length === 0) {
      setErrorMessages(["No available slots for this date."]);
    } else {
      setErrorMessages([]);
    }

    setStartTime("");
    setSelectedDuration("");
    setDurationOptions([]);
  }, [generateStartTimes, selectedDate]);

  // Update duration options
  useEffect(() => {
    if (!startTime) return;
    const durations = computeDurations();
    setDurationOptions(durations);

    if (durations.length === 0 && startTime) {
      setErrorMessages(["No available durations for this start time."]);
    } else {
      setErrorMessages([]);
    }

    setSelectedDuration("");
  }, [startTime, computeDurations]);

  // Submit booking
  const handleSubmit = async e => {
    e.preventDefault();
    if (!selectedDate || !startTime || !selectedDuration) return;

    const [hour, minute] = startTime.split(":").map(Number);
    const start = new Date(selectedDate);
    start.setHours(hour, minute, 0, 0);

    let end = new Date(start);
    if (selectedDuration.includes("h")) {
      const parts = selectedDuration.split("h");
      const h = parseInt(parts[0]);
      const m = parts[1] ? parseInt(parts[1]) : 0;
      end.setHours(end.getHours() + h);
      end.setMinutes(end.getMinutes() + m);
    } else {
      end.setMinutes(end.getMinutes() + parseInt(selectedDuration));
    }

    try {
      const newBooking = await authFetch("/api/bookings/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomId,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
        }),
      });

      if (onBookingCreated) onBookingCreated(newBooking);

      setSelectedDate(null);
      setStartTime("");
      setSelectedDuration("");
      setAvailableStartTimes([]);
      setDurationOptions([]);
      setErrorMessages([]);
    } catch (err) {
      const collectedErrors = [];

      if (err.general) collectedErrors.push(...err.general);
      ["start_time", "end_time", "room", "user", "non_field_errors"].forEach(key => {
        if (err[key]) {
          collectedErrors.push(
            `${key}: ${Array.isArray(err[key]) ? err[key].join(", ") : err[key]}`
          );
        }
      });
      if (collectedErrors.length === 0) {
        collectedErrors.push(err.message || "Unexpected error. Please try again.");
      }

      setErrorMessages(collectedErrors);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded shadow bg-white max-w-md mx-auto">
      {errorMessages.length > 0 && (
        <div className="bg-red-500 text-white p-2 rounded mb-4 text-sm">
          {errorMessages.map((msg, i) => <p key={i}>{msg}</p>)}
        </div>
      )}

      {/* Date picker */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Select Date</label>
        <DatePicker
          selected={selectedDate}
          onChange={setSelectedDate}
          dateFormat="dd.MM.yyyy"
          className="w-full border rounded px-2 py-1 text-sm"
          placeholderText="Select date"
          minDate={minDate}
          maxDate={maxDate}
        />
      </div>

      {/* Start Time */}
      {availableStartTimes.length > 0 && (
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Start Time</label>
          <select
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
          >
            <option value="" disabled hidden>Select start time</option>
            {availableStartTimes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      {/* Duration */}
      {durationOptions.length > 0 && (
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">Duration</label>
          <select
            value={selectedDuration}
            onChange={e => setSelectedDuration(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
          >
            <option value="" disabled hidden>Select duration</option>
            {durationOptions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!selectedDate || !startTime || !selectedDuration}
        className={`w-full px-4 py-2 rounded transition ${!selectedDate || !startTime || !selectedDuration
            ? "bg-gray-400 text-gray-700 cursor-not-allowed"
            : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
      >
        Book
      </button>
    </form>
  );
}
