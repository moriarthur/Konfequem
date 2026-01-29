import React, { useState, useMemo, useRef, useEffect } from "react";
import { DateTime } from "luxon";
import { OFFICE_TIMEZONE } from "../utils/bookingUtils";
import { useAlert } from "../context/AlertContext";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { Text, Subheading } from "./ui/Typography";
import StatusBadge from "./StatusBadge";

// BookingList is a controlled component - it renders directly from the `bookings` prop
// and does not keep its own copy. This ensures it always reflects the parent state.
export default function BookingList({ bookings = [], authFetch, onRefresh }) {
  const [sortByUpcoming, setSortByUpcoming] = useState('date_asc');
  const [sortByHistory, setSortByHistory] = useState('date_desc');
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

  // Infinite scroll state
  const [displayedCount, setDisplayedCount] = useState(10); // Number of bookings to show
  const loadMoreRef = useRef(null); // Ref for the intersection observer target
  const { showAlert } = useAlert();
  const scrollPositions = useRef(new Map());
  const [confirmCancel, setConfirmCancel] = useState(null); // { id, room_name, start_time, end_time }

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setDisplayedCount(prev => Math.min(prev + 10, sortedBookings.length));
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [sortedBookings.length]);

  // Reset displayed count when tab changes
  useEffect(() => {
    setDisplayedCount(10);
  }, [activeTab]);

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
      return `${baseStyles} ring-2 ring-status-success/50 bg-status-success/10 border-status-success/20`;
    }

    switch (status) {
      case 'upcoming':
        return `${baseStyles} border-status-info/20 bg-status-info/10`;
      case 'ongoing':
        return `${baseStyles} border-status-warning/20 bg-status-warning/10 ring-1 ring-status-warning/50`;
      case 'completed':
        return `${baseStyles} border-status-neutral/20 bg-status-neutral/10`;
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
    const sortBy = activeTab === 'history' ? sortByHistory : sortByUpcoming;
    switch (sortBy) {
      case 'date_asc':
        return list.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      case 'date_desc':
        return list.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
      case 'created_asc':
        return list.sort((a, b) => new Date(a.created_at || a.start_time).getTime() - new Date(b.created_at || b.start_time).getTime());
      case 'created_desc':
        return list.sort((a, b) => new Date(b.created_at || a.start_time).getTime() - new Date(a.created_at || b.start_time).getTime());
      default:
        return list.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }
  }, [filteredBookings, sortByUpcoming, sortByHistory, activeTab]);

  // Group bookings by date (only for displayed bookings)
  const displayedBookings = sortedBookings.slice(0, displayedCount);
  const grouped = useMemo(() => {
    const map = new Map();
    for (const b of displayedBookings) {
      const key = DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE).toFormat('yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    }
    return map;
  }, [displayedBookings]);

  const dateKeys = useMemo(() => Array.from(grouped.keys()), [grouped]);

  // Next upcoming booking (only for upcoming tab)
  const now = DateTime.now().setZone(OFFICE_TIMEZONE);
  const nextUpcomingId = useMemo(() => {
    if (activeTab !== 'upcoming') return null;
    const future = sortedBookings.filter(b => DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE) >= now);
    if (future.length === 0) return null;
    return future.sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0].id;
  }, [sortedBookings, now, activeTab]);

  // Check if there are more bookings to load
  const hasMore = displayedCount < sortedBookings.length;

  if (!bookings || bookings.length === 0) {
    return (
      <Card className="text-center py-8">
        <Text variant="muted">No bookings found.</Text>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <Card padding="p-1" className="border border-border-subtle shadow-soft rounded-xl">
        <div className="flex gap-0">
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'upcoming'
                ? 'text-accent-primary border border-accent-primary bg-accent-primary/10'
                : 'text-accent-secondary/60 border border-transparent hover:text-accent-secondary hover:bg-surface-muted'
            }`}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming ({bookings.filter(b => DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE) >= now).length})
          </button>
          <div className="w-px bg-border-subtle/30 mx-1" />
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'history'
                ? 'text-accent-primary border border-accent-primary bg-accent-primary/10'
                : 'text-accent-secondary/60 border border-transparent hover:text-accent-secondary hover:bg-surface-muted'
            }`}
            onClick={() => setActiveTab('history')}
          >
            History ({bookings.filter(b => DateTime.fromISO(b.start_time).setZone(OFFICE_TIMEZONE) < now).length})
          </button>
        </div>
      </Card>

      {/* Sort bar - simplified for mobile */}
      <div className="flex items-center justify-between px-2">
        <select
          value={activeTab === 'history' ? sortByHistory : sortByUpcoming}
          onChange={(e) => {
            if (activeTab === 'history') setSortByHistory(e.target.value);
            else setSortByUpcoming(e.target.value);
          }}
          className="border border-border-subtle rounded-lg px-3 py-2 text-sm bg-surface-base text-accent-secondary focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary"
        >
          <option value="date_asc">Date (oldest first)</option>
          <option value="date_desc">Date (newest first)</option>
          <option value="created_asc">Added (oldest first)</option>
          <option value="created_desc">Added (newest first)</option>
        </select>
        <Text variant="small" className="text-accent-secondary/60">
          Showing {displayedBookings.length} of {sortedBookings.length}
        </Text>
      </div>

      {/* Grouped bookings by date */}
      {filteredBookings.length === 0 ? (
        <Card className="text-center py-12 border border-border-subtle">
          <Text variant="muted">
            {activeTab === 'upcoming' ? 'No upcoming bookings found.' : 'No booking history found.'}
          </Text>
        </Card>
      ) : (
        <>
          {dateKeys.map(dateKey => {
            const items = grouped.get(dateKey) || [];
            const collapsed = collapsedDates.has(dateKey);
            return (
              <Card key={dateKey} padding="p-0" className="overflow-hidden border border-border-subtle booking-date-group">
                <div
                  className="flex items-center justify-between p-4 border-b border-border-subtle cursor-pointer hover:bg-surface-muted transition-colors"
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
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true" className={`w-5 h-5 text-accent-secondary/60 transform transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>

                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    collapsed ? 'max-h-0' : 'max-h-96'
                  }`}
                >
                  <div className="p-4 space-y-3 max-h-96 overflow-y-auto pr-1 date-scroll">
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
          })}

          {/* Load more trigger */}
          {hasMore && (
            <div
              ref={loadMoreRef}
              className="py-4 text-center"
            >
              <div className="inline-flex items-center gap-2 text-accent-secondary/60">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <Text variant="small">Loading more...</Text>
              </div>
            </div>
          )}

          {/* End of list indicator */}
          {!hasMore && sortedBookings.length > 0 && (
            <div className="py-4 text-center">
              <Text variant="small" className="text-accent-secondary/40">
                You've seen all bookings
              </Text>
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmCancel(null)}
          />
          <div className="relative bg-surface-base border border-border-subtle rounded-2xl shadow-soft p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Cancel Booking</h3>
            <p className="text-accent-secondary/70 mb-6">
              Are you sure you want to cancel this booking?
            </p>
            <div className="bg-surface-muted rounded-xl p-4 mb-6">
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
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmCancel(null)}
              >
                Keep Booking
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={async () => {
                  try {
                    if (!authFetch) throw new Error('authFetch not provided');
                    const response = await authFetch(`/api/bookings/${confirmCancel.id}/`, { method: 'DELETE' });

                    // Handle successful deletion
                    if (response === null || response === undefined || response === '') {
                      if (onRefresh) onRefresh();
                      showAlert('Booking cancelled successfully', { type: 'success' });
                      setConfirmCancel(null);
                    } else {
                      if (onRefresh) onRefresh();
                      showAlert('Booking cancelled successfully', { type: 'success' });
                      setConfirmCancel(null);
                    }
                  } catch (err) {
                    // Check if it's a JSON parse error (likely 204 response)
                    if (err.message.includes('JSON.parse') || err.message.includes('unexpected end of data')) {
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
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
