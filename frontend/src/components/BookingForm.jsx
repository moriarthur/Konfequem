import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function BookingForm({ roomId, onBookingCreated }) {
  const { authFetch } = useAuth();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [errorMessages, setErrorMessages] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessages([]); // clear errors before new attempt

    try {
      const response = await authFetch("/api/bookings/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId, start, end }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const collectedErrors = [];

        if (errorData.non_field_errors) {
          collectedErrors.push(...errorData.non_field_errors);
        }
        Object.keys(errorData).forEach((key) => {
          if (key !== "non_field_errors") {
            collectedErrors.push(`${key}: ${errorData[key].join(", ")}`);
          }
        });

        setErrorMessages(collectedErrors);
        return;
      }

      const newBooking = await response.json();
      onBookingCreated(newBooking);
      setStart("");
      setEnd("");
    } catch (err) {
      setErrorMessages(["Unexpected error. Please try again."]);
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
