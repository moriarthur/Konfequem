import React from "react";
import RoomCard from "./RoomCard";

export default function RoomList({ rooms, activeRoomId, onToggleBookingForm, onBook, formErrors, successByRoom = {} }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Available Rooms</h2>
      {/* Prevent stretching of sibling cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
        {rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            isActive={activeRoomId === room.id}
            onToggleBookingForm={onToggleBookingForm}
            onBook={onBook}
            errors={formErrors[room.id] || {}}
            success={!!successByRoom[room.id]} // show green message per room
          />
        ))}
      </div>
    </div>
  );
}
