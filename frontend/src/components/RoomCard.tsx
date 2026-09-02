import Card from "./ui/Card";
import { Heading, Text } from "./ui/Typography";
import Button from "./ui/Button";
import RoomMiniAvailability from "./RoomMiniAvailability";
import { RoomFeatureBadges } from "./RoomFeatureBadges";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import type { BookingData } from "../utils/bookingUtils";

interface Room {
  id: number;
  name: string;
  location?: string;
  capacity: number;
  features?: { id: number; name: string; icon: string }[];
}

interface RoomCardProps {
  room: Room;
  isActive: boolean;
  onToggleBookingForm: (roomId: number) => void;
  bookings?: BookingData[];
  isAdmin?: boolean;
  onEditRoom?: (room: Room) => void;
  onDeleteRoom?: (room: Room) => void;
}

export default function RoomCard({
  room,
  isActive,
  onToggleBookingForm,
  bookings = [],
  isAdmin = false,
  onEditRoom,
  onDeleteRoom,
}: RoomCardProps) {
  return (
    <Card padding="" className="relative h-full flex flex-col">
      {isActive && (
        <div className="absolute top-4 right-4 z-10">
          <div className="px-2.5 py-1 bg-accent-primary/10 border border-accent-primary/20 rounded-full">
            <Text variant="small" className="text-accent-primary font-medium">
              Selected
            </Text>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col p-5">
        <Heading level={3} className="text-lg font-semibold text-accent-secondary mb-3 pr-10">
          {room.name}
        </Heading>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-accent-secondary/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <Text variant="muted" className="text-sm">
              {room.location || "No location"}
            </Text>
          </div>

          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-accent-secondary/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <Text variant="muted" className="text-sm">
              {room.capacity} people
            </Text>
          </div>
        </div>

        {room.features && room.features.length > 0 && (
          <div className="mb-4">
            <RoomFeatureBadges features={room.features} showLabels={false} />
          </div>
        )}

        <div className="mt-auto">
          <RoomMiniAvailability bookings={bookings} roomId={room.id} />
        </div>
      </div>

      <div className="border-t border-border-subtle p-4">
        <div className="flex items-center gap-2">
          <Button
            variant={isActive ? "danger" : "primary"}
            onClick={() => onToggleBookingForm(room.id)}
            className="flex-1"
            size="lg"
          >
            {isActive ? "Cancel" : "Book this room"}
          </Button>
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEditRoom?.(room)}
                aria-label={`Edit room ${room.name}`}
                title={`Edit room ${room.name}`}
                className="self-stretch border border-border-subtle hover:border-accent-primary/40 hover:text-accent-primary"
              >
                <FiEdit2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteRoom?.(room)}
                aria-label={`Delete room ${room.name}`}
                title={`Delete room ${room.name}`}
                className="self-stretch border border-border-subtle hover:border-status-danger-border hover:text-status-danger-text"
              >
                <FiTrash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
