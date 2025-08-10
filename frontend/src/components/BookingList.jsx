import { useEffect, useState } from "react";
import { authFetch } from '../api';

export default function BookingList() {
  const [bookings, setBookings] = useState([]);

useEffect(() => {
  authFetch("http://localhost:8000/api/bookings/")
    .then((data) => setBookings(data))
    .catch((error) => console.error("Error fetching bookings:", error));
}, []);

  return (
    <div>
      <h2 className="text-3xl font-semibold text-center mb-6">Bookings</h2>
      {bookings.length === 0 ? (
        <p>No bookings found.</p>
      ) : (
        <ul className="space-y-4">
          {bookings.map((booking) => (
            <li key={booking.id} className="border p-4 rounded-md">
              <p><strong>Room ID:</strong> {booking.room}</p>
              <p><strong>User ID:</strong> {booking.user}</p>
              <p><strong>Start:</strong> {new Date(booking.start_time).toLocaleString()}</p>
              <p><strong>End:</strong> {new Date(booking.end_time).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
