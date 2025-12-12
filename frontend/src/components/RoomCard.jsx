import React from "react";
import Card from "./ui/Card";
import { Heading, Text } from "./ui/Typography";
import Button from "./ui/Button";

export default function RoomCard({
  room,
  isActive,
  onToggleBookingForm,
  onBook,
}) {
  return (
    <Card className="relative h-full flex flex-col">
      {/* Status indicator */}
      {isActive && (
        <div className="absolute top-4 right-4 z-10">
          <div className="px-2.5 py-1 bg-status-info/10 border border-status-info/20 rounded-full">
            <Text variant="small" className="text-status-info-text font-medium">
              Selected
            </Text>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1">
        <Heading level={3} className="text-xl text-accent-secondary mb-4 pr-16">
          {room.name}
        </Heading>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-accent-secondary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <Text variant="muted" className="text-sm">
              {room.location || "No location"}
            </Text>
          </div>

          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-accent-secondary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <Text variant="muted" className="text-sm">
              {room.capacity} people
            </Text>
          </div>
        </div>

        <Text variant="muted" className="mt-4 mb-6 text-sm leading-relaxed">
          Perfect for meetings and collaborative sessions. This space offers a comfortable environment for productive work.
        </Text>
      </div>

      {/* Action Button */}
      <div className="mt-auto">
        <Button
          variant={isActive ? "danger" : "primary"}
          onClick={() => onToggleBookingForm(room.id)}
          className="w-full"
          size="lg"
        >
          {isActive ? "Cancel" : "Book this room"}
        </Button>
      </div>
    </Card>
  );
}