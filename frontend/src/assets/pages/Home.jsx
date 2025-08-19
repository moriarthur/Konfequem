import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import BookingList from "../../components/BookingList";
import RoomList from "../../components/RoomList";

export default function Home() {
  const { authFetch, logout, isAuthenticated, loading } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  // Хуки всегда вызываем сверху
  useEffect(() => {
    if (!isAuthenticated) {
      setRooms([]);
      setBookings([]);
      return;
    }

    const fetchData = async () => {
      try {
        const roomsData = await authFetch("/api/rooms/");
        setRooms(roomsData);

        const bookingsData = await authFetch("/api/bookings/");
        setBookings(bookingsData);
      } catch (err) {
        console.error(err);
      }
    };

    fetchData();
  }, [authFetch, isAuthenticated]);

  const handleBookingSubmit = async ({ room, start_time, end_time }) => {
    try {
      const newBooking = await authFetch("/api/bookings/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room, start_time, end_time }),
      });
      setBookings((prev) => [...prev, newBooking]);
    } catch (err) {
      console.error(err);
      alert("Booking error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-6 py-12">
      {loading ? (
        <p className="text-center mt-20 text-gray-600">Loading...</p>
      ) : (
        <>
          <header className="flex justify-between items-center mb-6">
            <h1 className="text-4xl font-bold text-gray-900">Welcome to Konfequem</h1>
            {isAuthenticated && (
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Logout
              </button>
            )}
          </header>

          {isAuthenticated ? (
            <>
              <RoomList rooms={rooms} onBook={handleBookingSubmit} />
              <BookingList bookings={bookings} />
            </>
          ) : (
            <p className="text-center text-gray-600">Please log in to see rooms and bookings.</p>
          )}
        </>
      )}
    </div>
  );
}
