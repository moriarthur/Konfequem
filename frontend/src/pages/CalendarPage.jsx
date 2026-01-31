import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { error as logError } from "../utils/logger";
import BottomNav from "../components/BottomNav";
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { Heading, Text } from "../components/ui/Typography";
import { DateTime } from "luxon";

export default function CalendarPage() {
  const { authFetch, isAuthenticated } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(DateTime.now());

  useEffect(() => {
    if (!isAuthenticated) {
      setBookings([]);
      setAllBookings([]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const monthStr = currentMonth.toFormat("yyyy-MM");
        
        // Fetch month bookings for calendar display
        const bookingsData = await authFetch(`/api/bookings/?month=${monthStr}`);
        setBookings(bookingsData);

        // Fetch all bookings for current/next calculation
        const allBookingsData = await authFetch("/api/bookings/");
        setAllBookings(allBookingsData);
      } catch (err) {
        logError("Error fetching bookings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authFetch, isAuthenticated, currentMonth]);

  /**
   * Navigate to previous month
   */
  const handlePreviousMonth = () => {
    setCurrentMonth(currentMonth.minus({ months: 1 }));
  };

  /**
   * Navigate to next month
   */
  const handleNextMonth = () => {
    setCurrentMonth(currentMonth.plus({ months: 1 }));
  };

  /**
   * Go to today
   */
  const handleToday = () => {
    setCurrentMonth(DateTime.now());
  };

  /**
   * Find current and next upcoming bookings (from ALL bookings, not just current month)
   */
  const { currentBooking, nextBooking } = useMemo(() => {
    if (!allBookings || allBookings.length === 0) return { currentBooking: null, nextBooking: null };

    const now = DateTime.now().setZone("Europe/Berlin");

    // Find current booking (happening now)
    const current = allBookings.find((booking) => {
      if (!booking?.start_time) return false;
      const start = DateTime.fromISO(booking.start_time).setZone("Europe/Berlin");
      const end = DateTime.fromISO(booking.end_time).setZone("Europe/Berlin");
      return now >= start && now < end;
    });

    // Filter and sort future bookings
    const futureBookings = allBookings
      .filter((booking) => {
        if (!booking?.start_time) return false;
        const start = DateTime.fromISO(booking.start_time).setZone("Europe/Berlin");
        return start > now;
      })
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    const next = futureBookings.length > 0 ? futureBookings[0] : null;

    return { currentBooking: current, nextBooking: next };
  }, [allBookings]);

  /**
   * Get calendar grid for the current month
   */
  const calendarDays = useMemo(() => {
    const startOfMonth = currentMonth.startOf("month");
    const endOfMonth = currentMonth.endOf("month");
    const startOfGrid = startOfMonth.startOf("week");
    const endOfGrid = endOfMonth.endOf("week");
    const today = DateTime.now().setZone("Europe/Berlin").startOf("day");

    const days = [];
    let current = startOfGrid;

    while (current <= endOfGrid) {
      const dayDate = current.startOf("day");
      days.push({
        date: current,
        isCurrentMonth: current.month === currentMonth.month,
        isToday: current.hasSame(DateTime.now(), "day"),
        isPast: dayDate < today,
        dayBookings: bookings.filter((booking) => {
          if (!booking?.start_time) return false;
          const bookingDate = DateTime.fromISO(booking.start_time);
          return bookingDate.hasSame(current, "day");
        }),
      });
      current = current.plus({ days: 1 });
    }

    return days;
  }, [currentMonth, bookings]);

  /**
   * Get week day labels
   */
  const weekDays = useMemo(() => {
    const days = [];
    let current = DateTime.now().startOf("week");
    for (let i = 0; i < 7; i++) {
      days.push(current.toFormat("ccc"));
      current = current.plus({ days: 1 });
    }
    return days;
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center px-4">
        <Text variant="muted" className="text-center">
          Please log in to view the calendar.
        </Text>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted pb-20">
      <div className="px-4 py-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={1} className="text-2xl font-semibold text-accent-secondary">
              Calendar
            </Heading>
            <Text variant="muted" className="mt-1">
              View your upcoming bookings
            </Text>
          </div>
        </div>

        {/* Month navigation */}
        <div className="bg-surface-base border border-border-subtle rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePreviousMonth}
              className="p-2 hover:bg-surface-muted rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeftIcon className="w-5 h-5 text-accent-secondary" />
            </button>

            <div className="text-center">
              <button
                onClick={handleToday}
                className="text-lg font-semibold text-accent-secondary hover:text-accent-primary transition-colors"
              >
                {currentMonth.toFormat("MMMM yyyy")}
              </button>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-surface-muted rounded-lg transition-colors"
              aria-label="Next month"
            >
              <ChevronRightIcon className="w-5 h-5 text-accent-secondary" />
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden">
          {/* Week day headers */}
          <div className="grid grid-cols-7 border-b border-border-subtle">
            {weekDays.map((day) => (
              <div
                key={day}
                className="px-2 py-3 text-center text-xs font-medium text-accent-secondary/60 uppercase tracking-wide"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          {loading ? (
            <div className="p-12 text-center">
              <Text variant="muted">Loading calendar...</Text>
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarDays.map((dayInfo, index) => {
                const { date, isCurrentMonth, isToday, isPast, dayBookings } = dayInfo;
                return (
                  <div
                    key={index}
                    className={`min-h-[80px] sm:min-h-[100px] border-r border-b border-border-subtle p-1 sm:p-2 ${
                      isPast ? "bg-surface-muted" : !isCurrentMonth ? "bg-surface-muted/50" : ""
                    } ${isToday && !isPast ? "bg-white" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-sm font-medium ${
                          isPast
                            ? "text-accent-secondary/40"
                            : isCurrentMonth
                            ? isToday
                              ? "text-accent-primary"
                              : "text-accent-secondary"
                            : "text-accent-secondary/40"
                        }`}
                      >
                        {date.day}
                      </span>
                    </div>

                    {/* Day bookings */}
                    <div className="space-y-1">
                      {dayBookings.slice(0, 2).map((booking) => {
                        const now = DateTime.now().setZone("Europe/Berlin");
                        const bookingEnd = DateTime.fromISO(booking.end_time).setZone("Europe/Berlin");
                        const isPast = bookingEnd < now;
                        const isCurrent = currentBooking?.id === booking.id;
                        const isNext = nextBooking?.id === booking.id;
                        
                        return (
                          <div
                            key={booking.id}
                            className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${
                              isPast
                                ? 'bg-surface-muted border border-border-subtle text-accent-secondary/40'
                                : isCurrent
                                ? 'bg-status-success/10 border border-status-success/20 text-status-success font-medium'
                                : isNext
                                ? 'bg-status-warning/10 border border-status-warning/20 text-status-warning font-medium'
                                : 'bg-accent-primary/5 border border-accent-primary/10 text-accent-secondary'
                            }`}
                            title={`${booking.room_name || booking.room}: ${DateTime.fromISO(
                              booking.start_time
                            ).toFormat("HH:mm")} - ${DateTime.fromISO(
                              booking.end_time
                            ).toFormat("HH:mm")}`}
                          >
                            {isCurrent && <CheckCircleIcon className="w-3 h-3 flex-shrink-0" />}
                            {isNext && <ClockIcon className="w-3 h-3 flex-shrink-0" />}
                            <span className={`truncate ${isPast ? 'line-through' : ''}`}>
                              {DateTime.fromISO(booking.start_time).toFormat("HH:mm")}{" "}
                              {booking.room_name || booking.room}
                            </span>
                          </div>
                        );
                      })}
                      {dayBookings.length > 2 && (
                        <div className="text-[10px] text-accent-secondary/60 px-1.5">
                          +{dayBookings.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-accent-secondary/60">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-accent-primary/10 border border-accent-primary/20 rounded"></div>
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-status-success/10 border border-status-success/20 rounded"></div>
            <span>Current</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-status-warning/10 border border-status-warning/20 rounded"></div>
            <span>Upcoming</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-accent-primary/5 border border-accent-primary/10 rounded"></div>
            <span>Future</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-surface-muted border border-border-subtle rounded relative flex items-center justify-center">
              <svg className="w-2 h-2 text-accent-secondary/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <span>Past</span>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
