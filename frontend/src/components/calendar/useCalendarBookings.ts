import { useState, useEffect, useRef, useMemo } from "react";
import { DateTime } from "luxon";
import { useAuth } from "../../context/AuthContext";
import { useAlert } from "../../context/AlertContext";
import { error as logError } from "../../utils/logger";
import { OFFICE_TIMEZONE } from "../../utils/bookingUtils";

export interface CalendarBooking {
  id: number;
  room: number | { id: number };
  room_name?: string;
  start_time: string;
  end_time: string;
  user?: number;
  [key: string]: unknown;
}

export interface DayInfo {
  date: DateTime;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  dayBookings: CalendarBooking[];
}

interface EditFormState {
  start_time: string;
  end_time: string;
}

function extractResults(data: unknown): CalendarBooking[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "results" in data) {
    return (data as { results: CalendarBooking[] }).results;
  }
  return [];
}

export function useCalendarBookings(currentMonth: DateTime) {
  const { authFetch, isAuthenticated } = useAuth();
  const { showAlert } = useAlert();
  const isMountedRef = useRef(true);

  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [allBookings, setAllBookings] = useState<CalendarBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState<DayInfo | null>(null);
  const [editingBooking, setEditingBooking] = useState<CalendarBooking | null>(null);
  const [deleteConfirmBooking, setDeleteConfirmBooking] = useState<CalendarBooking | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ start_time: "", end_time: "" });
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch bookings
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
        const bookingsData = await authFetch(`/api/bookings/?month=${monthStr}`);
        if (isMountedRef.current) setBookings(extractResults(bookingsData));

        const allBookingsData = await authFetch("/api/bookings/");
        if (isMountedRef.current) setAllBookings(extractResults(allBookingsData));
      } catch (err) {
        if (isMountedRef.current) {
          logError("Error fetching bookings:", err);
          // 429 already surfaces a toast from authFetch; keep loaded data
          if ((err as { status?: number }).status !== 429) {
            showAlert("Could not load bookings. Please try again.", { type: "error" });
          }
        }
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };

    fetchData();
    return () => { isMountedRef.current = false };
  }, [authFetch, isAuthenticated, currentMonth]);

  // Refresh helper
  const refreshBookings = async () => {
    const monthStr = currentMonth.toFormat("yyyy-MM");
    const [bookingsData, allBookingsData] = await Promise.all([
      authFetch(`/api/bookings/?month=${monthStr}`),
      authFetch("/api/bookings/"),
    ]);
    const newBookings = extractResults(bookingsData);
    const newAllBookings = extractResults(allBookingsData);
    setBookings(newBookings);
    setAllBookings(newAllBookings);
    return { newBookings, newAllBookings };
  };

  // Close expanded view
  const handleCloseExpanded = () => {
    setExpandedDay(null);
    setEditingBooking(null);
    setDeleteConfirmBooking(null);
    setValidationErrors({});
  };

  // Start editing
  const handleEditBooking = (booking: CalendarBooking) => {
    const now = DateTime.now().setZone(OFFICE_TIMEZONE);
    const bookingEnd = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
    const isPast = bookingEnd < now;
    const isCurrent = now >= DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE) && !isPast;

    if (isPast) { showAlert("Cannot edit a booking that has already ended.", { type: "error" }); return; }
    if (isCurrent) { showAlert("Cannot edit a booking that is currently in progress.", { type: "error" }); return; }

    setEditingBooking(booking);
    setEditForm({ start_time: booking.start_time, end_time: booking.end_time });
    setValidationErrors({});
  };

  const handleCancelEdit = () => {
    setEditingBooking(null);
    setEditForm({ start_time: "", end_time: "" });
    setValidationErrors({});
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingBooking) return;
    setValidationErrors({});

    const start = DateTime.fromISO(editForm.start_time).setZone(OFFICE_TIMEZONE);
    const end = DateTime.fromISO(editForm.end_time).setZone(OFFICE_TIMEZONE);
    const now = DateTime.now().setZone(OFFICE_TIMEZONE);
    const errors: Record<string, string> = {};

    if (end <= start) errors.end_time = "End time must be after start time";
    const duration = end.diff(start, "minutes").minutes;
    if (duration < 15) errors.duration = "Minimum booking duration is 15 minutes";
    if (duration > 8 * 60) errors.duration = "Maximum booking duration is 8 hours";
    if (start.hour < 8 || start.hour >= 22) errors.start_time = "Bookings must start between 08:00 and 22:00";
    if (end.hour > 22 || (end.hour === 22 && end.minute > 0)) errors.end_time = "Bookings must end by 22:00";
    if (start < now) errors.start_time = "Cannot modify booking to start in the past";

    const editingRoomId = typeof editingBooking.room === "object" ? editingBooking.room.id : editingBooking.room;
    const roomBookings = Array.isArray(allBookings) ? allBookings.filter(b => {
      const bookingRoomId = typeof b.room === "object" ? b.room.id : b.room;
      return bookingRoomId === editingRoomId && b.id !== editingBooking.id;
    }) : [];
    const hasOverlap = roomBookings.some(b => {
      const bs = DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE);
      const be = DateTime.fromISO(b.end_time).setZone(OFFICE_TIMEZONE);
      return start < be && end > bs;
    });
    if (hasOverlap) errors.overlap = "This time slot conflicts with an existing booking for this room";

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      showAlert(Object.values(errors)[0], { type: "error" });
      return;
    }

    try {
      setSaving(true);
      const response = await authFetch(`/api/bookings/${editingBooking.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_time: editForm.start_time, end_time: editForm.end_time }),
      });

      if (response) {
        const { newBookings } = await refreshBookings();
        if (expandedDay) {
          const updated = newBookings.find(b => b.id === editingBooking.id);
          if (updated) {
            setExpandedDay({ ...expandedDay, dayBookings: expandedDay.dayBookings.map((b): CalendarBooking => b.id === editingBooking.id ? updated : b) });
          }
        }
        showAlert("Booking updated successfully", { type: "success" });
        setEditingBooking(null);
        setValidationErrors({});
      }
    } catch (err: any) {
      logError("Error updating booking:", err);
      if (err.status === 409) {
        showAlert("This time slot was just booked by someone else. Please choose a different time.", { type: "error" });
        setValidationErrors({ overlap: "This time slot is no longer available" });
      } else if (err.status === 400) {
        const msg = err.message?.includes?.('overlap') ? "This time slot conflicts with an existing booking." : (err.message || "Invalid booking data. Please check your input.");
        showAlert(msg, { type: "error" });
      } else if (err.status === 401) {
        showAlert("Your session has expired. Please refresh the page.", { type: "error" });
      } else if (err.status === 403) {
        showAlert(err.message || "You don't have permission to modify this booking.", { type: "error" });
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

  // Delete
  const handleDeleteClick = (booking: CalendarBooking) => {
    const now = DateTime.now().setZone(OFFICE_TIMEZONE);
    const bookingEnd = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
    const bookingStart = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
    const isPast = bookingEnd < now;
    const isCurrent = now >= bookingStart && now < bookingEnd;

    if (isPast) { showAlert("Cannot delete a booking that has already ended.", { type: "error" }); return; }
    if (isCurrent) { showAlert("Cannot delete a booking that is currently in progress.", { type: "error" }); return; }
    setDeleteConfirmBooking(booking);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmBooking) return;
    try {
      await authFetch(`/api/bookings/${deleteConfirmBooking.id}/`, { method: "DELETE" });
      await refreshBookings();
      showAlert("Booking deleted successfully", { type: "success" });
      if (expandedDay) {
        const remaining = expandedDay.dayBookings.filter(b => b.id !== deleteConfirmBooking.id);
        if (remaining.length === 0) setExpandedDay(null);
        else setExpandedDay({ ...expandedDay, dayBookings: remaining });
      }
      setDeleteConfirmBooking(null);
    } catch (err: any) {
      logError("Error deleting booking:", err);
      if (err.status === 401) showAlert("Your session has expired. Please refresh the page.", { type: "error" });
      else if (err.status === 403) showAlert(err.message || "You don't have permission to delete this booking.", { type: "error" });
      else if (err.status === 404) {
        showAlert("This booking no longer exists.", { type: "error" });
        setDeleteConfirmBooking(null);
        await refreshBookings();
      } else showAlert("Failed to delete booking. Please try again.", { type: "error" });
    }
  };

  // Current/next booking
  const { currentBooking, nextBooking } = useMemo(() => {
    if (!allBookings?.length) return { currentBooking: null, nextBooking: null };
    const now = DateTime.now().setZone(OFFICE_TIMEZONE);
    const current = allBookings.find(b => {
      if (!b?.start_time) return false;
      const s = DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE);
      const e = DateTime.fromISO(b.end_time).setZone(OFFICE_TIMEZONE);
      return now >= s && now < e;
    });
    const future = allBookings.filter(b => {
      if (!b?.start_time) return false;
      return DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE) > now;
    }).sort((a, b) => (DateTime.fromISO(a.start_time) < DateTime.fromISO(b.start_time) ? -1 : 1));
    return { currentBooking: current || null, nextBooking: future[0] || null };
  }, [allBookings]);

  return {
    bookings, allBookings, loading,
    expandedDay, setExpandedDay,
    editingBooking, setEditingBooking,
    deleteConfirmBooking, setDeleteConfirmBooking,
    editForm, setEditForm,
    saving, validationErrors, setValidationErrors,
    currentBooking, nextBooking,
    handleCloseExpanded, handleEditBooking, handleCancelEdit,
    handleSaveEdit, handleDeleteClick, handleConfirmDelete,
    refreshBookings,
  };
}
