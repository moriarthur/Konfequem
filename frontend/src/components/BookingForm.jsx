import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function BookingForm({ roomId, onBookingCreated }) {
  const { authFetch } = useAuth();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [errorMessages, setErrorMessages] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessages([]); // clear previous errors

    try {
      const newBooking = await authFetch("/api/bookings/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId, start_time: start, end_time: end }),
      });

      if (onBookingCreated) onBookingCreated(newBooking);

      setStart("");
      setEnd("");
    } catch (err) {
      const collectedErrors = [];

      // DRF serializer 'general' errors
      if (err.general) collectedErrors.push(...err.general);

      // Field-specific errors
      ["start_time", "end_time", "room", "user", "non_field_errors"].forEach((key) => {
        if (err[key]) {
          collectedErrors.push(
            `${key}: ${Array.isArray(err[key]) ? err[key].join(", ") : err[key]}`
          );
        }
      });

      // Fallback for unknown errors
      if (collectedErrors.length === 0) {
        collectedErrors.push(err.message || "Unexpected error. Please try again.");
      }

      setErrorMessages(collectedErrors);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded shadow">
      {/* Global error block */}
      {errorMessages.length > 0 && (
        <div className="bg-red-500 text-white p-2 rounded mb-4">
          {errorMessages.map((msg, i) => (
            <p key={i}>{msg}</p>
          ))}
        </div>
      )}

      <div className="mb-2">
        <label className="block">Start:</label>
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="border p-1 w-full"
          required
        />
      </div>

      <div className="mb-2">
        <label className="block">End:</label>
        <input
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="border p-1 w-full"
          required
        />
      </div>

      <button
        type="submit"
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Book
      </button>
    </form>
  );
}
