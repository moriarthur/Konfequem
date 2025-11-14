import React, { useState } from "react";
import BookingForm from "./BookingForm.jsx";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

export default function RoomList({ rooms, onBook }) {
  const [expandedRoom, setExpandedRoom] = useState(null);
  const [fadeIn] = useState(true);

  if (!rooms) return <p>Loading rooms...</p>;

  return (
    <div className="relative">
      {expandedRoom && (
        <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setExpandedRoom(null)}
            aria-hidden="true"
          />
          <div
            className="relative z-60 w-full max-w-lg mx-auto mt-12 md:mt-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl shadow-xl p-4 max-h-[90vh] overflow-y-auto animate-fadeIn">
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
                onBookingCreated={(newBooking) => {
                  if (onBook) onBook(newBooking); // forward to Home
                  setExpandedRoom(null);
                }}
                onClose={() => setExpandedRoom(null)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rooms.map((room) => (
          <div
            key={room.id}
            onClick={() => setExpandedRoom(room.id)}
            className={`relative p-4 bg-white rounded-2xl shadow-sm border border-gray-200 transform transition-all duration-300 ease-in-out cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:bg-gray-50 ${
              fadeIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-lg">{room.name}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Capacity: {room.capacity}
                </p>
                {room.location && (
                  <p className="text-sm text-gray-600">Location: {room.location}</p>
                )}
              </div>
              <ChevronDownIcon
                className={`w-6 h-6 text-gray-500 transform transition-transform duration-300 ${
                  expandedRoom === room.id ? "rotate-180" : ""
                }`}
              />
            </div>

            {room.bookings && room.bookings.length > 0 && (
              <ul className="mt-2 space-y-1">
                {room.bookings.map((b, idx) => {
                  const start = new Date(b.start_time);
                  const end = new Date(b.end_time);
                  return (
                    <li key={idx} className="text-sm text-gray-700">
                      {start.toLocaleDateString()}{" "}
                      {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                      {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
