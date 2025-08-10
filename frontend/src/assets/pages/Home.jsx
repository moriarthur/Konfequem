import { useEffect, useState } from "react";
import RoomList from "../../components/RoomList";
import BookingList from "../../components/BookingList";
import BookingForm from "../../components/BookingForm";
import { useAuth } from "../../context/AuthContext";

export default function Home() {
  const { authFetch, logout, isAuthenticated } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  const mockUser = {
    id: 1,
    name: "Artur",
    email: "artur@example.com",
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setRooms([]);
      setBookings([]);
      return;
    }

    // Fetch rooms with authFetch, which returns parsed JSON directly
    authFetch("/api/rooms/")
      .then(setRooms)
      .catch((err) => console.error("Room fetch error:", err));

    // Fetch bookings with authFetch
    authFetch("/api/bookings/")
      .then(setBookings)
      .catch((err) => console.error("Booking fetch error:", err));
  }, [isAuthenticated, authFetch]);

  const handleBookingSubmit = async (formData) => {
    const dataToSend = {
      ...formData,
      room: parseInt(formData.room),
      user: mockUser.id,
    };

    try {
      // authFetch throws on HTTP errors, so no need to check res.ok
      const result = await authFetch("/api/bookings/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      // Add new booking to state
      setBookings((prev) => [...prev, result]);
    } catch (err) {
      console.error("Booking error:", err);
      alert("Error: " + JSON.stringify(err));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-6 py-12">
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
          <p className="mb-6 text-gray-700">Logged in as {mockUser.name}</p>
          <RoomList rooms={rooms} />
          <BookingForm rooms={rooms} onBookingSubmit={handleBookingSubmit} />
          <BookingList bookings={bookings} currentUser={mockUser} />
        </>
      ) : (
        <p className="text-center text-gray-600">Please log in to see rooms and bookings.</p>
      )}
    </div>
  );
}
