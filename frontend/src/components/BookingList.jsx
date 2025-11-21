import React, { useState, useMemo, useRef, useEffect } from "react";
import { DateTime } from "luxon";
import { OFFICE_TIMEZONE } from "../utils/bookingUtils";
import { useAlert } from "../context/AlertContext";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { Heading, Text, Subheading } from "./ui/Typography";
import StatusBadge from "./StatusBadge";

// BookingList is a controlled component - it renders directly from the `bookings` prop
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
  const [page, setPage] = useState(0);
  const pageSizeDates = 5;
  const { showAlert } = useAlert();
  const scrollPositions = useRef(new Map());
  const [confirmCancel, setConfirmCancel] = useState(null); // { id, room_name, start_time, end_time }

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

  // Get booking status based on time
  const getBookingStatus = (booking) => {
    const now = DateTime.now().setZone(OFFICE_TIMEZONE);
    const startTime = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
    const endTime = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
    
    if (now < startTime) {
      return 'upcoming';
    } else if (now >= startTime && now < endTime) {
      return 'ongoing';
    } else {
      return 'completed';
    }
  };

  // Get card styling based on status
  const getCardStyles = (status, isNext) => {
    const baseStyles = "p-4 transition-all duration-200";
    
    if (isNext) {
      return `${baseStyles} ring-2 ring-green-300 bg-green-50 border-green-200`;
    }
    
    switch (status) {
      case 'upcoming':
        return `${baseStyles} border-blue-200 bg-blue-50`;
      case 'ongoing':
        return `${baseStyles} border-yellow-200 bg-yellow-50 ring-1 ring-yellow-300`;
      case 'completed':
        return `${baseStyles} border-gray-200 bg-gray-50`;
      default:
        return baseStyles;
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
        return list.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      case 'date_desc':
        return list.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
      case 'created_asc':
        return list.sort((a, b) => new Date(a.created_at || a.start_time).getTime() - new Date(b.created_at || b.start_time).getTime());
      case 'created_desc':
        return list.sort((a, b) => new Date(b.created_at || b.start_time).getTime() - new Date(a.created_at || b.start_time).getTime());
      default:
        return list.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
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

  // Cleanup effect
  useEffect(() => {
    return () => {
      // No cleanup needed
    };
  }, []);

  if (!bookings || bookings.length === 0) {
    return (
      <Card className="text-center py-8">
        <Text variant="muted">No bookings found.</Text>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <Card padding="p-0">
        <div className="flex">
          <button
            className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors rounded-tl-2xl ${
              activeTab === 'upcoming'
                ? 'text-blue-600 border-blue-600 bg-blue-50'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming ({bookings.filter(b => DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE) >= now).length})
          </button>
          <button
            className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors rounded-tr-2xl ${
              activeTab === 'history'
                ? 'text-blue-600 border-blue-600 bg-blue-50'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab('history')}
          >
            History ({bookings.filter(b => DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE) < now).length})
          </button>
        </div>
      </Card>

      {/* Sticky sort bar */}
      <div className="sticky top-4 z-40">
        <Card className="bg-white/90 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Text variant="default">Sort:</Text>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="date_asc">Date (oldest first)</option>
                <option value="date_desc">Date (newest first)</option>
                <option value="created_asc">Added (oldest first)</option>
                <option value="created_desc">Added (newest first)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Prev
              </Button>
              <Text variant="small" className="px-2">
                Page {page + 1} / {totalPages}
              </Text>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Grouped bookings by date */}
      {filteredBookings.length === 0 ? (
        <Card className="text-center py-12">
          <Text variant="muted">
            {activeTab === 'upcoming' ? 'No upcoming bookings found.' : 'No booking history found.'}
          </Text>
        </Card>
      ) : (
        visibleDateKeys.map(dateKey => {
          const items = grouped.get(dateKey) || [];
          const collapsed = collapsedDates.has(dateKey);
          return (
            <Card key={dateKey} padding="p-0" className="overflow-hidden">
              <div 
                className="flex items-center justify-between p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleToggleCollapse(dateKey)}
              >
                <div>
                  <Subheading className="text-base">
                    {DateTime.fromFormat(dateKey, 'yyyy-MM-dd').setZone(OFFICE_TIMEZONE).toFormat('dd.MM.yyyy')}
                  </Subheading>
                  <Text variant="small" className="mt-1">
                    {items.length} booking{items.length !== 1 ? 's' : ''}
                  </Text>
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
                    const status = getBookingStatus(booking);
                    return (
                      <Card 
                        key={booking.id} 
                        className={getCardStyles(status, isNext)}
                        hover={false}
                        padding=""
                        shadow=""
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Subheading className="text-base">
                                {booking.room_name || 'Unknown Room'}
                              </Subheading>
                              <StatusBadge status={status} size="sm" />
                            </div>
                            <Text variant="default">
                              {formatTime(booking.start_time)} — {formatTime(booking.end_time)} • {DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE).toRelative()}
                            </Text>
                          </div>
                          <div className="flex items-center gap-2">
                            {activeTab === 'upcoming' && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                  setConfirmCancel({
                                    id: booking.id,
                                    room_name: booking.room_name || 'Unknown Room',
                                    start_time: booking.start_time,
                                    end_time: booking.end_time
                                  });
                                }}
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })
      )}
      
      {/* Confirmation Modal */}
      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmCancel(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Cancel Booking</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to cancel this booking?
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="space-y-2 text-sm">
                <div className="font-medium">
                  Room: {confirmCancel.room_name}
                </div>
                <div>
                  Date: {DateTime.fromISO(confirmCancel.start_time).setZone(OFFICE_TIMEZONE).toFormat('dd.MM.yyyy')}
                </div>
                <div>
                  Time: {formatTime(confirmCancel.start_time)} — {formatTime(confirmCancel.end_time)}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 transition-all duration-300 border-2 border-gray-300 rounded-xl hover:bg-green-600 hover:border-green-600 hover:text-white"
                onClick={() => setConfirmCancel(null)}
              >
                Keep Booking
              </button>
              <button
                className="flex-1 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700"
                onClick={async () => {
                  try {
                    if (!authFetch) throw new Error('authFetch not provided');
                    const response = await authFetch(`/api/bookings/${confirmCancel.id}/`, { method: 'DELETE' });
                    console.log('Delete response:', response);
                    
                    // Handle 204 No Content response (successful deletion)
                    if (response === null || response === undefined || response === '') {
                      if (onRefresh) onRefresh();
                      showAlert('Booking cancelled successfully', { type: 'success' });
                      setConfirmCancel(null);
                    } else {
                      // Handle other response types
                      if (onRefresh) onRefresh();
                      showAlert('Booking cancelled successfully', { type: 'success' });
                      setConfirmCancel(null);
                    }
                  } catch (err) {
                    console.error('Failed to cancel booking:', err);
                    // Check if it's a JSON parse error (likely 204 response)
                    if (err.message.includes('JSON.parse') || err.message.includes('unexpected end of data')) {
                      // If JSON parse fails, it's probably a successful 204 response
                      if (onRefresh) onRefresh();
                      showAlert('Booking cancelled successfully', { type: 'success' });
                      setConfirmCancel(null);
                    } else {
                      showAlert('Failed to cancel booking. Please try again.', { type: 'error' });
                    }
                  }
                }}
              >
                Cancel Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
