import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import Button from "../components/ui/Button";
import { error as logError } from "../utils/logger";
import BottomNav from "../components/BottomNav";
import RoomList from "../components/RoomList";
import RoomFilters from "../components/RoomFilters";
import BookingForm from "../components/BookingForm";
import RoomFormModal from "../components/RoomFormModal";
import { Heading, Text } from "../components/ui/Typography";
import { RoomCardSkeleton } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import { Room, Feature, ActiveFilters, PaginatedResponse } from "../types";
import { BookingData } from "../utils/bookingUtils";
import { isOrgAdmin } from "../utils/roles";

export default function RoomsPage() {
  const { authFetch, authFetchRef, isAuthenticated, access, user } = useAuth();
  const { showAlert } = useAlert();
  const isAdmin = isOrgAdmin(user);
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
  // undefined = closed, null = create mode, Room = edit mode
  const [formTarget, setFormTarget] = useState<Room | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

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
        // 429 already surfaces a toast from authFetch; keep loaded data
        if ((err as { status?: number }).status !== 429) {
          showAlert("Could not load data. Please try again.", { type: "error" });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, access]);

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

  const refreshData = async () => {
    const [roomsData, bookingsData] = await Promise.all([
      authFetch("/api/rooms/"),
      authFetch("/api/bookings/"),
    ]);
    setRooms((roomsData as PaginatedResponse<Room>).results || (roomsData as Room[]));
    setBookings((bookingsData as PaginatedResponse<BookingData>).results || (bookingsData as BookingData[]));
  };

  const closeBookingSheet = () => {
    setShowBookingForm(false);
    setSelectedRoomId(null);
    setIsFormValid(false);
  };

  const openRoomForm = (target: Room | null) => {
    closeBookingSheet();
    setFormTarget(target);
  };

  const handleRoomSaved = async () => {
    try {
      await refreshData();
      showAlert(formTarget ? "Room updated" : "Room created", { type: "success" });
    } catch (err) {
      logError("Error refreshing rooms:", err);
      showAlert("Room saved, but the list could not be refreshed.", { type: "warning" });
    } finally {
      setFormTarget(undefined);
    }
  };

  const openDeleteConfirm = (room: Room) => {
    closeBookingSheet();
    setDeleteError("");
    setDeleteTarget(room);
  };

  const handleDeleteRoom = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await authFetch(`/api/rooms/${deleteTarget.id}/`, { method: "DELETE" });
      await refreshData();
      showAlert("Room deleted", { type: "success" });
      setDeleteTarget(null);
    } catch (err) {
      const e = err as { general?: string[]; detail?: string };
      setDeleteError(
        e.general?.[0] || e.detail || "Could not delete room. Please try again."
      );
    } finally {
      setDeleting(false);
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
        <div className="flex items-center justify-between gap-4 mb-2">
          <Heading level={1} className="text-2xl font-semibold text-accent-secondary">
            Rooms
          </Heading>
          {isAdmin && (
            <Button variant="primary" onClick={() => openRoomForm(null)}>
              + Add Room
            </Button>
          )}
        </div>
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
            {rooms.length === 0 ? (
              <EmptyState
                icon={
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12">
                    <path d="M3 21H21V9L12 3L3 9V21Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M9 21V13H15V21" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                }
                title={isAdmin ? "No rooms yet" : "No rooms available"}
                description={
                  isAdmin
                    ? "Create your first room so your team can start booking."
                    : "There are no rooms configured in the system."
                }
                action={
                  isAdmin ? (
                    <Button variant="primary" onClick={() => openRoomForm(null)}>
                      Add your first room
                    </Button>
                  ) : undefined
                }
              />
            ) : filteredRooms.length === 0 ? (
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
                isAdmin={isAdmin}
                onEditRoom={(room) => openRoomForm(room)}
                onDeleteRoom={openDeleteConfirm}
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
              <BookingForm
                roomId={selectedRoomId}
                rooms={rooms}
                formRef={bookingFormRef}
                showSubmitButton={false}
                onValidityChange={setIsFormValid}
                onBookingCreated={handleBookingCreated}
                onCancel={() => {
                  setShowBookingForm(false);
                  setSelectedRoomId(null);
                }}
              />

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

      {formTarget !== undefined && (
        <RoomFormModal
          room={formTarget}
          features={features}
          onClose={() => setFormTarget(undefined)}
          onSaved={handleRoomSaved}
        />
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-room-title"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !deleting && setDeleteTarget(null)}
            aria-hidden="true"
          />
          <div className="relative bg-surface-base border border-border-subtle rounded-2xl shadow-soft p-6 max-w-sm w-full">
            <Heading level={3} id="delete-room-title" className="text-lg font-medium text-accent-secondary mb-4">
              Delete Room
            </Heading>
            <p className="text-accent-secondary/70 mb-4">
              Are you sure you want to delete <span className="font-semibold text-accent-secondary">{deleteTarget.name}</span>
              {deleteTarget.location ? ` (${deleteTarget.location})` : ""}? Past bookings
              in this room will be removed as well.
            </p>
            {deleteError && (
              <p className="p-3 bg-status-danger-soft border border-status-danger-border rounded-lg text-status-danger-text text-sm mb-4" role="alert">
                {deleteError}
              </p>
            )}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Keep Room
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleDeleteRoom}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Room"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
