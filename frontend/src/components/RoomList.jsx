import React, { useEffect, useState } from "react";
import BookingForm from "./BookingForm.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

export default function RoomList() {
  const { authFetch } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [expandedRoom, setExpandedRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const data = await authFetch("/api/rooms/");
        setRooms(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load rooms.");
      } finally {
        setLoading(false);
        setFadeIn(true);
      }
    };
    fetchRooms();
  }, [authFetch]);

  const handleToggle = (roomId) => {
    setExpandedRoom(expandedRoom === roomId ? null : roomId);
  };

  const handleBookingSuccess = (roomId, newBooking) => {
    setRooms((prev) =>
      prev.map((room) => {
        if (room.id === roomId) {
          const updatedBookings = room.bookings
            ? [...room.bookings, newBooking]
            : [newBooking];
          return { ...room, bookings: updatedBookings };
        }
        return room;
      })
    );
    setExpandedRoom(null);
  };

  if (loading) return <p>Loading rooms...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="relative">
      {/* Modal Overlay */}
      {expandedRoom && (
        <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setExpandedRoom(null)}
            aria-hidden="true"
          />
          {/* Modal Box */}
          <div
            className="relative z-60 w-full max-w-lg mx-auto mt-12 md:mt-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl shadow-xl p-4 max-h-[90vh] overflow-auto animate-fadeIn">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">
                  {rooms.find((r) => r.id === expandedRoom)?.name}
                </h3>
                <button
                  className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 transition"
                  onClick={() => setExpandedRoom(null)}
                >
                  Close
                </button>
              </div>

              <BookingForm
                roomId={expandedRoom}
                onSuccess={handleBookingSuccess}
              />
            </div>
          </div>
        </div>
      )}

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rooms.map((room, index) => (
          <div
            key={room.id}
            onClick={() => handleToggle(room.id)}
            className={`relative p-4 bg-white rounded-2xl shadow-sm border border-gray-200 transform transition-all duration-300 ease-in-out cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:bg-gray-50 ${
              fadeIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
            style={{ transitionDelay: `${index * 50}ms` }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleToggle(room.id);
            }}
          >
            {/* Card Header */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-lg">{room.name}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Capacity: {room.capacity}
                </p>
                {room.location && (
                  <p className="text-sm text-gray-600">
                    Location: {room.location}
                  </p>
                )}
              </div>
              <ChevronDownIcon
                className={`w-6 h-6 text-gray-500 transform transition-transform duration-300 ${
                  expandedRoom === room.id ? "rotate-180" : ""
                }`}
              />
            </div>

            {/* Bookings List */}
            {room.bookings && room.bookings.length > 0 && (
              <ul className="mt-2 space-y-1">
                {room.bookings.map((b, idx) => (
                  <li key={idx} className="text-sm text-gray-700">
                    {new Date(b.start_time).toLocaleString()} –{" "}
                    {new Date(b.end_time).toLocaleTimeString()}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
