import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { error as logError } from "../utils/logger";
import BottomNav from "../components/BottomNav";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { Heading, Text } from "../components/ui/Typography";
import { DateTime } from "luxon";

export default function CalendarPage() {
  const { authFetch, isAuthenticated } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(DateTime.now());

  useEffect(() => {
    if (!isAuthenticated) {
      setBookings([]);
      setLoading(false);
      return;
    }

    const fetchBookings = async () => {
      try {
        setLoading(true);
        const monthStr = currentMonth.toFormat("yyyy-MM");
        const bookingsData = await authFetch(`/api/bookings/?month=${monthStr}`);
        setBookings(bookingsData);
      } catch (err) {
        logError("Error fetching bookings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
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
   * Get calendar grid for the current month
   */
  const calendarDays = useMemo(() => {
    const startOfMonth = currentMonth.startOf("month");
    const endOfMonth = currentMonth.endOf("month");
    const startOfGrid = startOfMonth.startOf("week");
    const endOfGrid = endOfMonth.endOf("week");

    const days = [];
    let current = startOfGrid;

    while (current <= endOfGrid) {
      days.push({
        date: current,
        isCurrentMonth: current.month === currentMonth.month,
        isToday: current.hasSame(DateTime.now(), "day"),
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
                const { date, isCurrentMonth, isToday, dayBookings } = dayInfo;
                return (
                  <div
                    key={index}
                    className={`min-h-[80px] sm:min-h-[100px] border-r border-b border-border-subtle p-1 sm:p-2 ${
                      !isCurrentMonth ? "bg-surface-muted/50" : ""
                    } ${isToday ? "bg-accent-primary/5" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-sm font-medium ${
                          isCurrentMonth
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
                      {dayBookings.slice(0, 2).map((booking) => (
                        <div
                          key={booking.id}
                          className="text-[10px] sm:text-xs px-1.5 py-0.5 bg-status-success/10 border border-status-success/20 rounded text-accent-secondary truncate"
                          title={`${booking.room_name || booking.room}: ${DateTime.fromISO(
                            booking.start_time
                          ).toFormat("HH:mm")} - ${DateTime.fromISO(
                            booking.end_time
                          ).toFormat("HH:mm")}`}
                        >
                          {DateTime.fromISO(booking.start_time).toFormat("HH:mm")}{" "}
                          {booking.room_name || booking.room}
                        </div>
                      ))}
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
        <div className="mt-4 flex items-center gap-4 text-xs text-accent-secondary/60">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-accent-primary/10 border border-accent-primary/20 rounded"></div>
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-status-success/10 border border-status-success/20 rounded"></div>
            <span>Booked</span>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
