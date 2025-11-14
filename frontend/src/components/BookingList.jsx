import React, { useState, useMemo, useRef, useEffect } from "react";
import { DateTime } from "luxon";
import { OFFICE_TIMEZONE } from "../utils/bookingUtils";
import { useAlert } from "../context/AlertContext";

// BookingList is a controlled component — it renders directly from the `bookings` prop
// and does not keep its own copy. This ensures it always reflects the parent state.
export default function BookingList({ bookings = [], authFetch, onRefresh }) {
  const [sortBy, setSortBy] = useState('date_asc');
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' or 'history'
  const [collapsedDates, setCollapsedDates] = useState(() => {
    const initialCollapsed = new Set();
    
    // Find the date with the next upcoming booking
    if (bookings.length > 0) {
      const now = DateTime.now().setZone(OFFICE_TIMEZONE);
      const future = bookings.filter(b => DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE) >= now);
      if (future.length > 0) {
        const nextBooking = future.sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];
        const nextBookingDate = DateTime.fromISO(nextBooking.start_time).setZone(OFFICE_TIMEZONE).toFormat('yyyy-MM-dd');
        
        // Collapse all dates except the one with next booking
        const allDates = new Set();
        bookings.forEach(b => {
          const dateKey = DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE).toFormat('yyyy-MM-dd');
          allDates.add(dateKey);
        });
        
        allDates.forEach(date => {
          if (date !== nextBookingDate) {
            initialCollapsed.add(date);
          }
        });
      }
    }
    
    return initialCollapsed;
  });
  const [pendingDeletes, setPendingDeletes] = useState({});
  const deleteTimers = useRef({});
  const [page, setPage] = useState(0);
  const pageSizeDates = 5;
  const { showAlert } = useAlert();
  const scrollPositions = useRef(new Map());

  const handleToggleCollapse = (dateKey) => {
    // Save current scroll position before toggle
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    scrollPositions.current.set(dateKey, currentScroll);
    
    const s = new Set(collapsedDates);
    const isCollapsing = !s.has(dateKey);
    
    if (s.has(dateKey)) {
      s.delete(dateKey);
    } else {
      s.add(dateKey);
    }
    setCollapsedDates(s);
    
    // If collapsing, restore scroll position after animation
    if (isCollapsing) {
      setTimeout(() => {
        window.scrollTo(0, currentScroll);
      }, 300);
    }
  };

  // Format helpers
  const formatTime = (isoString) => {
    try {
      return DateTime.fromISO(isoString).setZone(OFFICE_TIMEZONE).toFormat("HH:mm");
    } catch {
      return "Invalid time";
    }
  };

  // Filter bookings by tab
  const filteredBookings = useMemo(() => {
    const now = DateTime.now().setZone(OFFICE_TIMEZONE);
    if (activeTab === 'upcoming') {
      return bookings.filter(b => DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE) >= now);
    } else {
      return bookings.filter(b => DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE) < now);
    }
  }, [bookings, activeTab]);

  // Sorting logic
  const sortedBookings = useMemo(() => {
    const list = [...filteredBookings];
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
  }, [filteredBookings, sortBy]);

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

  // Next upcoming booking (only for upcoming tab)
  const now = DateTime.now().setZone(OFFICE_TIMEZONE);
  const nextUpcomingId = useMemo(() => {
    if (activeTab !== 'upcoming') return null;
    const future = sortedBookings.filter(b => DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE) >= now);
    if (future.length === 0) return null;
    return future.sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0].id;
  }, [sortedBookings, now, activeTab]);

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
      {/* Tabs */}
      <div className="bg-white border rounded">
        <div className="flex">
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'upcoming'
                ? 'text-blue-600 border-blue-600 bg-blue-50'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming ({bookings.filter(b => DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE) >= now).length})
          </button>
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'text-blue-600 border-blue-600 bg-blue-50'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab('history')}
          >
            History ({bookings.filter(b => DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE) < now).length})
          </button>
        </div>
      </div>

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
      {filteredBookings.length === 0 ? (
        <div className="bg-white border rounded p-8 text-center">
          <p className="text-gray-500">
            {activeTab === 'upcoming' ? 'No upcoming bookings found.' : 'No booking history found.'}
          </p>
        </div>
      ) : (
        visibleDateKeys.map(dateKey => {
          const items = grouped.get(dateKey) || [];
          const collapsed = collapsedDates.has(dateKey);
          return (
            <div key={dateKey} className="bg-white border rounded">
              <div 
                className="flex items-center justify-between px-4 py-2 border-b cursor-pointer hover:bg-gray-50"
                onClick={() => handleToggleCollapse(dateKey)}
              >
                <div>
                  <div className="text-sm font-medium">{DateTime.fromFormat(dateKey, 'yyyy-MM-dd').setZone(OFFICE_TIMEZONE).toFormat('dd.MM.yyyy')}</div>
                  <div className="text-xs text-gray-500">{items.length} booking{items.length !== 1 ? 's' : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true" data-slot="icon" className={`w-6 h-6 text-gray-500 transform transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"></path>
                  </svg>
                </div>
              </div>

              <div 
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  collapsed ? 'max-h-0' : 'max-h-96'
                }`}
              >
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
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
