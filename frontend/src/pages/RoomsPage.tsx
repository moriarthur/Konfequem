import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import { error as logError } from "../utils/logger";
import BottomNav from "../components/BottomNav";
import RoomList from "../components/RoomList";
import RoomFilters from "../components/RoomFilters";
import BookingForm from "../components/BookingForm";
import { Heading, Text } from "../components/ui/Typography";
import { RoomCardSkeleton } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import { Room, Feature, ActiveFilters, PaginatedResponse } from "../types";
import { BookingData } from "../utils/bookingUtils";

export default function RoomsPage() {
  const { authFetch, authFetchRef, isAuthenticated } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);
  const bookingFormRef = useRef<HTMLFormElement>(null);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
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

    if (!authFetchRef?.current) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const fetch = authFetchRef.current!;
        const [roomsData, featuresData, bookingsData] = await Promise.all([
          fetch("/api/rooms/"),
          fetch("/api/room-features/"),
          fetch("/api/bookings/"),
        ]);
        setRooms((roomsData as PaginatedResponse<Room>).results || (roomsData as Room[]));
        setFeatures((featuresData as PaginatedResponse<Feature>).results || (featuresData as Feature[]));
        setBookings((bookingsData as PaginatedResponse<BookingData>).results || (bookingsData as BookingData[]));
      } catch (err) {
        logError("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated]);

  useEffect(() => {
    if (showBookingForm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setIsFormValid(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showBookingForm]);

  const handleBookingCreated = async () => {
    try {
      const bookingsData = await authFetch("/api/bookings/");
      setBookings((bookingsData as PaginatedResponse<BookingData>).results || (bookingsData as BookingData[]));
      setShowBookingForm(false);
      setSelectedRoomId(null);
      setIsFormValid(false);
    } catch (err) {
      logError("Error refreshing bookings:", err);
    }
  };

  const handleFilterChange = (type: string | ActiveFilters, value?: number | number[] | null) => {
    if (type === "capacity") {
      setActiveFilters(prev => ({ ...prev, capacity: (value as number) ?? null }));
    } else if (type === "features") {
      setActiveFilters(prev => ({ ...prev, features: value as number[] }));
    } else if (typeof type === "object") {
      setActiveFilters(type);
    }
  };

  const handleToggleBookingForm = (roomId: number) => {
    if (selectedRoomId === roomId) {
      setShowBookingForm(false);
      setSelectedRoomId(null);
      setIsFormValid(false);
    } else {
      setSelectedRoomId(roomId);
      setShowBookingForm(true);
    }
  };

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      if (activeFilters.capacity !== null && room.capacity < activeFilters.capacity) {
        return false;
      }

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
      <div className="px-4 py-6 max-w-4xl mx-auto">
        <Heading level={1} className="text-2xl font-semibold text-accent-secondary mb-2">
          Rooms
        </Heading>
        <Text variant="muted" className="mb-6">
          Browse and book available rooms
        </Text>

        {loading && (
          <div className="space-y-3">
            <RoomCardSkeleton />
            <RoomCardSkeleton />
            <RoomCardSkeleton />
          </div>
        )}

        {!loading && features.length > 0 && (
          <div className="mb-6">
            <RoomFilters
              features={features}
              activeFilters={activeFilters}
              onFilterChange={handleFilterChange}
            />
          </div>
        )}

        {!loading && (
          <>
            {filteredRooms.length === 0 ? (
              <EmptyState
                icon={
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M8 11H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                }
                title="No rooms match your filters"
                description="Try adjusting or clearing your filters to see available rooms."
                action={
                  <button
                    onClick={() => setActiveFilters({ capacity: null, features: [] })}
                    className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 text-sm font-medium"
                  >
                    Clear filters
                  </button>
                }
              />
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

      {showBookingForm && selectedRoomId && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center">
          <div className="bg-surface-base w-full sm:max-w-lg sm:rounded-xl rounded-t-xl max-h-[calc(100vh-4rem)] sm:max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-surface-base border-b border-border-subtle px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between shrink-0">
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
            <div className="p-4 sm:p-6">
              {React.createElement(BookingForm as React.ComponentType<any>, {
                roomId: selectedRoomId,
                rooms,
                formRef: bookingFormRef,
                showSubmitButton: false,
                onValidityChange: setIsFormValid,
                onBookingCreated: handleBookingCreated,
                onCancel: () => {
                  setShowBookingForm(false);
                  setSelectedRoomId(null);
                },
              })}

              <Button
                variant="primary"
                size="lg"
                disabled={!isFormValid}
                onClick={() => bookingFormRef.current?.requestSubmit()}
                className={`w-full mt-6 ${
                  isFormValid
                    ? '!bg-status-success hover:!bg-status-success/90 !border-status-success'
                    : ''
                }`}
              >
                Book a Room
              </Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
