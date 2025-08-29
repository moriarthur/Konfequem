import React from "react";
import BookingForm from "./BookingForm";

export default function RoomCard({ room, isActive, onToggleBookingForm, onBook, errors, success }) {
  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h3 className="text-xl font-bold mb-2">{room.name}</h3>
      <p className="text-gray-600">Location: {room.location}</p>
      <p className="text-gray-600 mb-4">Capacity: {room.capacity}</p>

      <button
        onClick={() => onToggleBookingForm(room.id)}
        className={`px-4 py-2 rounded hover:bg-opacity-90 ${
          isActive ? "bg-red-600 text-white hover:bg-red-700" : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {isActive ? "Cancel booking" : "Book this room"}
      </button>

      {/* Success message lives in the card, auto-hidden by parent */}
      {success && (
        <p className="mt-3 text-green-600 font-semibold">Booking successful!</p>
      )}

      {isActive && (
        <div className="mt-4 border-t pt-4 transition-all duration-300">
          <BookingForm
            roomId={room.id}
            onSuccess={onBook}
            errorsFromParent={errors}
          />
        </div>
      )}
    </div>
  );
}
