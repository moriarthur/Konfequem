import React, { useState, useMemo } from "react";
import { DateTime } from "luxon";
import { OFFICE_TIMEZONE, OFFICE_HOURS } from "../utils/bookingUtils";
import { Text, Heading } from "./ui/Typography";
import Card from "./ui/Card";

export default function AvailabilityCalendar({ bookings = [], selectedRoom = null, onDaySelect = null }) {
  const [tooltipDay, setTooltipDay] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Calculate availability for each day
  const dayAvailability = useMemo(() => {
    const availability = {};
    const today = DateTime.now().setZone(OFFICE_TIMEZONE);
    const maxDate = today.plus({ days: 90 });

    for (let d = today; d <= maxDate; d = d.plus({ days: 1 })) {
      const dateKey = d.toFormat("yyyy-MM-dd");
      
      // Get bookings for this day and room
      const dayBookings = bookings.filter((booking) => {
        const bookingDate = DateTime.fromISO(booking.start_time)
          .setZone(OFFICE_TIMEZONE)
          .toFormat("yyyy-MM-dd");
        return bookingDate === dateKey && (!selectedRoom || booking.room === selectedRoom);
      });

      // Calculate total booked minutes
      const totalBookedMinutes = dayBookings.reduce((sum, booking) => {
        const start = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
        const end = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
        return sum + end.diff(start, "minutes").minutes;
      }, 0);

      // Calculate total available minutes (office hours)
      const officeHoursMinutes = (OFFICE_HOURS.end - OFFICE_HOURS.start) * 60;

      // Calculate free slots (approximate)
      const freeMinutes = Math.max(0, officeHoursMinutes - totalBookedMinutes);
      const occupancyPercent = (totalBookedMinutes / officeHoursMinutes) * 100;

      // Determine status: green (0-50%), yellow (50-80%), red (80-100%)
      let status = "available";
      if (occupancyPercent >= 80) {
        status = "full";
      } else if (occupancyPercent >= 50) {
        status = "busy";
      }

      availability[dateKey] = {
        status,
        occupancyPercent: Math.round(occupancyPercent),
        freeSlots: Math.floor(freeMinutes / OFFICE_HOURS.minDuration),
        date: d,
        bookings: dayBookings, // Store the actual bookings for the selected day
      };
    }

    return availability;
  }, [bookings, selectedRoom]);

  const handleMouseEnter = (dateKey, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
    setTooltipDay(dateKey);
  };

  const handleMouseLeave = () => {
    setTooltipDay(null);
  };

  const handleDayClick = (dateKey) => {
    // Toggle: если день уже выбран, десelectить его
    if (selectedDay === dateKey) {
      setSelectedDay(null);
    } else {
      setSelectedDay(dateKey);
      if (onDaySelect) {
        onDaySelect(dateKey, dayAvailability[dateKey]);
      }
    }
  };

  // Get current week
  const today = DateTime.now().setZone(OFFICE_TIMEZONE);
  const weekStart = today.startOf("week").plus({ days: 1 }); // Monday
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    weekDays.push(weekStart.plus({ days: i }));
  }

  const getStatusStyles = (status) => {
    switch (status) {
      case "available":
        return {
          bg: "bg-status-success/10",
          border: "border-status-success/20",
          text: "text-status-success",
          fill: "bg-status-success/30",
          fillHover: "hover:bg-status-success/40",
          dot: "bg-status-success",
        };
      case "busy":
        return {
          bg: "bg-status-warning/10",
          border: "border-status-warning/20",
          text: "text-status-warning",
          fill: "bg-status-warning/30",
          fillHover: "hover:bg-status-warning/40",
          dot: "bg-status-warning",
        };
      case "full":
        return {
          bg: "bg-status-danger/10",
          border: "border-status-danger/20",
          text: "text-status-danger",
          fill: "bg-status-danger/30",
          fillHover: "hover:bg-status-danger/40",
          dot: "bg-status-danger",
        };
      default:
        return {
          bg: "bg-status-neutral/10",
          border: "border-status-neutral/20",
          text: "text-status-neutral",
          fill: "bg-status-neutral/30",
          fillHover: "hover:bg-status-neutral/40",
        };
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "available":
        return "Available";
      case "busy":
        return "Busy";
      case "full":
        return "Full";
      default:
        return "Unknown";
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-6">
        <Text variant="small" className="uppercase tracking-[0.2em] text-accent-secondary/60">
          This Week's Availability
        </Text>
        <Text variant="muted" className="mt-1">
          Click any day to see detailed availability
        </Text>
      </div>

      <div className="grid grid-cols-7 gap-3 mb-8">
        {weekDays.map((day) => {
          const dateKey = day.toFormat("yyyy-MM-dd");
          const dayData = dayAvailability[dateKey];
          const isToday = day.hasSame(today, "day");
          const isSelected = selectedDay === dateKey;
          const statusStyles = getStatusStyles(dayData?.status);

          if (!dayData) return null;

          return (
            <div
              key={dateKey}
              className="relative group"
            >
              <div
                className={`
                  relative flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer
                  transition-all duration-300 transform hover:scale-105
                  ${isSelected
                    ? "border-accent-primary bg-accent-primary/5 shadow-soft"
                    : isToday
                    ? `border-accent-primary/50 bg-surface-muted/30 ${statusStyles.fillHover}`
                    : `border-border-subtle bg-surface-base ${statusStyles.fillHover}`
                  }
                `}
                onClick={() => handleDayClick(dateKey)}
                onMouseEnter={(e) => handleMouseEnter(dateKey, e)}
                onMouseLeave={handleMouseLeave}
              >
                {/* Day label */}
                <Text variant="small" className="font-medium text-accent-secondary/70 mb-1">
                  {day.toFormat("EEE")}
                </Text>

                {/* Date number */}
                <Heading level={3} className="text-2xl text-accent-secondary mb-3">
                  {day.toFormat("d")}
                </Heading>

                {/* Availability progress bar */}
                <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full transition-all duration-500 ${statusStyles.fill}`}
                    style={{ width: `${dayData.occupancyPercent}%` }}
                  />
                </div>

                {/* Occupancy percentage */}
                <Text
                  variant="small"
                  className={`font-semibold ${statusStyles.text}`}
                >
                  {dayData.occupancyPercent}%
                </Text>

                {/* Month indicator */}
                <Text variant="muted" className="text-xs mt-1">
                  {day.toFormat("MMM")}
                </Text>

                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent-primary rounded-full border-2 border-surface-base shadow-soft" />
                )}

                {/* Today indicator */}
                {isToday && !isSelected && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-accent-secondary/40 rounded-full" />
                )}
              </div>

              {/* Simplified tooltip - only show quick status */}
              {tooltipDay === dateKey && dayData && !isSelected && (
                <div
                  className="absolute bottom-full left-1/2 transform -translate-x-1/2 z-50 mb-2 pointer-events-none animate-fadeIn"
                >
                  <div className={`px-3 py-2 rounded-lg shadow-md border ${statusStyles.border} ${statusStyles.bg} backdrop-blur-sm`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusStyles.dot}`} />
                      <Text variant="small" className={`font-medium ${statusStyles.text} whitespace-nowrap`}>
                        {getStatusLabel(dayData.status)}
                      </Text>
                      {dayData.freeSlots > 0 && (
                        <Text variant="small" className="text-accent-secondary/60 whitespace-nowrap">
                          {dayData.freeSlots} slots
                        </Text>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected day details */}
      {selectedDay && dayAvailability[selectedDay] && (
        <Card className={`border-2 ${getStatusStyles(dayAvailability[selectedDay].status).border} ${getStatusStyles(dayAvailability[selectedDay].status).bg} p-6 animate-fadeIn`}>
          <div className="mb-6">
            <Text variant="small" className="uppercase tracking-[0.2em] text-accent-secondary/60 mb-2">
              Selected Date Details
            </Text>
            <h3 className="text-xl font-bold text-accent-secondary">
              {dayAvailability[selectedDay].date.toFormat("EEEE, MMMM d, yyyy")}
            </h3>
          </div>

          {/* Time-based visualization */}
          <div className="mb-6">
            <Text variant="small" className="font-semibold text-accent-secondary mb-3">Hourly Availability</Text>
            <div className="grid grid-cols-8 gap-1 mb-2">
              {(() => {
                const hours = [];
                for (let hour = OFFICE_HOURS.start; hour < OFFICE_HOURS.end; hour++) {
                  const hourStr = `${hour.toString().padStart(2, '0')}:00`;
                  const isBooked = dayAvailability[selectedDay].bookings.some(booking => {
                    const bookingStart = DateTime.fromISO(booking.start_time).hour;
                    const bookingEnd = DateTime.fromISO(booking.end_time).hour;
                    return hour >= bookingStart && hour < bookingEnd;
                  });
                  hours.push(
                    <div key={hour} className="relative">
                      <div className={`h-12 rounded ${isBooked ? 'bg-status-danger/30 border border-status-danger/50' : 'bg-status-success/30 border border-status-success/50'} hover:opacity-80 transition-opacity`}>
                        <Text variant="small" className="text-xs text-center mt-1 font-medium">
                          {hourStr}
                        </Text>
                      </div>
                    </div>
                  );
                }
                return hours;
              })()}
            </div>
          </div>

          {/* Stats overview */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${getStatusStyles(dayAvailability[selectedDay].status).bg} mb-2`}>
                <Heading level={2} className={`text-3xl ${getStatusStyles(dayAvailability[selectedDay].status).text}`}>
                  {dayAvailability[selectedDay].occupancyPercent}%
                </Heading>
              </div>
              <Text variant="muted" className="text-sm">Occupancy</Text>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-muted mb-2">
                <Heading level={2} className="text-3xl text-accent-primary">
                  {dayAvailability[selectedDay].freeSlots}
                </Heading>
              </div>
              <Text variant="muted" className="text-sm">Free Slots</Text>
            </div>
            <div className="text-center">
              <div className={`inline-flex items-center justify-center px-4 py-2 rounded-full border ${getStatusStyles(dayAvailability[selectedDay].status).border} ${getStatusStyles(dayAvailability[selectedDay].status).bg}`}>
                <Text variant="small" className={`font-semibold ${getStatusStyles(dayAvailability[selectedDay].status).text}`}>
                  {getStatusLabel(dayAvailability[selectedDay].status)}
                </Text>
              </div>
              <Text variant="muted" className="text-sm mt-2">Status</Text>
            </div>
          </div>

          {/* Existing bookings */}
          {dayAvailability[selectedDay].bookings && dayAvailability[selectedDay].bookings.length > 0 && (
            <div className="mb-6">
              <Text variant="small" className="font-semibold text-accent-secondary mb-3">Existing Bookings</Text>
              <div className="space-y-2">
                {dayAvailability[selectedDay].bookings.map((booking, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-surface-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-status-danger"></div>
                      <Text variant="small" className="font-medium">
                        {DateTime.fromISO(booking.start_time).toFormat("HH:mm")} - {DateTime.fromISO(booking.end_time).toFormat("HH:mm")}
                      </Text>
                    </div>
                    <Text variant="small" className="text-accent-secondary/70">
                      {booking.room_name || booking.room || 'Room'}
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Text variant="muted" className="text-center mb-4">
            {dayAvailability[selectedDay].freeSlots > 0
              ? `${dayAvailability[selectedDay].freeSlots} time slots available. Continue to booking to reserve your preferred time.`
              : "All time slots are booked for this day. Please select another date."}
          </Text>

          {/* Legend moved inside the selected card */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-surface-muted/30 rounded-xl">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-status-success/5 border border-status-success/10">
              <div className="w-3 h-3 rounded-full bg-status-success" />
              <Text variant="small" className="text-status-success-text font-medium">Available (0-50%)</Text>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-status-warning/5 border border-status-warning/10">
              <div className="w-3 h-3 rounded-full bg-status-warning" />
              <Text variant="small" className="text-status-warning-text font-medium">Busy (50-80%)</Text>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-status-danger/5 border border-status-danger/10">
              <div className="w-3 h-3 rounded-full bg-status-danger" />
              <Text variant="small" className="text-status-danger-text font-medium">Full (80-100%)</Text>
            </div>
          </div>
        </Card>
      )}

      </Card>
  );
}
