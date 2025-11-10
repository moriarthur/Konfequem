import React, { useState, useMemo, useRef, useEffect } from "react";
import { DateTime } from "luxon";
import { OFFICE_TIMEZONE } from "../utils/bookingUtils";
import { useAlert } from "../context/AlertContext";

// BookingList is a controlled component — it renders directly from the `bookings` prop
// and does not keep its own copy. This ensures it always reflects the parent state.
export default function BookingList({ bookings = [], authFetch, onRefresh }) {
  const [sortBy, setSortBy] = useState('date_asc');
  const [collapsedDates, setCollapsedDates] = useState(() => new Set());
  const [pendingDeletes, setPendingDeletes] = useState({});
  const deleteTimers = useRef({});
  const [page, setPage] = useState(0);
  const pageSizeDates = 5;
  const { showAlert } = useAlert();

  // Format helpers
  const formatTime = (isoString) => {
    try {
      return DateTime.fromISO(isoString).setZone(OFFICE_TIMEZONE).toFormat("HH:mm");
    } catch {
      return "Invalid time";
    }
  };

  // Sorting logic
  const sortedBookings = useMemo(() => {
    const list = [...bookings];
    switch (sortBy) {
      case 'date_asc':
        return list.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      case 'date_desc':
        return list.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
      case 'created_asc':
        return list.sort((a, b) => new Date(a.created_at || a.start_time) - new Date(b.created_at || b.start_time));
      case 'created_desc':
        return list.sort((a, b) => new Date(b.created_at || b.start_time) - new Date(a.created_at || a.start_time));
      default:
        return list.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    }
  }, [bookings, sortBy]);

  // Group bookings by date
  const grouped = useMemo(() => {
    const map = new Map();
    for (const b of sortedBookings) {
      const key = DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE).toFormat('yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    }
    return map;
  }, [sortedBookings]);

  const dateKeys = useMemo(() => Array.from(grouped.keys()), [grouped]);
  const totalPages = Math.max(1, Math.ceil(dateKeys.length / pageSizeDates));
  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [totalPages, page]);
  const visibleDateKeys = dateKeys.slice(page * pageSizeDates, (page + 1) * pageSizeDates);

  // Next upcoming booking
  const now = DateTime.now().setZone(OFFICE_TIMEZONE);
  const nextUpcomingId = useMemo(() => {
    const future = sortedBookings.filter(b => DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE) >= now);
    if (future.length === 0) return null;
    return future.sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0].id;
  }, [sortedBookings, now]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      Object.values(deleteTimers.current).forEach((t) => clearTimeout(t));
      deleteTimers.current = {};
    };
  }, []);

  if (!bookings || bookings.length === 0) {
    return <p className="text-gray-500">No bookings found.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Sticky sort bar */}
      <div className="sticky top-4 bg-transparent z-40">
        <div className="bg-white/80 backdrop-blur-sm border rounded px-3 py-2 flex items-center justify-between shadow-sm max-w-full">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="date_asc">Date (oldest first)</option>
              <option value="date_desc">Date (newest first)</option>
              <option value="created_asc">Added (oldest first)</option>
              <option value="created_desc">Added (newest first)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 border rounded text-sm disabled:opacity-50"
            >Prev</button>
            <span className="text-sm text-gray-600">Page {page + 1} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 border rounded text-sm disabled:opacity-50"
            >Next</button>
          </div>
        </div>
      </div>

      {/* Grouped bookings by date */}
      {visibleDateKeys.length === 0 ? (
        <p className="text-gray-500">No bookings found.</p>
      ) : (
        visibleDateKeys.map(dateKey => {
          const items = grouped.get(dateKey) || [];
          const collapsed = collapsedDates.has(dateKey);
          return (
            <div key={dateKey} className="bg-white border rounded">
              <div className="flex items-center justify-between px-4 py-2 border-b">
                <div>
                  <div className="text-sm font-medium">{DateTime.fromFormat(dateKey, 'yyyy-MM-dd').setZone(OFFICE_TIMEZONE).toFormat('dd.MM.yyyy')}</div>
                  <div className="text-xs text-gray-500">{items.length} booking{items.length !== 1 ? 's' : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-sm text-blue-600"
                    onClick={() => {
                      const s = new Set(collapsedDates);
                      if (s.has(dateKey)) s.delete(dateKey); else s.add(dateKey);
                      setCollapsedDates(s);
                    }}
                  >{collapsed ? 'Expand' : 'Collapse'}</button>
                </div>
              </div>

              {!collapsed && (
                <div className="p-4 space-y-3">
                  {items.map(booking => {
                    if (!booking || !booking.id) return null;
                    const isNext = booking.id === nextUpcomingId;
                    const isPending = !!pendingDeletes[booking.id];
                    return (
                      <div key={booking.id} className={`p-3 border rounded ${isNext ? 'ring-2 ring-green-300 bg-green-50' : 'bg-white'}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-medium">{booking.room_name || 'Unknown Room'}</div>
                            <div className="text-xs text-gray-600">{formatTime(booking.start_time)} — {formatTime(booking.end_time)} • {DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE).toRelative()}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isPending ? (
                              <button
                                className="text-sm text-red-600"
                                onClick={() => {
                                  // start optimistic pending delete with undo timer
                                  setPendingDeletes(pd => ({ ...pd, [booking.id]: booking }));
                                  // start timer to perform delete after 5s
                                  const t = setTimeout(async () => {
                                    try {
                                      if (!authFetch) throw new Error('authFetch not provided');
                                      await authFetch(`/api/bookings/${booking.id}/`, { method: 'DELETE' });
                                      setPendingDeletes(pd => {
                                        const copy = { ...pd };
                                        delete copy[booking.id];
                                        return copy;
                                      });
                                      if (onRefresh) onRefresh();
                                      showAlert('Booking cancelled');
                                    } catch (err) {
                                      // restore on error
                                      setPendingDeletes(pd => {
                                        const copy = { ...pd };
                                        delete copy[booking.id];
                                        return copy;
                                      });
                                      showAlert('Failed to cancel booking');
                                    }
                                  }, 5000);
                                  deleteTimers.current[booking.id] = t;
                                }}
                              >Cancel</button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">Cancelling…</span>
                                <button
                                  className="text-sm text-blue-600"
                                  onClick={() => {
                                    // undo pending delete
                                    const t = deleteTimers.current[booking.id];
                                    if (t) clearTimeout(t);
                                    delete deleteTimers.current[booking.id];
                                    setPendingDeletes(pd => {
                                      const copy = { ...pd };
                                      delete copy[booking.id];
                                      return copy;
                                    });
                                    showAlert('Cancellation undone');
                                  }}
                                >Undo</button>
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
          );
        })
      )}
    </div>
  );
}
