import EmptyState from "./ui/EmptyState";
import RoomCard from "./RoomCard";
import type { BookingData } from "../utils/bookingUtils";

const BuildingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 22L2 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M17 22V6C17 4.11438 17 3.17157 16.4142 2.58579C15.8284 2 14.8856 2 13 2H11C9.11438 2 8.17157 2 7.58579 2.58579C7 3.17157 7 4.11438 7 6V22" stroke="currentColor" strokeWidth="1.5" />
    <path d="M21 22V11.5C21 10.0955 21 9.39331 20.6629 8.88886C20.517 8.67048 20.3295 8.48298 20.1111 8.33706C19.6067 8 18.9045 8 17.5 8" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 22V11.5C3 10.0955 3 9.39331 3.33706 8.88886C3.48298 8.67048 3.67048 8.48298 3.88886 8.33706C4.39331 8 5.09554 8 6.5 8" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 22V19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M10 5H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M10 8H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M10 11H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M10 14H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

interface Room {
  id: number;
  name: string;
  location?: string;
  capacity: number;
  features?: { id: number; name: string; icon: string }[];
}

interface RoomListProps {
  rooms: Room[] | null;
  bookings?: BookingData[];
  activeRoomId?: number | null;
  onToggleBookingForm: (roomId: number) => void;
  isAdmin?: boolean;
  onEditRoom?: (room: Room) => void;
  onDeleteRoom?: (room: Room) => void;
}

export default function RoomList({
  rooms,
  bookings = [],
  activeRoomId = null,
  onToggleBookingForm,
  isAdmin = false,
  onEditRoom,
  onDeleteRoom,
}: RoomListProps) {
  if (!rooms) {
    return <EmptyState icon={<BuildingIcon />} title="Loading rooms..." description="Please wait while we fetch available rooms." />;
  }

  if (rooms.length === 0) {
    return <EmptyState icon={<BuildingIcon />} title="No rooms available" description="There are no rooms configured in the system." />;
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
          isAdmin={isAdmin}
          onEditRoom={onEditRoom}
          onDeleteRoom={onDeleteRoom}
        />
      ))}
    </div>
  );
}
