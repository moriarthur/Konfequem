import React from "react";
import RoomCard from "./RoomCard";

export default function RoomList({ rooms, onBook }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Available Rooms</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} onBook={onBook} />
        ))}
      </div>
    </div>
  );
}
