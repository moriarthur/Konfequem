import React, { useMemo, useState } from "react";
import BookingForm from "./BookingForm.jsx";
import { ChevronDownIcon, FunnelIcon } from "@heroicons/react/24/outline";
import { BuildingOfficeIcon, ClockIcon } from "@heroicons/react/24/outline";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Badge from "./ui/Badge";
import { Heading, Text, Subheading } from "./ui/Typography";
import EmptyState from "./ui/EmptyState";

export default function RoomList({ rooms, onBook }) {
  const [expandedRoom, setExpandedRoom] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [minCapacity, setMinCapacity] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("popularity");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  if (!rooms) {
    return (
      <EmptyState
        icon={<BuildingOfficeIcon />}
        title="Loading rooms..."
        description="Please wait while we fetch available rooms."
      />
    );
  }

  const uniqueLocations = useMemo(() => {
    const set = new Set();
    rooms.forEach((room) => {
      if (room.location) set.add(room.location);
    });
    return Array.from(set).sort();
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    let list = [...rooms];
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter((room) => room.name?.toLowerCase().includes(term));
    }
    if (minCapacity !== "all") {
      const cap = Number(minCapacity);
      list = list.filter((room) => Number(room.capacity || 0) >= cap);
    }
    if (locationFilter !== "all") {
      list = list.filter((room) => room.location === locationFilter);
    }

    list.sort((a, b) => {
      if (sortBy === "capacity") {
        return (b.capacity || 0) - (a.capacity || 0);
      }
      if (sortBy === "name") {
        return (a.name || "").localeCompare(b.name || "");
      }
      // popularity
      return (b.bookings?.length || 0) - (a.bookings?.length || 0);
    });

    return list;
  }, [rooms, searchTerm, minCapacity, locationFilter, sortBy]);

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
        <>
          <div className="mb-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-accent-secondary/60 block mb-2 pl-1">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Room name"
                className="w-full rounded-2xl border border-border-subtle bg-surface-base px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-accent-secondary/60 block mb-2 pl-1">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-2xl border border-border-subtle bg-surface-base px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
              >
                <option value="popularity">Popularity</option>
                <option value="capacity">Capacity</option>
                <option value="name">Name</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
                className={`w-full rounded-2xl border px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 transition ${
                  showAdvancedFilters
                    ? "border-accent-primary/60 text-accent-primary bg-accent-primary/10"
                    : "border-border-subtle text-accent-secondary/80 hover:border-border-soft"
                }`}
                aria-expanded={showAdvancedFilters}
              >
                <FunnelIcon className="w-4 h-4" /> Filters
              </button>
            </div>
          </div>

          <div
            className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 transition-[max-height,opacity,margin] duration-300 overflow-hidden ${
              showAdvancedFilters ? "max-h-[320px] opacity-100 mb-6" : "max-h-0 opacity-0 mb-0"}
          `}
          >
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-accent-secondary/60 block mb-2 pl-1">Min capacity</label>
              <select
                value={minCapacity}
                onChange={(e) => setMinCapacity(e.target.value)}
                className="w-full rounded-2xl border border-border-subtle bg-surface-base px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
              >
                <option value="all">Any size</option>
                <option value="4">4+</option>
                <option value="8">8+</option>
                <option value="12">12+</option>
                <option value="20">20+</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-accent-secondary/60 block mb-2 pl-1">Location</label>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full rounded-2xl border border-border-subtle bg-surface-base px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
              >
                <option value="all">All locations</option>
                {uniqueLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setMinCapacity("all");
                  setLocationFilter("all");
                  setSearchTerm("");
                  setSortBy("popularity");
                }}
                className="w-full rounded-2xl border border-border-subtle px-4 py-2 text-sm text-accent-secondary/70 hover:border-border-soft"
              >
                Reset filters
              </button>
            </div>
          </div>

          {filteredRooms.length === 0 ? (
            <EmptyState
              icon={<BuildingOfficeIcon />}
              title="No rooms match your filters"
              description="Try adjusting capacity or search query."
            />
          ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredRooms.map((room) => (
              <Card
                key={room.id}
                hover={true}
                className="w-full border border-border-subtle/80 transition-shadow hover:border-accent-primary/40 focus-within:ring-2 focus-within:ring-accent-primary/30"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <Subheading className="text-lg mb-2">
                      {room.name}
                    </Subheading>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <BuildingOfficeIcon className="w-4 h-4 text-accent-secondary/50" />
                        <Text variant="default">
                          Capacity: {room.capacity} people
                        </Text>
                      </div>
                      {room.location && (
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-accent-secondary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                </div>

                {room.bookings && room.bookings.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border-subtle">
                    <div className="flex items-center gap-2 mb-3">
                      <ClockIcon className="w-4 h-4 text-accent-secondary/50" />
                      <Text variant="small" className="font-medium text-accent-secondary">
                        Current bookings ({room.bookings.length})
                      </Text>
                    </div>
                    <div className="space-y-2">
                      {room.bookings.slice(0, 3).map((b, idx) => {
                        const start = new Date(b.start_time);
                        const end = new Date(b.end_time);
                        return (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <Text variant="small" className="text-accent-secondary/80">
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
                        <Text variant="small" className="text-accent-secondary/60 italic">
                          +{room.bookings.length - 3} more booking{room.bookings.length - 3 > 1 ? 's' : ''}
                        </Text>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => setExpandedRoom(room.id)}
                    aria-label={`View details for ${room.name}`}
                    className="inline-flex items-center gap-2"
                  >
                    View details
                    <ChevronDownIcon
                      className={`w-4 h-4 transition-transform duration-300 ${expandedRoom === room.id ? "-rotate-90" : "rotate-0"}`}
                      aria-hidden="true"
                    />
                  </Button>
                </div>
              </Card>
          ))}
        </div>
          )}
        </>
      )}
    </div>
  );
}
