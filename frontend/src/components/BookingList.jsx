import React from "react";
import { DateTime } from "luxon";

// BookingList is a controlled component — it renders directly from the `bookings` prop
// and does not keep its own copy. This ensures it always reflects the parent state.
export default function BookingList({ bookings = [] }) {
  // Format time exactly as on the server (no timezone shift)
  const formatTime = (isoString) =>
    DateTime.fromISO(isoString, { zone: "utc" }).toFormat("HH:mm");
  const formatDate = (isoString) =>
    DateTime.fromISO(isoString, { zone: "utc" }).toFormat("dd.MM.yyyy");

  if (!bookings || bookings.length === 0) {
    return <p className="text-gray-500">No bookings found.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-semibold text-center mb-4">Bookings</h2>
      {bookings.map((booking) => (
        <div key={booking.id} className="p-4 border rounded bg-white">
          <p>
            <strong>Room:</strong> {booking.room_name}
          </p>
          <p>
            <strong>Date:</strong> {formatDate(booking.start_time)}
          </p>
          <p>
            <strong>Start:</strong> {formatTime(booking.start_time)}
          </p>
          <p>
            <strong>End:</strong> {formatTime(booking.end_time)}
          </p>
        </div>
      ))}
    </div>
  );
}
