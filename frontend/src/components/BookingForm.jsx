import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function BookingForm({ roomId, onSuccess }) {
  const { authFetch } = useAuth();
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setGeneralError("");
    setErrors({});

    // Client-side required check
    const requiredErrors = {};
    if (!date) requiredErrors.date = true;
    if (!startTime) requiredErrors.start_time = true;
    if (!endTime) requiredErrors.end_time = true;
    if (Object.keys(requiredErrors).length > 0) {
      setErrors(requiredErrors);
      setGeneralError("All fields are required.");
      return;
    }

    setLoading(true);

    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);
    const now = new Date();

    const fieldErrors = {};

    // Past date/time check
    if (startDateTime < now) {
      if (startDateTime.toDateString() < now.toDateString()) {
        fieldErrors.date = true; // past date
      } else {
        fieldErrors.date = true; // today
        fieldErrors.start_time = true; // time in past
      }
      setErrors(fieldErrors);
      setGeneralError("Start time cannot be in the past.");
      setLoading(false);
      return;
    }

    try {
      await authFetch("/api/bookings/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomId,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
        }),
      });

      // success
      onSuccess(roomId, { start_time: startDateTime, end_time: endDateTime });
      setDate("");
      setStartTime("");
      setEndTime("");
    } catch (err) {
      // Backend errors mapping
      const backendErrors = {};
      if (err.start_time) backendErrors.start_time = true;
      if (err.end_time) backendErrors.end_time = true;
      if (err.non_field_errors) setGeneralError(Array.isArray(err.non_field_errors) ? err.non_field_errors.join(" ") : err.non_field_errors);
      if (err.detail) setGeneralError(err.detail);

      // Working hours error detection
      if (backendErrors.start_time && backendErrors.start_time.includes && backendErrors.start_time.includes("working hours")) {
        // Highlight the actual field(s)
        if (err.start_time && err.start_time.toLowerCase().includes("start")) backendErrors.start_time = true;
        if (err.start_time && err.start_time.toLowerCase().includes("end")) backendErrors.end_time = true;
      }
      setGeneralError("Rooms can be booked between 8:00 - 18:00.");
      setErrors(backendErrors);

    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) =>
    `w-full p-2 border rounded ${
      errors[field] ? "border-red-500" : "border-gray-300"
    }`;

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 border rounded bg-gray-50 relative">
      {generalError && (
        <div className="bg-red-100 text-red-700 p-2 mb-2 rounded text-sm font-medium">
          {generalError}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass("date")}
        />
      </div>

      <div className="mt-2">
        <label className="block text-sm font-medium mb-1">Start Time</label>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className={inputClass("start_time")}
        />
      </div>

      <div className="mt-2">
        <label className="block text-sm font-medium mb-1">End Time</label>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className={inputClass("end_time")}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? "Booking..." : "Book Now"}
      </button>
    </form>
  );
}
