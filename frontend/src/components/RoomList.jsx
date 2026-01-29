import React from "react";
import { BuildingOfficeIcon } from "@heroicons/react/24/outline";
import EmptyState from "./ui/EmptyState";
import RoomCard from "./RoomCard";

/**
 * Simplified RoomList - displays room cards in a grid
 * Filters and booking form are handled by the parent component
 */
export default function RoomList({
  rooms,
  bookings = [],
  activeRoomId = null,
  onToggleBookingForm,
}) {
  if (!rooms) {
    return (
      <EmptyState
        icon={<BuildingOfficeIcon />}
        title="Loading rooms..."
        description="Please wait while we fetch available rooms."
      />
    );
  }

  if (rooms.length === 0) {
    return (
      <EmptyState
        icon={<BuildingOfficeIcon />}
        title="No rooms available"
        description="There are no rooms configured in the system."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {rooms.map((room) => (
        <RoomCard
          key={room.id}
          room={room}
          isActive={activeRoomId === room.id}
          onToggleBookingForm={onToggleBookingForm}
          bookings={bookings}
        />
      ))}
    </div>
  );
}
