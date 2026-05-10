// @ts-nocheck
import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { error as logError } from "../utils/logger";
import { OFFICE_TIMEZONE } from "../utils/bookingUtils";
import { useAlert } from "../context/AlertContext";
import BottomNav from "../components/BottomNav";
import Button from "../components/ui/Button";
import BookingForm from "../components/BookingForm";
import Logo from "../components/Logo";
import { Heading, Text } from "../components/ui/Typography";
import { Skeleton, StatCardSkeleton, BookingListSkeleton } from "../components/ui/Skeleton";
import EmptyState from "../components/ui/EmptyState";
import BookingDetailsModal from "../components/booking/BookingDetailsModal";
import { DateTime } from "luxon";

export default function Home() {
  const { authFetch, authFetchRef, isAuthenticated, loading, user } = useAuth();
  const { success, error: showError } = useAlert();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [showQuickBook, setShowQuickBook] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [isFormValid, setIsFormValid] = useState(false);
  const [bookingToEdit, setBookingToEdit] = useState(null);
  const [hasBookingConflict, setHasBookingConflict] = useState(false);
  const bookingFormRef = useRef(null);
  const quickBookSectionRef = useRef(null);
  const [detailsBooking, setDetailsBooking] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);

  // Handle edit booking
  const handleEditBooking = (booking) => {
    const roomId = booking.room?.id || booking.room || booking.room_id;
    setBookingToEdit(booking);
    setSelectedRoomId(roomId);
    setShowQuickBook(true);
  };

  // Close quick book modal and reset state
  const closeQuickBook = () => {
    setShowQuickBook(false);
    setSelectedRoomId(null);
    setBookingToEdit(null);
    setHasBookingConflict(false);
  };

  // Cancel a booking
  const handleCancelBooking = async (booking) => {
    try {
      await authFetch(`/api/bookings/${booking.id}/`, { method: "DELETE" });
      success("Booking cancelled successfully");
      setConfirmCancel(null);
      setDetailsBooking(null);
      refreshBookings();
    } catch (err) {
      const msg = err?.message || "";
      if (msg.includes("JSON.parse") || msg.includes("unexpected end of data")) {
        success("Booking cancelled successfully");
        setConfirmCancel(null);
        setDetailsBooking(null);
        refreshBookings();
      } else {
        showError("Failed to cancel booking. Please try again.");
      }
    }
  };

  // Refresh bookings
  const refreshBookings = () => {
    authFetch("/api/bookings/")
      .then(data => setBookings(data.results || data))
      .catch(logError);
  };

  // Get time-based greeting
  const getTimeBasedGreeting = () => {
    const hour = DateTime.now().hour;
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Get today's date in German format
  const getTodayDate = () => {
    return DateTime.now().setZone("Europe/Berlin").toFormat("EEEE, dd. MMMM yyyy");
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setRooms([]);
      setBookings([]);
      return;
    }

    // Only fetch if the authFetchRef is available (i.e., authContext is fully initialized)
    if (!authFetchRef?.current) {
      // Auth context not fully initialized yet, skip this render
      return;
    }

    const fetchData = async () => {
      try {
        // Use the ref to get the latest authFetch function
        const fetch = authFetchRef.current;
        const roomsResponse = await fetch("/api/rooms/");
        // Handle pagination - extract results array from paginated response
        setRooms(roomsResponse.results || roomsResponse);

        const bookingsResponse = await fetch("/api/bookings/");
        // Handle pagination - extract results array from paginated response
        setBookings(bookingsResponse.results || bookingsResponse);
      } catch (err) {
        logError("Error fetching data:", err);
      }
    };

    fetchData();
  }, [isAuthenticated]);

  // Get upcoming bookings (nearest future bookings)
  const upcomingBookings = useMemo(() => {
    // Ensure bookings is an array before processing
    if (!bookings || !Array.isArray(bookings) || bookings.length === 0) {
      return { current: null, upcoming: [] };
    }

    const now = DateTime.now().setZone("Europe/Berlin");

    // Filter and sort all future bookings
    const futureBookings = bookings
      .filter((booking) => {
        if (!booking?.start_time) return false;
        const start = DateTime.fromISO(booking.start_time).setZone("Europe/Berlin");
        return start > now;
      })
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    // Find current booking (happening now)
    const current = bookings.find((booking) => {
      const start = DateTime.fromISO(booking.start_time).setZone("Europe/Berlin");
      const end = DateTime.fromISO(booking.end_time).setZone("Europe/Berlin");
      return now >= start && now < end;
    });

    // Get next 5 upcoming bookings
    const upcoming = futureBookings.slice(0, 5);

    return { current, upcoming };
  }, [bookings]);

  // Get rooms available right now
  const availableNow = useMemo(() => {
    if (!rooms.length || !Array.isArray(bookings) || !bookings.length) return rooms.length;

    const now = DateTime.now().setZone("Europe/Berlin");
    const bookedRoomIds = bookings
      .filter((booking) => {
        const start = DateTime.fromISO(booking.start_time).setZone("Europe/Berlin");
        const end = DateTime.fromISO(booking.end_time).setZone("Europe/Berlin");
        return now >= start && now < end;
      })
      .map((b) => b.room);

    return rooms.filter((room) => !bookedRoomIds.includes(room.id)).length;
  }, [rooms, bookings]);

  // Get today's bookings count for the status card
  const todayBookingsCount = useMemo(() => {
    if (!bookings || !Array.isArray(bookings) || bookings.length === 0) return 0;

    const now = DateTime.now().setZone("Europe/Berlin");
    const todayStart = now.startOf("day");
    const todayEnd = now.endOf("day");

    return bookings.filter((booking) => {
      if (!booking?.start_time) return false;
      const start = DateTime.fromISO(booking.start_time).setZone("Europe/Berlin");
      return start >= todayStart && start <= todayEnd;
    }).length;
  }, [bookings]);

  // Reset form validity when room selection changes or quick book closes
  useEffect(() => {
    if (!showQuickBook || !selectedRoomId) {
      setIsFormValid(false);
    }
  }, [showQuickBook, selectedRoomId]);

  // Scroll to quick book section when it opens
  useEffect(() => {
    if (showQuickBook && quickBookSectionRef.current) {
      setTimeout(() => {
        const rect = quickBookSectionRef.current?.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetY = scrollTop + rect.top - (window.innerHeight / 2) + (rect.height / 2);
        window.scrollTo({
          behavior: "smooth",
          top: targetY,
        });
      }, 350);
    }
  }, [showQuickBook]);

  return (
    <div className="min-h-screen bg-surface-muted pb-20">
      {loading && (
        <div className="px-4 py-6 max-w-4xl mx-auto">
          {/* Header skeleton */}
          <div className="mb-6">
            <div className="flex items-center justify-center gap-1 mb-4">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-4 w-48 mx-auto" />
          </div>

          {/* Status card skeleton */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>

          {/* Booking list skeleton */}
          <div className="bg-surface-base border border-border-subtle rounded-xl p-4">
            <Skeleton className="h-5 w-32 mb-4" />
            <BookingListSkeleton />
          </div>

          {/* Quick Book button skeleton */}
          <div className="bg-surface-base border border-border-subtle rounded-xl h-14" />
        </div>
      )}

      {!loading && isAuthenticated ? (
        <div className="px-4 py-6 max-w-4xl mx-auto">
          {/* Header with logo and greeting */}
          <section className="mb-6">
            <div className="flex items-center justify-center gap-1 mb-4">
              <span className="text-xl font-bold tracking-wide" style={{ color: "#61b390" }}>KONFEQUEM</span>
              <Logo size="sm" className="mx-1" />
              <span className="text-xl font-bold tracking-wide" style={{ color: "#01352c" }}>WORKSPACE</span>
            </div>
            <div className="text-center">
              <p className="text-sm text-accent-secondary/60">
                {getTimeBasedGreeting()}, {user?.first_name || user?.username || "there"}
              </p>
            </div>
            <Text variant="muted" className="text-sm text-center mt-1">
              {getTodayDate()}
            </Text>
          </section>

          {/* Current status card */}
          <section className="mb-6">
            <div className="bg-surface-base border border-border-subtle rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-accent-secondary/60 mb-1">Available now</p>
                  <p className="text-2xl font-semibold text-accent-secondary">
                    {availableNow} <span className="text-sm font-normal text-accent-secondary/60">of {rooms?.length || 0} rooms</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-accent-secondary/60 mb-1">Today's meetings</p>
                  <p className="text-2xl font-semibold text-accent-secondary">
                    {todayBookingsCount}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Current/Next meeting highlight */}
          {upcomingBookings.current && (
            <section className="mb-6">
              <div className="bg-status-success/10 border border-status-success/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-status-success">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8.5 12.5L10.5 14.5L15.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p className="text-sm font-medium text-status-success">Happening now</p>
                </div>
                <p className="font-semibold text-accent-secondary">
                  {upcomingBookings.current.room_name || upcomingBookings.current.room}
                </p>
                <p className="text-sm text-accent-secondary/70 mt-1">
                  Until {DateTime.fromISO(upcomingBookings.current.end_time).setZone("Europe/Berlin").toFormat("HH:mm")}
                </p>
              </div>
            </section>
          )}

          {!upcomingBookings.current && upcomingBookings.upcoming.length > 0 && (
            <section className="mb-6">
              <div className="bg-status-warning/10 border border-status-warning/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-status-warning">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M12 8V12L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p className="text-sm font-medium text-status-warning">Upcoming next</p>
                </div>
                <p className="font-semibold text-accent-secondary">
                  {upcomingBookings.upcoming[0].room_name || upcomingBookings.upcoming[0].room}
                </p>
                <p className="text-sm text-accent-secondary/70 mt-1">
                  {DateTime.fromISO(upcomingBookings.upcoming[0].start_time).setZone("Europe/Berlin").toFormat("HH:mm")} –{" "}
                  {DateTime.fromISO(upcomingBookings.upcoming[0].end_time).setZone("Europe/Berlin").toFormat("HH:mm")}
                </p>
              </div>
            </section>
          )}

          {/* Upcoming Bookings */}
          <section className="mb-6">
            <div className="bg-surface-base border border-border-subtle rounded-xl p-4">
              <Heading level={2} className="text-lg font-semibold text-accent-secondary mb-4">
                Upcoming Bookings
              </Heading>

              {upcomingBookings.upcoming.length === 0 && !upcomingBookings.current ? (
                <EmptyState
                  icon={
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12">
                      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M3 10H21" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M8 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M16 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M12 14V14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="12" cy="17" r="0.5" fill="currentColor"/>
                    </svg>
                  }
                  title="No upcoming bookings"
                  description="Your schedule is clear. Book a room to get started."
                  action={
                    <button
                      onClick={() => navigate("/rooms")}
                      className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90 text-sm font-medium"
                    >
                      Book a room
                    </button>
                  }
                />
              ) : (
                <>
                  <div className="space-y-2">
                    {upcomingBookings.current && (
                      <div className={`w-full bg-surface-base border rounded-xl p-3 flex items-center justify-between gap-3 border-status-success/30 bg-status-success/5`}>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="font-medium text-accent-secondary truncate">
                            {upcomingBookings.current.room_name || upcomingBookings.current.room}
                          </p>
                          <p className="text-xs text-accent-secondary/60">
                            {DateTime.fromISO(upcomingBookings.current.start_time).setZone("Europe/Berlin").toFormat("HH:mm")} –{" "}
                            {DateTime.fromISO(upcomingBookings.current.end_time).setZone("Europe/Berlin").toFormat("HH:mm")}
                            <span className="ml-2 text-status-success font-medium">Now</span>
                          </p>
                        </div>
                        <span className="text-xs font-medium text-status-success px-2 py-1 bg-status-success/10 rounded-full flex-shrink-0">
                          In Progress
                        </span>
                      </div>
                    )}
                    {upcomingBookings.upcoming.map((booking) => {
                      const start = DateTime.fromISO(booking.start_time).setZone("Europe/Berlin");
                      const now = DateTime.now().setZone("Europe/Berlin");
                      const isToday = start.hasSame(now, "day");
                      const isTomorrow = start.hasSame(now.plus({ days: 1 }), "day");

                      let dateLabel = start.toFormat("EEE, MMM d");
                      if (isToday) dateLabel = "Today";
                      if (isTomorrow) dateLabel = "Tomorrow";

                      return (
                        <button
                          key={booking.id}
                          onClick={() => setDetailsBooking(booking)}
                          className="w-full bg-surface-muted border border-border-subtle rounded-xl p-3 flex items-center justify-between gap-3 hover:ring-2 hover:ring-accent-primary/30 hover:bg-surface-base transition-all group"
                        >
                          <div className="flex-1 min-w-0 text-left">
                            <p className="font-medium text-accent-secondary truncate">
                              {booking.room_name || booking.room}
                            </p>
                            <p className="text-xs text-accent-secondary/60">
                              {dateLabel} • {start.toFormat("HH:mm")} –{" "}
                              {DateTime.fromISO(booking.end_time).setZone("Europe/Berlin").toFormat("HH:mm")}
                            </p>
                          </div>
                          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-accent-secondary/30 group-hover:text-accent-primary group-hover:translate-x-0.5 transition-all flex-shrink-0">
                            <path d="M9.5 7L14.5 12L9.5 17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* View all bookings button */}
                  <button
                    onClick={() => navigate("/calendar")}
                    className="w-full text-center text-sm text-accent-primary hover:underline mt-4"
                  >
                    View all bookings →
                  </button>
                </>
              )}
            </div>
          </section>

          {/* Quick Book CTA */}
          <section className="mb-4">
            {/* Expandable Quick Book Section */}
            <div
              ref={quickBookSectionRef}
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                showQuickBook ? 'max-h-[2000px] mb-4 opacity-100' : 'max-h-0 mb-0 opacity-0'
              }`}
            >
              <div className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden">
                {/* Section Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
                  <Heading level={3} className="text-base font-semibold">
                    Quick Book
                  </Heading>
                  <button
                    onClick={closeQuickBook}
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-muted transition-colors"
                    aria-label="Close"
                  >
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-accent-secondary/60">
                      <path d="M4 4L20 20M20 4L4 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>

                {/* Booking Form */}
                <div>
                  {!selectedRoomId ? (
                    // Step 1: Select Room
                    <div className="p-4">
                      <Text variant="muted" className="mb-3 text-sm">
                        Select a room to book
                      </Text>
                      <div className="space-y-2">
                        {rooms.map((room) => {
                          // Check if room is available now
                          const now = DateTime.now().setZone("Europe/Berlin");
                          const isBooked = bookings.some((b) => {
                            const start = DateTime.fromISO(b.start_time).setZone("Europe/Berlin");
                            const end = DateTime.fromISO(b.end_time).setZone("Europe/Berlin");
                            return b.room === room.id && now >= start && now < end;
                          });

                          return (
                            <button
                              key={room.id}
                              onClick={() => setSelectedRoomId(room.id)}
                              className="w-full text-left p-3 border border-border-subtle rounded-xl hover:border-accent-primary/50 hover:bg-surface-muted transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-accent-secondary">{room.name}</p>
                                  <p className="text-xs text-accent-secondary/60 mt-0.5">
                                    {room.location} • {room.capacity} people
                                  </p>
                                </div>
                                {!isBooked && (
                                  <span className="text-xs px-2 py-1 bg-status-success/10 text-status-success rounded-full">
                                    Free
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    // Step 2: Booking Form
                    <>
                      <button
                        onClick={() => setSelectedRoomId(null)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-accent-secondary/70 hover:text-accent-secondary border-b border-border-subtle w-full"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to rooms
                      </button>
                      <div className="p-4">
                        <BookingForm
                          roomId={selectedRoomId}
                          rooms={rooms}
                          formRef={bookingFormRef}
                          showSubmitButton={false}
                          onValidityChange={setIsFormValid}
                          onConflictChange={setHasBookingConflict}
                          bookingToEdit={bookingToEdit}
                          onBookingCreated={() => {
                            refreshBookings();
                            closeQuickBook();
                          }}
                          onBookingUpdated={() => {
                            refreshBookings();
                            closeQuickBook();
                          }}
                          onCancel={() => {
                            closeQuickBook();
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              disabled={showQuickBook && (!isFormValid || hasBookingConflict)}
              onClick={() => {
                if (showQuickBook && isFormValid && !hasBookingConflict) {
                  // Trigger form submission
                  bookingFormRef.current?.requestSubmit();
                } else {
                  // Opening for new booking - reset edit state
                  setBookingToEdit(null);
                  setHasBookingConflict(false);
                  setShowQuickBook(true);
                }
              }}
              className={`w-full flex items-center justify-center ${
                showQuickBook && isFormValid && !hasBookingConflict
                  ? '!bg-status-success hover:!bg-status-success/90 !border-status-success'
                  : ''
              } ${
                showQuickBook && (!isFormValid || hasBookingConflict) ? '!opacity-50 !cursor-not-allowed' : ''
              }`}
            >
              {!showQuickBook && (
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                  <path d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M15 12L12 12M12 12L9 12M12 12L12 9M12 12L12 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
              <span className={!showQuickBook ? 'ml-2' : ''}>
                {showQuickBook
                  ? (bookingToEdit ? 'Update Booking' : 'Book a Room')
                  : 'Quick Book a Room'
                }
              </span>
            </Button>
          </section>

          {/* Helpful office info */}
          <section className="mb-4">
            <div className="bg-surface-base border border-border-subtle rounded-xl p-4">
              <p className="text-xs font-medium text-accent-secondary/60 uppercase tracking-wide mb-3">
                Office Info
              </p>
              <div className="space-y-2 text-sm text-accent-secondary/80">
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M12 8V12L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Office hours: 08:00 – 22:00</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0">
                    <path d="M21 13C21 17.9706 16.9706 22 12 22C7.02944 22 3 17.9706 3 13C3 8.02944 7.02944 4 12 4C16.9706 4 21 8.02944 21 13Z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M12 13V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10 2H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>Min. booking: 15 min • Max: 8 hours</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M12 17V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="1" cy="1" r="1" transform="matrix(1 0 0 -1 11 9)" fill="currentColor"/>
                  </svg>
                  <span>Book up to 90 days in advance</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        !loading && (
          <div className="flex items-center justify-center min-h-screen px-4">
            <Text variant="muted" className="text-center">
              Please log in to see your schedule.
            </Text>
          </div>
        )
      )}

      {/* Bottom Navigation */}
      {isAuthenticated && <BottomNav />}

      {/* Booking details modal */}
      {detailsBooking && (
        <BookingDetailsModal
          booking={detailsBooking}
          onClose={() => setDetailsBooking(null)}
          onEdit={(booking) => {
            setDetailsBooking(null);
            handleEditBooking(booking);
          }}
          onCancel={(booking) => {
            setConfirmCancel(booking);
          }}
        />
      )}

      {/* Cancel confirmation modal */}
      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmCancel(null)} aria-hidden="true" />
          <div className="relative bg-surface-base border border-border-subtle rounded-2xl shadow-soft p-6 max-w-md w-full">
            <Heading level={3} className="text-lg font-semibold text-accent-secondary mb-4">Cancel Booking</Heading>
            <p className="text-accent-secondary/70 mb-6">Are you sure you want to cancel this booking?</p>
            <div className="bg-surface-muted rounded-xl p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div className="font-medium">Room: {confirmCancel.room_name || confirmCancel.room}</div>
                <div>Date: {DateTime.fromISO(confirmCancel.start_time).setZone(OFFICE_TIMEZONE).toFormat("dd.MM.yyyy")}</div>
                <div>Time: {DateTime.fromISO(confirmCancel.start_time).setZone(OFFICE_TIMEZONE).toFormat("HH:mm")} — {DateTime.fromISO(confirmCancel.end_time).setZone(OFFICE_TIMEZONE).toFormat("HH:mm")}</div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmCancel(null)}>Keep Booking</Button>
              <Button variant="danger" className="flex-1" onClick={() => handleCancelBooking(confirmCancel)}>Cancel Booking</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
