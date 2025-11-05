import React, { useState, useEffect } from "react";
import { DateTime } from "luxon";

export default function BookingList({ bookings: initialBookings }) {
  const [bookings, setBookings] = useState(initialBookings || []);

  // Listen for new bookings via custom event
  useEffect(() => {
    const handler = (e) => {
      const newBooking = e.detail.booking;
      setBookings((prev) => [...prev, newBooking]);
    };
    window.addEventListener("konfequem:bookingCreated", handler);
    return () => window.removeEventListener("konfequem:bookingCreated", handler);
  }, []);

  // Format time exactly as on the server (no timezone shift)
  const formatTime = (isoString) => {
    return DateTime.fromISO(isoString, { zone: "utc" }).toFormat("HH:mm");
  };

  if (!bookings || bookings.length === 0) {
    return <p className="text-gray-500">No bookings found.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-semibold text-center mb-4">Bookings</h2>
      {bookings.map((booking) => (
        <div key={booking.id} className="p-4 border rounded bg-white">
          <p><strong>Room:</strong> {booking.room_name}</p>
          <p><strong>Start:</strong> {formatTime(booking.start_time)}</p>
          <p><strong>End:</strong> {formatTime(booking.end_time)}</p>
        </div>
      ))}
    </div>
  );
}
