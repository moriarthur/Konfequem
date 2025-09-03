import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function BookingForm({ roomId, onSuccess }) {
  const { authFetch } = useAuth();

  // --- Form state ---
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [generalError, setGeneralError] = useState(""); // Top block error
  const [errors, setErrors] = useState({}); // For input highlight
  const [loading, setLoading] = useState(false);

  // --- Handle form submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError("");
    setErrors({});

    // --- Frontend required validation ---
    const requiredErrors = {};
    if (!date) requiredErrors.date = true;
    if (!startTime) requiredErrors.start_time = true;
    if (!endTime) requiredErrors.end_time = true;

    if (Object.keys(requiredErrors).length) {
      setErrors(requiredErrors);
      setGeneralError("Please fix the highlighted fields.");
      return;
    }

    setLoading(true);

    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);
    const now = new Date();

    if (startDateTime < now) {
      setErrors({ date: true });
      setGeneralError("Start time cannot be in the past.");
      setLoading(false);
      return;
    }

    try {
      // --- Send POST request to backend ---
      const newBooking = await authFetch("/api/bookings/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomId,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
        }),
      });

      // --- Call success callback ---
      onSuccess(roomId, newBooking);

      // --- Reset form ---
      setDate("");
      setStartTime("");
      setEndTime("");
      setErrors({});
      setGeneralError("");
    } catch (err) {
      console.log("Booking error:", err);

      // --- Collect backend errors ---
      let backendMessage = "Unknown error. Try again.";
      if (err.non_field_errors) {
        // Join multiple messages into one string
        backendMessage = Array.isArray(err.non_field_errors)
          ? err.non_field_errors.join(" ")
          : err.non_field_errors;
      } else if (err.detail) {
        backendMessage = err.detail;
      }

      setGeneralError(backendMessage);

      // --- Highlight all fields if any error ---
      setErrors({
        date: true,
        start_time: true,
        end_time: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // --- Input CSS classes ---
  const inputClass = (field) =>
    `w-full p-2 border rounded transition-colors duration-200 bg-white ${errors[field] ? "border-red-500" : "border-gray-300"
    }`;

  return (
    <form onSubmit={handleSubmit} className="mt-2 p-4 border rounded bg-gray-50 relative">
      {/* General top error */}
      {generalError && (
        <div className="bg-red-100 text-red-700 p-2 mb-2 rounded text-sm font-medium transition-all duration-200">
          {generalError}
        </div>
      )}

      {/* Date input */}
      <div>
        <label className="block text-sm font-medium mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass("date")}
        />
      </div>

      {/* Start Time input */}
      <div className="mt-2">
        <label className="block text-sm font-medium mb-1">Start Time</label>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className={inputClass("start_time")}
        />
      </div>

      {/* End Time input */}
      <div className="mt-2">
        <label className="block text-sm font-medium mb-1">End Time</label>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className={inputClass("end_time")}
        />
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-gray-400 transition-colors duration-200"
      >
        {loading ? "Booking..." : "Book Now"}
      </button>
    </form>
  );
}
