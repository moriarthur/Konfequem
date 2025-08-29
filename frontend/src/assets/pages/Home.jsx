import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import BookingList from "../../components/BookingList";
import RoomList from "../../components/RoomList";

export default function Home() {
  const { authFetch, logout, isAuthenticated, loading, user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [successAlert, setSuccessAlert] = useState(null);

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
        console.error("Error fetching data:", err);
      }
    };

    fetchData();
  }, [authFetch, isAuthenticated]);

  const handleBookingSubmit = async ({ room, start_time, end_time }) => {
    setFormErrors({});
    try {
      const newBooking = await authFetch("/api/bookings/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room, start_time, end_time }),
      });

      setBookings((prev) => [...prev, newBooking]);
      setActiveRoomId(null);

      // Show full-page success alert
      setSuccessAlert(`Booking successful for room!`);
      setTimeout(() => setSuccessAlert(null), 5000);

      return true;
    } catch (err) {
      const errors = {};
      if (err.start_time) errors.start_time = Array.isArray(err.start_time) ? err.start_time.join(" ") : err.start_time;
      if (err.end_time) errors.end_time = Array.isArray(err.end_time) ? err.end_time.join(" ") : err.end_time;
      if (err.detail) errors.detail = err.detail;
      setFormErrors(errors);
      return false;
    }
  };

  const handleToggleBookingForm = (roomId) => {
    setFormErrors({});
    setActiveRoomId((prev) => (prev === roomId ? null : roomId));
  };

  return (
    <div className="min-h-screen bg-gray-100 px-6 py-12 relative">
      {loading && <p className="text-center mt-20 text-gray-600">Loading...</p>}

      {successAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-green-500 text-white px-8 py-4 rounded-lg text-lg font-semibold">
            {successAlert}
          </div>
        </div>
      )}

      {!loading && (
        <>
          <header className="flex justify-between items-center mb-6">
            <h1 className="text-4xl font-bold text-gray-900">
              Welcome{user ? `, ${user.username}` : ""} 👋
            </h1>
            {isAuthenticated && (
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Logout
              </button>
            )}
          </header>

          <p className="text-lg text-gray-600 mb-4">Manage your rooms and bookings</p>

          {isAuthenticated ? (
            <>
              <RoomList
                rooms={rooms}
                activeRoomId={activeRoomId}
                onToggleBookingForm={handleToggleBookingForm}
                onBook={handleBookingSubmit}
                formErrors={formErrors}
              />

              <section className="mt-12">
                <h2 className="text-2xl font-semibold mb-2">Your Bookings</h2>
                {bookings.length > 0 ? (
                  <BookingList bookings={bookings} />
                ) : (
                  <p className="text-gray-600">No bookings found.</p>
                )}
              </section>
            </>
          ) : (
            <p className="text-center text-gray-600">Please log in to see rooms and bookings.</p>
          )}
        </>
      )}
    </div>
  );
}
