import React, { useState } from "react";

export default function RoomCard({ room, onBook }) {
  const [showModal, setShowModal] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const handleSubmit = () => {
    onBook({
      room: room.id,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
    });
    setShowModal(false);
  };

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h3 className="text-xl font-bold mb-2">{room.name}</h3>
      <p className="text-gray-600">Location: {room.location}</p>
      <p className="text-gray-600 mb-4">Capacity: {room.capacity}</p>
      <button
        onClick={() => setShowModal(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Book this room
      </button>

      {showModal && (
        <div className="mt-4 border-t pt-4">
          <label className="block mb-2">
            Start time:
            <input
              type="datetime-local"
              className="block w-full border px-2 py-1 rounded mt-1"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="block mb-2">
            End time:
            <input
              type="datetime-local"
              className="block w-full border px-2 py-1 rounded mt-1"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
          <button
            onClick={handleSubmit}
            className="mt-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Confirm Booking
          </button>
        </div>
      )}
    </div>
  );
}
