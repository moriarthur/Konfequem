import { useEffect, useState } from "react";
import RoomList from "../../components/RoomList";
import BookingList from "../../components/BookingList";
import BookingForm from "../../components/BookingForm";

export default function Home() {
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  const mockUser = {
    id: 1,
    name: "Artur",
    email: "artur@example.com",
  };

  // Получение комнат и бронирований при загрузке
  useEffect(() => {
    fetch("/api/rooms/")
      .then((res) => res.json())
      .then(setRooms)
      .catch((err) => console.error("Room fetch error:", err));

    fetch("/api/bookings/")
      .then((res) => res.json())
      .then(setBookings)
      .catch((err) => console.error("Booking fetch error:", err));
  }, []);

  // Обработка создания нового бронирования
  const handleBookingSubmit = async (formData) => {
    const dataToSend = {
      ...formData,
      room: parseInt(formData.room),
      user: mockUser.id,
    };

    try {
      const res = await fetch("/api/bookings/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSend),
      });

      const result = await res.json();
      console.log("Booking result:", result);

      if (!res.ok) {
        alert("Error: " + JSON.stringify(result));
        return;
      }

      setBookings((prev) => [...prev, result]);
    } catch (err) {
      console.error("Booking error:", err);
      alert("Network error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-6 py-12">
      <h1 className="text-4xl font-bold text-center text-gray-900 mb-12">
        Welcome to Konfequem
      </h1>

      <RoomList rooms={rooms} />
      <BookingForm rooms={rooms} onBookingSubmit={handleBookingSubmit} />
      <BookingList bookings={bookings} currentUser={mockUser} />
    </div>
  );
}
