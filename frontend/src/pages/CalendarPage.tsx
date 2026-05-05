// @ts-nocheck
import React, { useState, useEffect, useMemo } from "react";
import { DateTime } from "luxon";
import { useNavigate, useSearchParams } from "react-router-dom";
import { OFFICE_TIMEZONE } from "../utils/bookingUtils";
import { useAlert } from "../context/AlertContext";
import BottomNav from "../components/BottomNav";
import { Heading, Text } from "../components/ui/Typography";
import { useCalendarBookings } from "../components/calendar/useCalendarBookings";
import BookingCardInline from "../components/calendar/BookingCardInline";

export default function CalendarPage() {
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentMonth, setCurrentMonth] = useState(DateTime.now().setZone(OFFICE_TIMEZONE));

  const {
    bookings, loading,
    expandedDay, setExpandedDay,
    editingBooking, setEditingBooking,
    deleteConfirmBooking, setDeleteConfirmBooking,
    editForm, setEditForm,
    saving, validationErrors, setValidationErrors,
    currentBooking, nextBooking,
    handleCloseExpanded, handleEditBooking, handleCancelEdit,
    handleSaveEdit, handleDeleteClick, handleConfirmDelete,
    refreshBookings,
  } = useCalendarBookings(currentMonth);

  const handlePreviousMonth = () => setCurrentMonth(currentMonth.minus({ months: 1 }));
  const handleNextMonth = () => setCurrentMonth(currentMonth.plus({ months: 1 }));
  const handleToday = () => setCurrentMonth(DateTime.now());

  const handleDayClick = (dayInfo) => {
    if (dayInfo.dayBookings.length > 0) setExpandedDay(dayInfo);
  };

  // Unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (editingBooking || deleteConfirmBooking) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [editingBooking, deleteConfirmBooking]);

  // URL params for direct edit mode
  useEffect(() => {
    const editBookingId = searchParams.get("edit");
    if (!editBookingId || !bookings.length || expandedDay || editingBooking) return;
    const booking = bookings.find(b => b.id === parseInt(editBookingId));
    if (!booking) return;

    const now = DateTime.now().setZone(OFFICE_TIMEZONE);
    const bookingStart = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
    const bookingEnd = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);

    if (bookingEnd < now) { showAlert("Cannot edit a booking that has already ended.", { type: "error" }); navigate("/calendar", { replace: true }); return; }
    if (now >= bookingStart && now < bookingEnd) { showAlert("Cannot edit a booking that is currently in progress.", { type: "error" }); navigate("/calendar", { replace: true }); return; }

    setCurrentMonth(bookingStart);
    setExpandedDay({ date: bookingStart, isCurrentMonth: true, isToday: bookingStart.hasSame(DateTime.now(), "day"), isPast: bookingStart.startOf("day") < now.startOf("day"), dayBookings: [booking] });
    setEditingBooking(booking);
    setEditForm({ start_time: booking.start_time, end_time: booking.end_time });
    navigate("/calendar", { replace: true });
  }, [searchParams, bookings, expandedDay, editingBooking, navigate]);

  // Calendar grid data
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
      const dayBookings = bookings.filter(booking => {
        const bookingDate = DateTime.fromISO(booking.start_time);
        return bookingDate.hasSame(dayDate, "day");
      });
      days.push({
        date: dayDate,
        isCurrentMonth: dayDate.month === currentMonth.month,
        isToday: dayDate.hasSame(today, "day"),
        isPast: dayDate < today,
        dayBookings,
      });
      current = current.plus({ days: 1 });
    }
    return days;
  }, [currentMonth, bookings]);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) days.push(DateTime.now().startOf("week").plus({ days: i }).toFormat("EEE"));
    return days;
  }, []);

  const clearErrors = (keys: string[]) => {
    setValidationErrors(prev => {
      const next = { ...prev };
      keys.forEach(k => delete next[k]);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-surface-muted pb-20">
      <div className="px-4 py-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Heading level={1} className="text-2xl font-semibold text-accent-secondary">Calendar</Heading>
            <Text variant="muted" className="mt-1">View your upcoming bookings</Text>
          </div>
        </div>

        {/* Month navigation */}
        <div className={`bg-surface-base border border-border-subtle rounded-xl p-4 mb-6 transition-opacity ${expandedDay ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="flex items-center justify-between">
            <button onClick={handlePreviousMonth} className="p-2 hover:bg-surface-muted rounded-lg transition-colors" aria-label="Previous month">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-accent-secondary"><path d="M14.5 7L9.5 12L14.5 17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div className="text-center">
              <button onClick={handleToday} className="text-lg font-semibold text-accent-secondary hover:text-accent-primary transition-colors">{currentMonth.toFormat("MMMM yyyy")}</button>
            </div>
            <button onClick={handleNextMonth} className="p-2 hover:bg-surface-muted rounded-lg transition-colors" aria-label="Next month">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-accent-secondary"><path d="M9.5 7L14.5 12L9.5 17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden">
          {!expandedDay && (
            <div className="grid grid-cols-7 border-b border-border-subtle">
              {weekDays.map((day) => (
                <div key={day} className="px-2 py-3 text-center text-xs font-medium text-accent-secondary/60 uppercase tracking-wide">{day}</div>
              ))}
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center"><Text variant="muted">Loading calendar...</Text></div>
          ) : expandedDay ? (
            <div className="p-4 sm:p-6 animate-expand-in">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={handleCloseExpanded} className="p-2 -ml-2 hover:bg-surface-muted rounded-lg transition-colors" aria-label="Go back to calendar">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-accent-secondary"><path d="M14.5 7L9.5 12L14.5 17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <div>
                  <Heading level={2} className="text-xl font-semibold text-accent-secondary">{expandedDay.date.toFormat("MMMM d, yyyy")}</Heading>
                  <Text variant="muted" className="text-sm">{expandedDay.dayBookings.length} booking{expandedDay.dayBookings.length !== 1 ? "s" : ""}</Text>
                </div>
              </div>

              <div className="space-y-3">
                {expandedDay.dayBookings
                  .filter(b => b?.start_time && b?.end_time && DateTime.fromISO(b.start_time).isValid && DateTime.fromISO(b.end_time).isValid)
                  .map(booking => (
                    <BookingCardInline
                      key={booking.id}
                      booking={booking}
                      isNext={nextBooking?.id === booking.id}
                      isEditing={editingBooking?.id === booking.id}
                      canEdit={(() => { const now = DateTime.now().setZone(OFFICE_TIMEZONE); const end = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE); const start = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE); return !(end < now) && !(now >= start && now < end); })()}
                      editForm={editingBooking?.id === booking.id ? editForm : { start_time: "", end_time: "" }}
                      saving={saving}
                      validationErrors={validationErrors}
                      onEdit={handleEditBooking}
                      onCancelEdit={handleCancelEdit}
                      onSave={handleSaveEdit}
                      onDeleteClick={handleDeleteClick}
                      onEditFormChange={setEditForm}
                      onClearErrors={clearErrors}
                    />
                  ))}
                {expandedDay.dayBookings.filter(b => b?.start_time && b?.end_time).length === 0 && (
                  <div className="text-center py-12"><Text variant="muted">No bookings for this day</Text></div>
                )}
              </div>

              {deleteConfirmBooking && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                  <div className="bg-surface-base rounded-xl p-6 max-w-sm w-full">
                    <Heading level={3} className="text-lg font-semibold text-accent-secondary mb-2">Delete booking?</Heading>
                    <Text variant="muted" className="mb-4">
                      Are you sure you want to delete your booking for <span className="font-medium text-accent-secondary">{deleteConfirmBooking.room_name || deleteConfirmBooking.room}</span>{" "}
                      on {DateTime.fromISO(deleteConfirmBooking.start_time).toFormat("MMM d")}? This action cannot be undone.
                    </Text>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteConfirmBooking(null)} className="flex-1 px-4 py-2 border border-border-subtle rounded-lg hover:bg-surface-muted text-accent-secondary">Cancel</button>
                      <button onClick={handleConfirmDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarDays.map((dayInfo, index) => {
                const { date, isCurrentMonth, isToday, isPast, dayBookings } = dayInfo;
                const hasBookings = dayBookings.length > 0;
                const now = DateTime.now().setZone(OFFICE_TIMEZONE);
                const validBookings = dayBookings.filter(b => b?.start_time && b?.end_time);
                const isCurrent = validBookings.some(b => { const s = DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE); const e = DateTime.fromISO(b.end_time).setZone(OFFICE_TIMEZONE); return now >= s && now < e; });
                const isNext = validBookings.some(b => nextBooking?.id === b.id);
                const showDots = hasBookings && !isPast;
                const dotCount = Math.min(validBookings.length, 3);

                return (
                  <div key={index} onClick={() => handleDayClick(dayInfo)} className={`min-h-[70px] sm:min-h-[100px] border-r border-b border-border-subtle p-1 sm:p-2 transition-all ${isPast ? "bg-surface-muted" : !isCurrentMonth ? "bg-surface-muted/50" : ""} ${isToday && !isPast ? "bg-white" : ""} ${hasBookings && !isPast ? "cursor-pointer hover:bg-accent-primary/5 active:scale-[0.98]" : ""}`}>
                    <div className="flex items-center justify-between mb-1 sm:mb-2">
                      <span className={`text-sm font-medium ${isPast ? "text-accent-secondary/40" : isCurrentMonth ? isToday ? "text-accent-primary" : "text-accent-secondary" : "text-accent-secondary/40"}`}>{date.day}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="sm:hidden flex gap-1 flex-wrap">
                        {showDots && (
                          <>
                            {isCurrent && <div className="w-2 h-2 rounded-full bg-status-success flex-shrink-0" />}
                            {!isCurrent && isNext && <div className="w-2 h-2 rounded-full bg-status-warning flex-shrink-0" />}
                            {Array.from({ length: isCurrent || isNext ? Math.min(dotCount - 1, 2) : Math.min(dotCount, 3) }).map((_, i) => <div key={i} className="w-2 h-2 rounded-full bg-accent-secondary/30 flex-shrink-0" />)}
                            {validBookings.length > 3 && <span className="text-[10px] text-accent-secondary/50 leading-none">+</span>}
                          </>
                        )}
                      </div>
                      <div className="hidden sm:block space-y-1">
                        {validBookings.slice(0, 2).map((booking) => {
                          const bookingEnd = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
                          if (!bookingEnd.isValid) return null;
                          const bookingPast = bookingEnd < now;
                          const bookingIsCurrent = currentBooking?.id === booking.id;
                          const bookingIsNext = nextBooking?.id === booking.id;
                          return (
                            <div key={booking.id} className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${bookingPast ? 'bg-surface-muted border border-border-subtle text-accent-secondary/40' : bookingIsCurrent ? 'bg-status-success/10 border border-status-success/20 text-status-success font-medium' : bookingIsNext ? 'bg-status-warning/10 border border-status-warning/20 text-status-warning font-medium' : 'bg-accent-primary/5 border border-accent-primary/10 text-accent-secondary'}`}
                              title={`${booking.room_name || booking.room}: ${booking.start_time ? DateTime.fromISO(booking.start_time).toFormat("HH:mm") : "??"} - ${booking.end_time ? DateTime.fromISO(booking.end_time).toFormat("HH:mm") : "??"}`}>
                              {bookingIsCurrent && <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 flex-shrink-0"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/><path d="M8.5 12.5L10.5 14.5L15.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              {bookingIsNext && <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 flex-shrink-0"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/><path d="M12 8V12L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              <span className={`truncate ${bookingPast ? 'line-through' : ''}`}>{booking.start_time ? DateTime.fromISO(booking.start_time).toFormat("HH:mm") : "??:??"} {booking.room_name || booking.room}</span>
                            </div>
                          );
                        })}
                        {validBookings.length > 2 && <div className="text-[10px] text-accent-secondary/60 px-1.5">+{validBookings.length - 2} more</div>}
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
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-accent-primary/10 border border-accent-primary/20 rounded"></div><span>Today</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-status-success/10 border border-status-success/20 rounded"></div><span>Current</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-status-warning/10 border border-status-warning/20 rounded"></div><span>Upcoming</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-accent-primary/5 border border-accent-primary/10 rounded"></div><span>Future</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-surface-muted border border-border-subtle rounded relative flex items-center justify-center"><svg className="w-2 h-2 text-accent-secondary/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></div><span>Past</span></div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
