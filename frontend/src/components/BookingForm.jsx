import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function BookingForm({ roomId, onSuccess }) {
  const { authFetch } = useAuth();
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    if (!date || !startTime || !endTime) {
      setErrors({ general: "Please fill in all fields." });
      setLoading(false);
      return;
    }

    // Frontend working hours validation
    if (startTime < "08:00" || endTime > "18:00") {
      setErrors({ general: "Booking must be within working hours 08:00-18:00." });
      setLoading(false);
      return;
    }

    try {
      const startDateTime = new Date(`${date}T${startTime}:00`);
      const endDateTime = new Date(`${date}T${endTime}:00`);

      const newBooking = await authFetch("/api/bookings/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomId,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
        }),
      });

      if (typeof onSuccess === "function") onSuccess(roomId, newBooking);

      window.dispatchEvent(new CustomEvent("konfequem:bookingCreated", { detail: { roomId, booking: newBooking } }));

      setDate("");
      setStartTime("");
      setEndTime("");
      setErrors({});
    } catch (err) {
      console.log("Booking error:", err);
      setErrors({ general: "Error creating booking. Try again." });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) =>
    `w-full p-2 border rounded transition-colors duration-200 bg-white ${errors[field] ? "border-red-500" : "border-gray-300"}`;

  return (
    <form onSubmit={handleSubmit} className="mt-2 p-4 border rounded bg-gray-50 relative">
      {errors.general && <div className="bg-red-100 text-red-700 p-2 mb-2 rounded text-sm font-medium">{errors.general}</div>}
      <div>
        <label className="block text-sm font-medium mb-1">Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass("date")} />
      </div>
      <div className="mt-2">
        <label className="block text-sm font-medium mb-1">Start Time</label>
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass("start_time")} min="08:00" max="18:00" />
      </div>
      <div className="mt-2">
        <label className="block text-sm font-medium mb-1">End Time</label>
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass("end_time")} min="08:00" max="18:00" />
      </div>
      <button type="submit" disabled={loading} className="mt-4 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-gray-400">
        {loading ? "Booking..." : "Book Now"}
      </button>
    </form>
  );
}
