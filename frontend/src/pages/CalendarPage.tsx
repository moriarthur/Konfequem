// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useAlert } from "../context/AlertContext";
import { error as logError } from "../utils/logger";
import BottomNav from "../components/BottomNav";
import { Heading, Text } from "../components/ui/Typography";
import { DateTime } from "luxon";
import { useNavigate, useSearchParams } from "react-router-dom";
import { OFFICE_TIMEZONE } from "../utils/bookingUtils";

export default function CalendarPage() {
  const { authFetch, isAuthenticated } = useAuth();
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(DateTime.now().setZone(OFFICE_TIMEZONE));
  const [expandedDay, setExpandedDay] = useState(null); // { date: DateTime, dayBookings: [] }
  const [editingBooking, setEditingBooking] = useState(null); // booking object being edited
  const [deleteConfirmBooking, setDeleteConfirmBooking] = useState(null); // booking to delete
  const [editForm, setEditForm] = useState({ start_time: "", end_time: "" });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Ref for tracking fetch cancellation
  const isMountedRef = useRef(true);

  // Fetch bookings with race condition protection
  useEffect(() => {
    if (!isAuthenticated) {
      setBookings([]);
      setAllBookings([]);
      setLoading(false);
      return;
    }

    isMountedRef.current = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const monthStr = currentMonth.toFormat("yyyy-MM");

        // Fetch month bookings for calendar display
        const bookingsData = await authFetch(`/api/bookings/?month=${monthStr}`);
        // Handle pagination - extract results array from paginated response
        if (isMountedRef.current) setBookings(bookingsData.results || bookingsData);

        // Fetch all bookings for current/next calculation
        const allBookingsData = await authFetch("/api/bookings/");
        // Handle pagination - extract results array from paginated response
        if (isMountedRef.current) setAllBookings(allBookingsData.results || allBookingsData);
      } catch (err) {
        if (isMountedRef.current) logError("Error fetching bookings:", err);
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };

    fetchData();

    // Cleanup function
    return () => {
      isMountedRef.current = false;
    };
  }, [authFetch, isAuthenticated, currentMonth]);

  // Unsaved changes warning for browser back/refresh
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (editingBooking || deleteConfirmBooking) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [editingBooking, deleteConfirmBooking]);

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
   * Calculate duration between two times in human-readable format
   */
  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return "--";

    const start = DateTime.fromISO(startTime);
    const end = DateTime.fromISO(endTime);

    if (!start.isValid || !end.isValid) return "--";

    const diff = end.diff(start, ["hours", "minutes"]);

    const hours = diff.hours;
    const minutes = Math.round(diff.minutes);

    if (hours === 0) {
      return `${minutes}m`;
    } else if (minutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${minutes}m`;
    }
  };

  /**
   * Handle day cell click
   */
  const handleDayClick = (dayInfo) => {
    if (dayInfo.dayBookings.length > 0) {
      setExpandedDay(dayInfo);
    }
  };

  /**
   * Close expanded view
   */
  const handleCloseExpanded = () => {
    setExpandedDay(null);
    setEditingBooking(null);
    setDeleteConfirmBooking(null);
    setValidationErrors({});
  };

  /**
   * Start editing a booking
   */
  const handleEditBooking = (booking) => {
    const now = DateTime.now().setZone(OFFICE_TIMEZONE);
    const bookingStart = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
    const bookingEnd = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
    const isPast = bookingEnd < now;
    const isCurrent = now >= bookingStart && now < bookingEnd;

    // Prevent editing bookings that are in progress or already ended
    if (isPast) {
      showAlert("Cannot edit a booking that has already ended.", { type: "error" });
      return;
    }
    if (isCurrent) {
      showAlert("Cannot edit a booking that is currently in progress.", { type: "error" });
      return;
    }

    setEditingBooking(booking);
    setEditForm({
      start_time: booking.start_time,
      end_time: booking.end_time,
    });
    setValidationErrors({});
  };

  /**
   * Cancel editing
   */
  const handleCancelEdit = () => {
    setEditingBooking(null);
    setEditForm({ start_time: "", end_time: "" });
    setValidationErrors({});
  };

  /**
   * Save booking changes
   */
  const handleSaveEdit = async () => {
    if (!editingBooking) return;

    setValidationErrors({});

    const start = DateTime.fromISO(editForm.start_time).setZone(OFFICE_TIMEZONE);
    const end = DateTime.fromISO(editForm.end_time).setZone(OFFICE_TIMEZONE);
    const now = DateTime.now().setZone(OFFICE_TIMEZONE);

    const errors = {};

    // Validation: End time must be after start time
    if (end <= start) {
      errors.end_time = "End time must be after start time";
    }

    // Validation: Minimum 15 minutes
    const duration = end.diff(start, "minutes").minutes;
    if (duration < 15) {
      errors.duration = "Minimum booking duration is 15 minutes";
    }

    // Validation: Maximum 8 hours
    if (duration > 8 * 60) {
      errors.duration = "Maximum booking duration is 8 hours";
    }

    // Validation: Office hours (08:00 - 22:00)
    const startHour = start.hour;
    const endHour = end.hour;
    if (startHour < 8 || startHour >= 22) {
      errors.start_time = "Bookings must start between 08:00 and 22:00";
    }
    if (endHour > 22 || (endHour === 22 && end.minute > 0)) {
      errors.end_time = "Bookings must end by 22:00";
    }

    // Validation: Cannot book in the past
    if (start < now) {
      errors.start_time = "Cannot modify booking to start in the past";
    }

    // Check for overlapping bookings in the same room (handle room ID or object)
    const editingRoomId = editingBooking.room?.id || editingBooking.room;
    // Ensure allBookings is an array before filtering
    const roomBookings = Array.isArray(allBookings) ? allBookings.filter(b => {
      const bookingRoomId = b.room?.id || b.room;
      return bookingRoomId === editingRoomId && b.id !== editingBooking.id;
    }) : [];
    const hasOverlap = roomBookings.some(booking => {
      const bookingStart = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
      const bookingEnd = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
      return start < bookingEnd && end > bookingStart;
    });

    if (hasOverlap) {
      errors.overlap = "This time slot conflicts with an existing booking for this room";
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      const firstError = Object.values(errors)[0];
      showAlert(firstError, { type: "error" });
      return;
    }

    try {
      setSaving(true);

      const response = await authFetch(`/api/bookings/${editingBooking.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_time: editForm.start_time,
          end_time: editForm.end_time,
        }),
      });

      if (response) {
        // Refresh bookings
        const monthStr = currentMonth.toFormat("yyyy-MM");
        const [bookingsData, allBookingsData] = await Promise.all([
          authFetch(`/api/bookings/?month=${monthStr}`),
          authFetch("/api/bookings/"),
        ]);
        // Handle pagination - extract results array from paginated response
        const bookingsArray = bookingsData.results || bookingsData;
        const allBookingsArray = allBookingsData.results || allBookingsData;
        setBookings(bookingsArray);
        setAllBookings(allBookingsArray);

        // Update expanded day bookings
        if (expandedDay) {
          const updatedBooking = bookingsArray.find(b => b.id === editingBooking.id) || response;
          setExpandedDay({
            ...expandedDay,
            dayBookings: expandedDay.dayBookings.map(b =>
              b.id === editingBooking.id ? updatedBooking : b
            ),
          });
        }

        showAlert("Booking updated successfully", { type: "success" });
        setEditingBooking(null);
        setValidationErrors({});
      }
    } catch (err) {
      logError("Error updating booking:", err);

      // Handle specific error cases
      if (err.status === 409) {
        showAlert("This time slot was just booked by someone else. Please choose a different time.", { type: "error" });
        setValidationErrors({ overlap: "This time slot is no longer available" });
      } else if (err.status === 400) {
        if (err.overlap || err.message?.includes?.('overlap')) {
          showAlert("This time slot conflicts with an existing booking.", { type: "error" });
          setValidationErrors({ overlap: "This time slot is already booked" });
        } else if (err.message) {
          showAlert(err.message, { type: "error" });
        } else {
          showAlert("Invalid booking data. Please check your input.", { type: "error" });
        }
      } else if (err.status === 401) {
        showAlert("Your session has expired. Please refresh the page.", { type: "error" });
      } else if (err.status === 403) {
        // Show specific error message from backend
        if (err.message && err.message.includes("currently in progress")) {
          showAlert("Cannot modify a booking that is currently in progress.", { type: "error" });
        } else if (err.message && err.message.includes("already ended")) {
          showAlert("Cannot modify a booking that has already ended.", { type: "error" });
        } else {
          showAlert(err.message || "You don't have permission to modify this booking.", { type: "error" });
        }
      } else if (err.status === 404) {
        showAlert("This booking no longer exists.", { type: "error" });
        setEditingBooking(null);
      } else {
        showAlert("Failed to update booking. Please try again.", { type: "error" });
      }
    } finally {
      setSaving(false);
    }
  };

  /**
   * Show delete confirmation
   */
  const handleDeleteClick = (booking) => {
    const now = DateTime.now().setZone(OFFICE_TIMEZONE);
    const bookingStart = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
    const bookingEnd = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
    const isPast = bookingEnd < now;
    const isCurrent = now >= bookingStart && now < bookingEnd;

    // Prevent deleting bookings that are in progress or already ended
    if (isPast) {
      showAlert("Cannot delete a booking that has already ended.", { type: "error" });
      return;
    }
    if (isCurrent) {
      showAlert("Cannot delete a booking that is currently in progress.", { type: "error" });
      return;
    }

    setDeleteConfirmBooking(booking);
  };

  /**
   * Confirm delete booking
   */
  const handleConfirmDelete = async () => {
    if (!deleteConfirmBooking) return;

    try {
      await authFetch(`/api/bookings/${deleteConfirmBooking.id}/`, {
        method: "DELETE",
      });

      // Refresh bookings
      const monthStr = currentMonth.toFormat("yyyy-MM");
      const [bookingsData, allBookingsData] = await Promise.all([
        authFetch(`/api/bookings/?month=${monthStr}`),
        authFetch("/api/bookings/"),
      ]);
      setBookings(bookingsData);
      setAllBookings(allBookingsData);

      showAlert("Booking deleted successfully", { type: "success" });

      // Close expanded view if no bookings left, or remove deleted booking
      if (expandedDay) {
        const remainingBookings = expandedDay.dayBookings.filter(b => b.id !== deleteConfirmBooking.id);
        if (remainingBookings.length === 0) {
          setExpandedDay(null);
        } else {
          setExpandedDay({ ...expandedDay, dayBookings: remainingBookings });
        }
      }
      setDeleteConfirmBooking(null);
    } catch (err) {
      logError("Error deleting booking:", err);

      // Handle specific error cases
      if (err.status === 401) {
        showAlert("Your session has expired. Please refresh the page.", { type: "error" });
      } else if (err.status === 403) {
        // Show specific error message from backend
        if (err.message && err.message.includes("currently in progress")) {
          showAlert("Cannot delete a booking that is currently in progress.", { type: "error" });
        } else if (err.message && err.message.includes("already ended")) {
          showAlert("Cannot delete a booking that has already ended.", { type: "error" });
        } else {
          showAlert(err.message || "You don't have permission to delete this booking.", { type: "error" });
        }
      } else if (err.status === 404) {
        showAlert("This booking no longer exists.", { type: "error" });
        setDeleteConfirmBooking(null);
        // Refresh to clear stale data
        const monthStr = currentMonth.toFormat("yyyy-MM");
        const [bookingsData, allBookingsData] = await Promise.all([
          authFetch(`/api/bookings/?month=${monthStr}`),
          authFetch("/api/bookings/"),
        ]);
        setBookings(bookingsData);
        setAllBookings(allBookingsData);
      } else {
        showAlert("Failed to delete booking. Please try again.", { type: "error" });
      }
    }
  };

  /**
   * Handle URL params for direct edit mode
   */
  useEffect(() => {
    const editBookingId = searchParams.get("edit");
    if (editBookingId && allBookings.length > 0 && !expandedDay && !editingBooking) {
      const booking = allBookings.find(b => b.id === parseInt(editBookingId));
      if (booking) {
        const bookingDate = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
        const now = DateTime.now().setZone(OFFICE_TIMEZONE).startOf("day");
        const dayDate = bookingDate.startOf("day");
        const bookingEnd = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);

        // Check if booking is editable (not in progress and not ended)
        const isPast = bookingEnd < now;
        const isCurrent = now >= bookingDate && now < bookingEnd;

        if (isPast) {
          showAlert("Cannot edit a booking that has already ended.", { type: "error" });
          // Clear URL param without opening edit
          Promise.resolve().then(() => {
            navigate("/calendar", { replace: true });
          });
          return;
        }

        if (isCurrent) {
          showAlert("Cannot edit a booking that is currently in progress.", { type: "error" });
          // Clear URL param without opening edit
          Promise.resolve().then(() => {
            navigate("/calendar", { replace: true });
          });
          return;
        }

        // Create dayInfo directly without waiting for month bookings to load
        const dayInfo = {
          date: bookingDate,
          isCurrentMonth: true,
          isToday: bookingDate.hasSame(DateTime.now(), "day"),
          isPast: dayDate < now,
          dayBookings: [booking],
        };

        // Batch all state updates together to prevent multiple re-renders
        setCurrentMonth(bookingDate);
        setExpandedDay(dayInfo);
        setEditingBooking(booking);
        setEditForm({
          start_time: booking.start_time,
          end_time: booking.end_time,
        });

        // Clear URL param after state updates
        Promise.resolve().then(() => {
          navigate("/calendar", { replace: true });
        });
      }
    }
  }, [searchParams, allBookings, expandedDay, editingBooking, navigate]);

  /**
   * Find current and next upcoming bookings (from ALL bookings, not just current month)
   */
  const { currentBooking, nextBooking } = useMemo(() => {
    if (!allBookings || !Array.isArray(allBookings) || allBookings.length === 0) {
      return { currentBooking: null, nextBooking: null };
    }

    const now = DateTime.now().setZone(OFFICE_TIMEZONE);

    // Find current booking (happening now)
    const current = allBookings.find((booking) => {
      if (!booking?.start_time) return false;
      const start = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
      const end = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
      return now >= start && now < end;
    });

    // Filter and sort future bookings
    const futureBookings = allBookings
      .filter((booking) => {
        if (!booking?.start_time) return false;
        const start = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
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
    const today = DateTime.now().setZone(OFFICE_TIMEZONE).startOf("day");

    const days = [];
    let current = startOfGrid;

    while (current <= endOfGrid) {
      const dayDate = current.startOf("day");
      days.push({
        date: current,
        isCurrentMonth: current.month === currentMonth.month,
        isToday: current.hasSame(DateTime.now(), "day"),
        isPast: dayDate < today,
        dayBookings: Array.isArray(bookings) ? bookings.filter((booking) => {
          if (!booking?.start_time) return false;
          const bookingDate = DateTime.fromISO(booking.start_time);
          return bookingDate.hasSame(current, "day");
        }) : [],
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
        <div className={`bg-surface-base border border-border-subtle rounded-xl p-4 mb-6 transition-opacity ${
          expandedDay ? "opacity-50 pointer-events-none" : ""
        }`}>
          <div className="flex items-center justify-between">
            <button
              onClick={handlePreviousMonth}
              className="p-2 hover:bg-surface-muted rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-accent-secondary">
                <path d="M14.5 7L9.5 12L14.5 17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
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
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-accent-secondary">
                <path d="M9.5 7L14.5 12L9.5 17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden">
          {/* Week day headers - hide in expanded view */}
          {!expandedDay && (
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
          )}

          {/* Calendar days */}
          {loading ? (
            <div className="p-12 text-center">
              <Text variant="muted">Loading calendar...</Text>
            </div>
          ) : expandedDay ? (
            // Expanded view - single day filling the calendar
            <div className="p-4 sm:p-6 animate-expand-in">
              {/* Header with back button and date */}
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={handleCloseExpanded}
                  className="p-2 -ml-2 hover:bg-surface-muted rounded-lg transition-colors"
                  aria-label="Go back to calendar"
                >
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-accent-secondary">
                    <path d="M14.5 7L9.5 12L14.5 17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div>
                  <Heading level={2} className="text-xl font-semibold text-accent-secondary">
                    {expandedDay.date.toFormat("MMMM d, yyyy")}
                  </Heading>
                  <Text variant="muted" className="text-sm">
                    {expandedDay.dayBookings.length} booking{expandedDay.dayBookings.length !== 1 ? "s" : ""}
                  </Text>
                </div>
              </div>

              {/* Bookings list */}
              <div className="space-y-3">
                {expandedDay.dayBookings
                  .filter((booking) => {
                    // Filter out invalid bookings
                    if (!booking?.start_time || !booking?.end_time) return false;
                    const bookingStart = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
                    const bookingEnd = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
                    return bookingStart.isValid && bookingEnd.isValid;
                  })
                  .map((booking) => {
                    const now = DateTime.now().setZone(OFFICE_TIMEZONE);
                    const bookingStart = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
                    const bookingEnd = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
                    const isPast = bookingEnd < now;
                    const isCurrent = now >= bookingStart && now < bookingEnd;
                    const isNext = nextBooking?.id === booking.id;
                    const status = isPast ? "past" : isCurrent ? "current" : isNext ? "next" : "future";
                    const isEditing = editingBooking?.id === booking.id;
                    // Disable editing for current/past bookings
                    const canEdit = !isPast && !isCurrent;;

                  const statusStyles = {
                    past: "bg-surface-muted border-border-subtle text-accent-secondary/40",
                    current: "bg-status-success/10 border-status-success/20 text-status-success",
                    next: "bg-status-warning/10 border-status-warning/20 text-status-warning",
                    future: "bg-accent-primary/5 border-accent-primary/10 text-accent-secondary"
                  };

                  const statusLabels = {
                    past: "Past",
                    current: "Now",
                    next: "Next",
                    future: "Upcoming"
                  };

                  return (
                    <div
                      key={booking.id}
                      className={`border rounded-xl transition-all ${statusStyles[status]} ${
                        !isEditing && canEdit ? "cursor-pointer hover:ring-2 hover:ring-accent-primary/30" : ""
                      }`}
                    >
                      {isEditing ? (
                        // Inline edit form
                        <div className="p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <Text className="font-medium">Edit booking</Text>
                            <button
                              onClick={handleCancelEdit}
                              className="text-accent-secondary/60 hover:text-accent-secondary"
                            >
                              Cancel
                            </button>
                          </div>

                          {/* Overlap error banner */}
                          {validationErrors.overlap && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                              <Text className="text-sm text-red-600">{validationErrors.overlap}</Text>
                            </div>
                          )}

                          {/* Duration error banner */}
                          {validationErrors.duration && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                              <Text className="text-sm text-red-600">{validationErrors.duration}</Text>
                            </div>
                          )}

                          <div className="space-y-3">
                            {/* Start time input */}
                            <div>
                              <label className="block text-sm font-medium text-accent-secondary mb-1">
                                Start time
                              </label>
                              <input
                                type="time"
                                value={editForm.start_time ? DateTime.fromISO(editForm.start_time).toFormat("HH:mm") : ""}
                                onChange={(e) => {
                                  const [hours, minutes] = e.target.value.split(":");
                                  const newStart = bookingStart.set({ hour: parseInt(hours), minute: parseInt(minutes) });
                                  const currentEnd = editForm.end_time ? DateTime.fromISO(editForm.end_time).setZone(OFFICE_TIMEZONE) : null;

                                  // Don't allow start time to be at or after end time
                                  if (currentEnd && newStart >= currentEnd.minus({ minutes: 15 })) {
                                    // Keep at least 15 minutes gap, set end to start + 15min minimum
                                    setEditForm({
                                      start_time: newStart.toISO(),
                                      end_time: newStart.plus({ minutes: 15 }).toISO(),
                                    });
                                  } else {
                                    // Preserve duration when moving start time
                                    const duration = bookingEnd.diff(bookingStart);
                                    setEditForm({
                                      start_time: newStart.toISO(),
                                      end_time: newStart.plus(duration).toISO(),
                                    });
                                  }
                                  // Clear validation errors when user changes input
                                  if (validationErrors.start_time || validationErrors.overlap) {
                                    setValidationErrors({ ...validationErrors, start_time: undefined, overlap: undefined });
                                  }
                                }}
                                className={`w-full px-3 py-2 border rounded-lg bg-surface-base text-accent-secondary ${
                                  validationErrors.start_time ? "border-red-500" : "border-border-subtle"
                                }`}
                              />
                              <div className="mt-1 flex justify-between">
                                <Text variant="muted" className="text-xs">
                                  {bookingStart.toFormat("EEE, MMM d")}
                                </Text>
                                {validationErrors.start_time && (
                                  <Text className="text-xs text-red-500">{validationErrors.start_time}</Text>
                                )}
                              </div>
                            </div>

                            {/* End time input */}
                            <div>
                              <label className="block text-sm font-medium text-accent-secondary mb-1">
                                End time
                              </label>
                              <input
                                type="time"
                                value={editForm.end_time ? DateTime.fromISO(editForm.end_time).toFormat("HH:mm") : ""}
                                onChange={(e) => {
                                  const [hours, minutes] = e.target.value.split(":");
                                  const newEnd = bookingStart.set({ hour: parseInt(hours), minute: parseInt(minutes) });
                                  const currentStart = editForm.start_time ? DateTime.fromISO(editForm.start_time).setZone(OFFICE_TIMEZONE) : null;

                                  // Don't allow end time to be before or at start time (need at least 15 min)
                                  if (currentStart && newEnd <= currentStart.plus({ minutes: 15 })) {
                                    // Enforce minimum 15 minute duration
                                    return;
                                  }
                                  setEditForm({
                                    ...editForm,
                                    end_time: newEnd.toISO(),
                                  });
                                  // Clear validation errors when user changes input
                                  if (validationErrors.end_time || validationErrors.duration || validationErrors.overlap) {
                                    setValidationErrors({
                                      ...validationErrors,
                                      end_time: undefined,
                                      duration: undefined,
                                      overlap: undefined
                                    });
                                  }
                                }}
                                className={`w-full px-3 py-2 border rounded-lg bg-surface-base text-accent-secondary ${
                                  validationErrors.end_time ? "border-red-500" : "border-border-subtle"
                                }`}
                              />
                              {validationErrors.end_time && (
                                <Text className="text-xs text-red-500 mt-1 block">{validationErrors.end_time}</Text>
                              )}
                            </div>

                            {/* Duration display with validation */}
                            <div className="flex justify-between items-center">
                              <Text variant="muted" className="text-xs">
                                Duration: {formatDuration(editForm.start_time, editForm.end_time)}
                              </Text>
                              {(validationErrors.duration || validationErrors.overlap) && (
                                <Text className="text-xs text-red-500">
                                  {validationErrors.duration || validationErrors.overlap}
                                </Text>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveEdit}
                              disabled={saving}
                              className="flex-1 px-4 py-2 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={() => handleDeleteClick(booking)}
                              className="px-4 py-2 border border-red-500/30 text-red-600 rounded-lg hover:bg-red-50"
                              title="Delete booking"
                            >
                              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                                <path d="M5 8H19M5 8C5 6.11438 5 5.17157 5.58579 4.58579C6.17157 4 7.11438 4 9 4H15C16.8856 4 17.8284 4 18.4142 4.58579C19 5.17157 19 6.11438 19 8M5 8V18C5 19.8856 5 20.8284 5.58579 21.4142C6.17157 22 7.11438 22 9 22H15C16.8856 22 17.8284 22 18.4142 21.4142C19 20.8284 19 19.8856 19 18V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M10 12V16M14 12V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Normal booking card view
                        <div
                          className="p-4"
                          onClick={() => canEdit && handleEditBooking(booking)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              {/* Room name */}
                              <div className="flex items-center gap-2 mb-2">
                                {(isCurrent || isNext) && (
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/50">
                                    {statusLabels[status]}
                                  </span>
                                )}
                                <Text className="font-medium truncate">
                                  {booking.room_name || booking.room}
                                </Text>
                              </div>

                              {/* Time range */}
                              <div className="flex items-center gap-2 text-sm">
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0 opacity-70">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                                  <path d="M12 8V12L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <span>
                                  {bookingStart.toFormat("HH:mm")} - {bookingEnd.toFormat("HH:mm")}
                                </span>
                                <span className="text-xs opacity-60">
                                  ({formatDuration(booking.start_time, booking.end_time)})
                                </span>
                              </div>
                            </div>

                            {/* Edit button icon - only for editable bookings */}
                            {canEdit && (
                              <div className="flex-shrink-0 p-1">
                                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-40">
                                  <path d="M13.5203 3.83582C14.0787 3.27745 14.9871 3.27745 15.5455 3.83582L20.1642 8.4545C20.7225 9.01287 20.7225 9.92127 20.1642 10.4796L18.9497 11.6942L12.3058 5.05025L13.5203 3.83582ZM10.8984 6.45762L3.02019 14.3358L2.75166 18.9834L7.39929 18.7149L15.2775 10.8367L10.8984 6.45762Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {expandedDay.dayBookings.filter(b => b?.start_time && b?.end_time).length === 0 && (
                  <div className="text-center py-12">
                    <Text variant="muted">No bookings for this day</Text>
                  </div>
                )}
              </div>

              {/* Delete confirmation modal */}
              {deleteConfirmBooking && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                  <div className="bg-surface-base rounded-xl p-6 max-w-sm w-full">
                    <Heading level={3} className="text-lg font-semibold text-accent-secondary mb-2">
                      Delete booking?
                    </Heading>
                    <Text variant="muted" className="mb-4">
                      Are you sure you want to delete your booking for{" "}
                      <span className="font-medium text-accent-secondary">
                        {deleteConfirmBooking.room_name || deleteConfirmBooking.room}
                      </span>
                      {" "}on {DateTime.fromISO(deleteConfirmBooking.start_time).toFormat("MMM d")}?
                      {" "}This action cannot be undone.
                    </Text>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirmBooking(null)}
                        className="flex-1 px-4 py-2 border border-border-subtle rounded-lg hover:bg-surface-muted text-accent-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmDelete}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Normal calendar grid view
            <div className="grid grid-cols-7">
              {calendarDays.map((dayInfo, index) => {
                const { date, isCurrentMonth, isToday, isPast, dayBookings } = dayInfo;
                const hasBookings = dayBookings.length > 0;

                // Calculate booking status for dots
                const now = DateTime.now().setZone(OFFICE_TIMEZONE);
                const validBookings = dayBookings.filter(b => b?.start_time && b?.end_time);
                const isCurrent = validBookings.some(b => {
                  const start = DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE);
                  const end = DateTime.fromISO(b.end_time).setZone(OFFICE_TIMEZONE);
                  return now >= start && now < end;
                });
                const isNext = validBookings.some(b => nextBooking?.id === b.id);

                // Max 3 dots: current (green), next (yellow), future (gray)
                const showDots = hasBookings && !isPast;
                const dotCount = Math.min(validBookings.length, 3);

                return (
                  <div
                    key={index}
                    onClick={() => handleDayClick(dayInfo)}
                    className={`min-h-[70px] sm:min-h-[100px] border-r border-b border-border-subtle p-1 sm:p-2 transition-all ${
                      isPast ? "bg-surface-muted" : !isCurrentMonth ? "bg-surface-muted/50" : ""
                    } ${isToday && !isPast ? "bg-white" : ""} ${
                      hasBookings && !isPast
                        ? "cursor-pointer hover:bg-accent-primary/5 active:scale-[0.98]"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 sm:mb-2">
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

                    {/* Mobile: Availability dots | Desktop: Booking pills */}
                    <div className="space-y-1">
                      {/* Mobile: Show dots only */}
                      <div className="sm:hidden flex gap-1 flex-wrap">
                        {showDots && (
                          <>
                            {/* Current booking dot (green) */}
                            {isCurrent && (
                              <div className="w-2 h-2 rounded-full bg-status-success flex-shrink-0" />
                            )}
                            {/* Next booking dot (yellow) */}
                            {!isCurrent && isNext && (
                              <div className="w-2 h-2 rounded-full bg-status-warning flex-shrink-0" />
                            )}
                            {/* Future bookings dots (gray) */}
                            {Array.from({ length: isCurrent || isNext ? Math.min(dotCount - 1, 2) : Math.min(dotCount, 3) }).map((_, i) => (
                              <div key={i} className="w-2 h-2 rounded-full bg-accent-secondary/30 flex-shrink-0" />
                            ))}
                            {/* Overflow indicator */}
                            {validBookings.length > 3 && (
                              <span className="text-[10px] text-accent-secondary/50 leading-none">+</span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Desktop: Show booking pills */}
                      <div className="hidden sm:block space-y-1">
                        {validBookings
                          .slice(0, 2)
                          .map((booking) => {
                            const bookingEnd = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
                            if (!bookingEnd.isValid) return null;

                            const bookingPast = bookingEnd < now;
                            const bookingIsCurrent = currentBooking?.id === booking.id;
                            const bookingIsNext = nextBooking?.id === booking.id;

                            return (
                              <div
                                key={booking.id}
                                className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                  bookingPast
                                    ? 'bg-surface-muted border border-border-subtle text-accent-secondary/40'
                                    : bookingIsCurrent
                                    ? 'bg-status-success/10 border border-status-success/20 text-status-success font-medium'
                                    : bookingIsNext
                                    ? 'bg-status-warning/10 border border-status-warning/20 text-status-warning font-medium'
                                    : 'bg-accent-primary/5 border border-accent-primary/10 text-accent-secondary'
                                }`}
                                title={`${booking.room_name || booking.room}: ${
                                  booking.start_time ? DateTime.fromISO(booking.start_time).toFormat("HH:mm") : "??"
                                } - ${
                                  booking.end_time ? DateTime.fromISO(booking.end_time).toFormat("HH:mm") : "??"
                                }`}
                              >
                                {bookingIsCurrent && (
                                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 flex-shrink-0">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                                    <path d="M8.5 12.5L10.5 14.5L15.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                                {bookingIsNext && (
                                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 flex-shrink-0">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                                    <path d="M12 8V12L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                                <span className={`truncate ${bookingPast ? 'line-through' : ''}`}>
                                  {booking.start_time ? DateTime.fromISO(booking.start_time).toFormat("HH:mm") : "??:??"}{" "}
                                  {booking.room_name || booking.room}
                                </span>
                              </div>
                            );
                          })}
                        {validBookings.length > 2 && (
                          <div className="text-[10px] text-accent-secondary/60 px-1.5">
                            +{validBookings.length - 2} more
                          </div>
                        )}
                      </div>
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
