export default function RoomList({ rooms }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
        Available Rooms
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="bg-white rounded-2xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-xl font-semibold text-blue-600 mb-2">
              {room.name}
            </h3>
            <p className="text-gray-700">
              <span className="font-medium">Capacity:</span> {room.capacity}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Location:</span> {room.location}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
