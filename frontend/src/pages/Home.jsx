import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { error as logError } from "../utils/logger";
import BottomNav from "../components/BottomNav";
import Button from "../components/ui/Button";
import BookingForm from "../components/BookingForm";
import { Heading, Text } from "../components/ui/Typography";
import { DateTime } from "luxon";
import { PlusIcon, ClockIcon, CheckCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

export default function Home() {
  const { authFetch, isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [showQuickBook, setShowQuickBook] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [isFormValid, setIsFormValid] = useState(false);
  const bookingFormRef = useRef(null);
  const quickBookSectionRef = useRef(null);



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

    const fetchData = async () => {
      try {
        const roomsData = await authFetch("/api/rooms/");
        setRooms(roomsData);
        const bookingsData = await authFetch("/api/bookings/");
        setBookings(bookingsData);
      } catch (err) {
        logError("Error fetching data:", err);
      }
    };

    fetchData();
  }, [authFetch, isAuthenticated]);

  // Get upcoming bookings (nearest future bookings)
  const upcomingBookings = useMemo(() => {
    if (!bookings || bookings.length === 0) return { current: null, upcoming: [] };

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
    if (!rooms.length || !bookings.length) return rooms.length;

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
    if (!bookings || bookings.length === 0) return 0;

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
        <div className="flex items-center justify-center min-h-screen">
          <Text variant="default">Loading...</Text>
        </div>
      )}

      {!loading && isAuthenticated ? (
        <div className="px-4 py-6 max-w-4xl mx-auto">
          {/* Header with date */}
          <section className="mb-6">
            <p className="text-sm text-accent-secondary/60 mb-1">
              {getTimeBasedGreeting()}, {user?.first_name || user?.username || "there"}
            </p>
            <Heading level={1} className="text-2xl font-semibold text-accent-secondary">
              Your workspace
            </Heading>
            <Text variant="muted" className="text-sm mt-1">
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
                  <CheckCircleIcon className="w-5 h-5 text-status-success" />
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
                  <ClockIcon className="w-5 h-5 text-status-warning" />
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
            <Heading level={2} className="text-lg font-semibold text-accent-secondary mb-4">
              Upcoming Bookings
            </Heading>

            {upcomingBookings.upcoming.length === 0 && !upcomingBookings.current ? (
              <div className="bg-surface-base border border-border-subtle rounded-xl p-6 text-center">
                <Text variant="muted">No upcoming bookings</Text>
                <button
                  onClick={() => navigate("/rooms")}
                  className="mt-4 text-accent-primary hover:underline text-sm font-medium"
                >
                  Book a room →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingBookings.current && (
                  <div
                    className={`bg-surface-base border rounded-xl p-3 flex items-center justify-between gap-3 border-status-success/30 bg-status-success/5`}
                  >
                    <div className="flex-1 min-w-0">
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
                      Current
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
                    <div
                      key={booking.id}
                      className="bg-surface-base border border-border-subtle rounded-xl p-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-accent-secondary truncate">
                          {booking.room_name || booking.room}
                        </p>
                        <p className="text-xs text-accent-secondary/60">
                          {dateLabel} • {start.toFormat("HH:mm")} –{" "}
                          {DateTime.fromISO(booking.end_time).setZone("Europe/Berlin").toFormat("HH:mm")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                    onClick={() => {
                      setShowQuickBook(false);
                      setSelectedRoomId(null);
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-muted transition-colors"
                    aria-label="Close"
                  >
                    <XMarkIcon className="w-5 h-5 text-accent-secondary/60" />
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
                          onValidityChange={setIsFormValid}
                          onBookingCreated={() => {
                            // Refresh bookings
                            authFetch("/api/bookings/").then(setBookings).catch(logError);
                            setShowQuickBook(false);
                            setSelectedRoomId(null);
                          }}
                          onCancel={() => {
                            setShowQuickBook(false);
                            setSelectedRoomId(null);
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
              disabled={showQuickBook && !isFormValid}
              onClick={() => {
                if (showQuickBook && isFormValid) {
                  // Trigger form submission
                  bookingFormRef.current?.requestSubmit();
                } else {
                  setShowQuickBook(!showQuickBook);
                }
              }}
              className={`w-full flex items-center justify-center ${
                showQuickBook && isFormValid
                  ? '!bg-status-success hover:!bg-status-success/90 !border-status-success'
                  : ''
              } ${
                showQuickBook && !isFormValid ? '!opacity-50 !cursor-not-allowed' : ''
              }`}
            >
              {!showQuickBook && <PlusIcon className="w-5 h-5" />}
              <span className={!showQuickBook ? 'ml-2' : ''}>
                {showQuickBook ? 'Book a Room' : 'Quick Book a Room'}
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
                  <ClockIcon className="w-4 h-4 flex-shrink-0" />
                  <span>Office hours: 08:00 – 22:00</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Min. booking: 15 min • Max: 8 hours</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
    </div>
  );
}
