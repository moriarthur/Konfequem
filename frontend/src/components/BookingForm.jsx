import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

export default function BookingForm({ roomId, onBookingCreated }) {
  const { authFetch } = useAuth();

  const [startDate, setStartDate] = useState(null);
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState(null);
  const [endTime, setEndTime] = useState("");
  const [errorMessages, setErrorMessages] = useState([]);

  // Restriction: today as min, 30 days ahead as max
  const minDate = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessages([]);

    if (!startDate || !startTime || !endDate || !endTime) {
      setErrorMessages(["Please select both date and time for start and end."]);
      return;
    }

    const start = new Date(`${startDate.toISOString().split("T")[0]}T${startTime}`);
    const end = new Date(`${endDate.toISOString().split("T")[0]}T${endTime}`);

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

      setStartDate(null);
      setStartTime("");
      setEndDate(null);
      setEndTime("");
    } catch (err) {
      const collectedErrors = [];

      if (err.general) collectedErrors.push(...err.general);
      ["start_time", "end_time", "room", "user", "non_field_errors"].forEach((key) => {
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
    <form onSubmit={handleSubmit} className="p-4 border rounded shadow bg-white">
      {errorMessages.length > 0 && (
        <div className="bg-red-500 text-white p-2 rounded mb-4 text-sm">
          {errorMessages.map((msg, i) => (
            <p key={i}>{msg}</p>
          ))}
        </div>
      )}

      {/* Start date */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Start date</label>
        <DatePicker
          selected={startDate}
          onChange={(date) => setStartDate(date)}
          dateFormat="dd.MM.yyyy"
          className="w-full border rounded px-2 py-1 text-sm"
          placeholderText="Select start date"
          minDate={minDate}
          maxDate={maxDate}
        />
      </div>

      {/* Start Time */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Start Time</label>
        <select
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-full border rounded px-2 py-1 text-sm text-gray-400"
          required
        >
          <option value="" disabled hidden>
            Select start time
          </option>
          {Array.from({ length: (20 - 8) * 4 + 1 }, (_, i) => {
            const hour = 8 + Math.floor(i / 4);
            const minute = (i % 4) * 15;
            const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
            return (
              <option key={timeStr} value={timeStr}>
                {timeStr}
              </option>
            );
          })}
        </select>
      </div>

      {/* End date */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">End date</label>
        <DatePicker
          selected={endDate}
          onChange={(date) => setEndDate(date)}
          dateFormat="dd.MM.yyyy"
          className="w-full border rounded px-2 py-1 text-sm"
          placeholderText="Select end date"
          minDate={minDate}
          maxDate={maxDate}
        />
      </div>

      {/* End Time */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">End Time</label>
        <select
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="w-full border rounded px-2 py-1 text-sm text-gray-400"
          required
        >
          <option value="" disabled hidden>
            Select end time
          </option>
          {Array.from({ length: (20 - 8) * 4 + 1 }, (_, i) => {
            const hour = 8 + Math.floor(i / 4);
            const minute = (i % 4) * 15;
            const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
            return (
              <option key={timeStr} value={timeStr}>
                {timeStr}
              </option>
            );
          })}
        </select>
      </div>

      {/* Submit button */}
      <button type="submit" className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition" > 
          Book 
      </button>

      {/* Reset button */}
      <div className="mt-2">
        <button
          type="button"
          onClick={() => {
            setStartDate(null);
            setStartTime("");
            setEndTime("");
            setErrorMessages([]);
          }}
          className="w-full bg-gray-300 text-black px-2 py-1 rounded text-sm hover:bg-gray-400"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
