import React, { useState } from "react";
import BookingForm from "./BookingForm.jsx";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { BuildingOfficeIcon, ClockIcon } from "@heroicons/react/24/outline";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Badge from "./ui/Badge";
import { Heading, Text, Subheading } from "./ui/Typography";
import EmptyState from "./ui/EmptyState";

export default function RoomList({ rooms, onBook }) {
  const [expandedRoom, setExpandedRoom] = useState(null);
  const [fadeIn] = useState(true);

  if (!rooms) {
    return (
      <EmptyState
        icon={<BuildingOfficeIcon />}
        title="Loading rooms..."
        description="Please wait while we fetch available rooms."
      />
    );
  }

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
            <Card className="max-h-[90vh] overflow-y-auto animate-fadeIn p-6">
              <div className="flex justify-between items-center mb-4">
                <Heading level={3} className="text-lg">
                  {rooms.find((r) => r.id === expandedRoom)?.name}
                </Heading>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setExpandedRoom(null)}
                >
                  Close
                </Button>
              </div>
              <BookingForm
                roomId={expandedRoom}
                onBookingCreated={(newBooking) => {
                  if (onBook) onBook(newBooking); // forward to Home
                  setExpandedRoom(null);
                }}
                onClose={() => setExpandedRoom(null)}
              />
            </Card>
          </div>
        </div>
      )}

      {rooms.length === 0 ? (
        <EmptyState
          icon={<BuildingOfficeIcon />}
          title="No rooms available"
          description="There are no rooms configured in the system."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="cursor-pointer"
              onClick={() => setExpandedRoom(room.id)}
            >
              <Card
                hover={true}
                className="w-full"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <Subheading className="text-lg mb-2">
                      {room.name}
                    </Subheading>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <BuildingOfficeIcon className="w-4 h-4 text-gray-400" />
                        <Text variant="default">
                          Capacity: {room.capacity} people
                        </Text>
                      </div>
                      {room.location && (
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <Text variant="default">
                            {room.location}
                          </Text>
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronDownIcon
                    className={`w-6 h-6 text-gray-500 transform transition-transform duration-300 flex-shrink-0 ml-4 ${
                      expandedRoom === room.id ? "rotate-180" : ""
                    }`}
                  />
                </div>

                {room.bookings && room.bookings.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                      <ClockIcon className="w-4 h-4 text-gray-400" />
                      <Text variant="small" className="font-medium text-gray-700">
                        Current bookings ({room.bookings.length})
                      </Text>
                    </div>
                    <div className="space-y-2">
                      {room.bookings.slice(0, 3).map((b, idx) => {
                        const start = new Date(b.start_time);
                        const end = new Date(b.end_time);
                        return (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <Text variant="small" className="text-gray-600">
                              {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                              {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </Text>
                            <Badge variant="gray" size="sm">
                              {start.toLocaleDateString()}
                            </Badge>
                          </div>
                        );
                      })}
                      {room.bookings.length > 3 && (
                        <Text variant="small" className="text-gray-500 italic">
                          +{room.bookings.length - 3} more booking{room.bookings.length - 3 > 1 ? 's' : ''}
                        </Text>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
