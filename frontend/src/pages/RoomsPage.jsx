import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { error as logError } from "../utils/logger";
import BottomNav from "../components/BottomNav";
import RoomList from "../components/RoomList";
import RoomFilters from "../components/RoomFilters";
import BookingForm from "../components/BookingForm";
import { Heading, Text } from "../components/ui/Typography";

export default function RoomsPage() {
  const { authFetch, isAuthenticated } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [features, setFeatures] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    capacity: null,
    features: [],
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setRooms([]);
      setFeatures([]);
      setBookings([]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const [roomsData, featuresData, bookingsData] = await Promise.all([
          authFetch("/api/rooms/"),
          authFetch("/api/room-features/"),
          authFetch("/api/bookings/"),
        ]);
        setRooms(roomsData);
        setFeatures(featuresData);
        setBookings(bookingsData);
      } catch (err) {
        logError("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authFetch, isAuthenticated]);

  /**
   * Handle booking creation - refresh bookings and close form
   */
  const handleBookingCreated = async () => {
    try {
      const bookingsData = await authFetch("/api/bookings/");
      setBookings(bookingsData);
      setShowBookingForm(false);
      setSelectedRoomId(null);
    } catch (err) {
      logError("Error refreshing bookings:", err);
    }
  };

  /**
   * Handle filter changes
   */
  const handleFilterChange = (type, value) => {
    if (type === "capacity") {
      setActiveFilters(prev => ({ ...prev, capacity: value }));
    } else if (type === "features") {
      setActiveFilters(prev => ({ ...prev, features: value }));
    } else if (typeof type === "object") {
      // Handle full object update (for clear filters)
      setActiveFilters(type);
    }
  };

  /**
   * Toggle booking form for a room
   */
  const handleToggleBookingForm = (roomId) => {
    if (selectedRoomId === roomId) {
      setShowBookingForm(false);
      setSelectedRoomId(null);
    } else {
      setSelectedRoomId(roomId);
      setShowBookingForm(true);
    }
  };

  /**
   * Filter rooms based on active filters
   */
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      // Capacity filter
      if (activeFilters.capacity !== null && room.capacity < activeFilters.capacity) {
        return false;
      }

      // Features filter - room must have ALL selected features
      if (activeFilters.features.length > 0) {
        const roomFeatureIds = room.features?.map((f) => f.id) || [];
        const hasAllFeatures = activeFilters.features.every((featureId) =>
          roomFeatureIds.includes(featureId)
        );
        if (!hasAllFeatures) return false;
      }

      return true;
    });
  }, [rooms, activeFilters]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center px-4">
        <Text variant="muted" className="text-center">
          Please log in to browse and book rooms.
        </Text>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted pb-20">
      {/* Header */}
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <Heading level={1} className="text-2xl font-semibold text-accent-secondary mb-2">
          Rooms
        </Heading>
        <Text variant="muted" className="mb-6">
          Browse and book available rooms
        </Text>

        {/* Filters */}
        {!loading && features.length > 0 && (
          <div className="mb-6">
            <RoomFilters
              features={features}
              activeFilters={activeFilters}
              onFilterChange={handleFilterChange}
            />
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Text variant="muted">Loading rooms...</Text>
          </div>
        )}

        {/* Room list */}
        {!loading && (
          <>
            {filteredRooms.length === 0 ? (
              <div className="bg-surface-base border border-border-subtle rounded-xl p-8 text-center">
                <Text variant="muted">No rooms match your filters.</Text>
                <button
                  onClick={() => setActiveFilters({ capacity: null, features: [] })}
                  className="mt-4 text-sm text-accent-primary hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <RoomList
                rooms={filteredRooms}
                bookings={bookings}
                activeRoomId={selectedRoomId}
                onToggleBookingForm={handleToggleBookingForm}
              />
            )}
          </>
        )}
      </div>

      {/* Booking form modal */}
      {showBookingForm && selectedRoomId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-surface-base w-full sm:max-w-lg sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface-base border-b border-border-subtle px-6 py-4 flex items-center justify-between">
              <Heading level={2} className="text-lg font-semibold">
                Book Room
              </Heading>
              <button
                onClick={() => {
                  setShowBookingForm(false);
                  setSelectedRoomId(null);
                }}
                className="p-2 hover:bg-surface-muted rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <BookingForm
                roomId={selectedRoomId}
                rooms={rooms}
                onBookingCreated={handleBookingCreated}
                onCancel={() => {
                  setShowBookingForm(false);
                  setSelectedRoomId(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
