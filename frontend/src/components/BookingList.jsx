import React, { useState, useEffect } from "react";

export default function BookingList({ bookings: initialBookings }) {
  const [bookings, setBookings] = useState(initialBookings || []);

  useEffect(() => {
    const handler = (e) => {
      const newBooking = e.detail.booking;
      setBookings((prev) => [...prev, newBooking]);
    };

    window.addEventListener("konfequem:bookingCreated", handler);
    return () => window.removeEventListener("konfequem:bookingCreated", handler);
  }, []);

  if (!bookings || bookings.length === 0) {
    return <p className="text-gray-500">No bookings found.</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-semibold text-center mb-4">Bookings</h2>
      {bookings.map((booking) => (
        <div key={booking.id} className="p-4 border rounded bg-white">
          <p><strong>Room:</strong> {booking.room_name}</p>
          <p><strong>Start:</strong> {new Date(booking.start_time).toLocaleString()}</p>
          <p><strong>End:</strong> {new Date(booking.end_time).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
