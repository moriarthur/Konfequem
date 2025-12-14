import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BookingForm from "./BookingForm.jsx";
import { FunnelIcon } from "@heroicons/react/24/outline";
import { BuildingOfficeIcon } from "@heroicons/react/24/outline";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { Heading, Text } from "./ui/Typography";
import EmptyState from "./ui/EmptyState";
import RoomCard from "./RoomCard";

export default function RoomList({ rooms, onBook }) {
  const [expandedRoom, setExpandedRoom] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [minCapacity, setMinCapacity] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("popularity");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const bookingFormRef = React.useRef(null);

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

  // Smooth scroll to booking form when it opens
  React.useEffect(() => {
    if (expandedRoom && bookingFormRef.current) {
      // Small delay to ensure the form is rendered
      const timeoutId = setTimeout(() => {
        bookingFormRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [expandedRoom]);

  // Animation variants for booking form
  const bookingFormVariants = {
    hidden: {
      opacity: 0,
      scale: 0.95,
      y: -20,
      filter: "blur(2px)"
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    },
    exit: {
      opacity: 0,
      scale: 0.98,
      y: -10,
      filter: "blur(1px)",
      transition: {
        duration: 0.2,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className="relative">
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
                <FunnelIcon className="w-4 h-4 -ml-1" /> Filters
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  isActive={expandedRoom === room.id}
                  onToggleBookingForm={(roomId) => setExpandedRoom(expandedRoom === roomId ? null : roomId)}
                  onBook={onBook}
                />
              ))}
            </div>
          )}

          {/* Expanded booking form below the grid */}
          <AnimatePresence mode="wait">
            {expandedRoom && (
              <motion.div
                ref={bookingFormRef}
                className="mt-8 scroll-mt-20"
                variants={bookingFormVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {(() => {
                  const selectedRoom = rooms.find((r) => r.id === expandedRoom);
                  return selectedRoom ? (
                    <Card className="p-6 max-w-2xl mx-auto">
                      <div className="flex justify-between items-center mb-4">
                        <Heading level={3} className="text-xl">
                          Book {selectedRoom.name}
                        </Heading>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setExpandedRoom(null)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </Button>
                      </div>
                      <div className="flex gap-4 mb-6 text-sm">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-accent-secondary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <Text variant="muted">
                            {selectedRoom.location || "No location"}
                          </Text>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-accent-secondary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <Text variant="muted">
                            {selectedRoom.capacity} people
                          </Text>
                        </div>
                      </div>
                      <BookingForm
                        roomId={expandedRoom}
                        onBookingCreated={(newBooking) => {
                          if (onBook) onBook(newBooking);
                          // Reduced delay for faster closing
                          setTimeout(() => {
                            setExpandedRoom(null);
                          }, 400);
                        }}
                        onClose={() => setExpandedRoom(null)}
                      />
                    </Card>
                  ) : null;
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}