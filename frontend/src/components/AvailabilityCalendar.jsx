import React, { useState, useMemo } from "react";
import { DateTime } from "luxon";
import { OFFICE_TIMEZONE, OFFICE_HOURS } from "../utils/bookingUtils";
import { Text } from "./ui/Typography";
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

  const getStatusColor = (status) => {
    switch (status) {
      case "available":
        return "bg-green-500/80 hover:bg-green-500";
      case "busy":
        return "bg-yellow-500/80 hover:bg-yellow-500";
      case "full":
        return "bg-red-500/80 hover:bg-red-500";
      default:
        return "bg-gray-300";
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
    <div className="space-y-4">
      <div>
        <Text variant="small" className="uppercase tracking-[0.2em] text-accent-secondary/60 mb-4">
          This Week's Availability - Click to see free slots
        </Text>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dateKey = day.toFormat("yyyy-MM-dd");
            const dayData = dayAvailability[dateKey];
            const isToday = day.hasSame(today, "day");
            const isSelected = selectedDay === dateKey;

            if (!dayData) return null;

            return (
              <div
                key={dateKey}
                className="relative"
              >
                <div
                  className={`relative group flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? "border-accent-primary ring-2 ring-accent-primary/50 bg-accent-primary/5"
                      : isToday
                      ? "border-accent-primary/50 ring-1 ring-accent-primary/30 hover:bg-surface-muted/30"
                      : "border-border-subtle hover:border-accent-primary/30 hover:bg-surface-muted/20"
                  }`}
                  onClick={() => handleDayClick(dateKey)}
                  onMouseEnter={(e) => handleMouseEnter(dateKey, e)}
                  onMouseLeave={handleMouseLeave}
                >
                  {/* Day of week */}
                  <p className="text-xs font-semibold text-accent-secondary/70">
                    {day.toFormat("EEE")}
                  </p>

                  {/* Date */}
                  <p className="text-sm font-bold text-accent-secondary my-1">
                    {day.toFormat("d")}
                  </p>

                  {/* Status indicator */}
                  <div
                    className={`w-8 h-8 rounded-full ${getStatusColor(dayData.status)} transition-colors duration-200 flex items-center justify-center`}
                  >
                    <span className="text-xs font-bold text-white">
                      {dayData.occupancyPercent}%
                    </span>
                  </div>

                  {/* Month indicator for clarity */}
                  <p className="text-xs text-accent-secondary/50 mt-1">
                    {day.toFormat("MMM")}
                  </p>

                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-accent-primary rounded-full" />
                  )}
                </div>

                {/* Tooltip */}
                {tooltipDay === dateKey && dayData && (
                  <div
                    className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none"
                    style={{
                      animation: "fadeIn 0.2s ease-in-out",
                    }}
                  >
                    <div className="bg-surface-base border border-border-subtle rounded-lg shadow-lg p-3 whitespace-nowrap">
                      <p className="text-sm font-semibold text-accent-secondary mb-1">
                        {day.toFormat("EEEE, dd MMMM")}
                      </p>
                      <p className="text-xs text-accent-secondary/70">
                        Status: <span className="font-semibold text-accent-primary">{getStatusLabel(dayData.status)}</span>
                      </p>
                      <p className="text-xs text-accent-secondary/70">
                        Free slots: <span className="font-semibold">{dayData.freeSlots}</span>
                      </p>
                      <p className="text-xs text-accent-secondary/70">
                        Occupancy: <span className="font-semibold">{dayData.occupancyPercent}%</span>
                      </p>
                      <p className="text-xs text-accent-primary/70 mt-2 italic">
                        Click to view free slots
                      </p>
                    </div>
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-surface-base border-r border-b border-border-subtle rotate-45" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day details */}
      {selectedDay && dayAvailability[selectedDay] && (
        <Card className="p-6 border-accent-primary/30 bg-accent-primary/5">
          <div className="mb-4">
            <Text variant="small" className="uppercase tracking-[0.2em] text-accent-secondary/60 mb-2">
              Selected Date
            </Text>
            <h3 className="text-xl font-bold text-accent-secondary">
              {dayAvailability[selectedDay].date.toFormat("EEEE, dd MMMM yyyy")}
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-accent-secondary/60 mb-1">Status</p>
              <p className="text-lg font-bold text-accent-primary">
                {getStatusLabel(dayAvailability[selectedDay].status)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-accent-secondary/60 mb-1">Free Slots</p>
              <p className="text-lg font-bold text-green-600">
                {dayAvailability[selectedDay].freeSlots}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-accent-secondary/60 mb-1">Occupancy</p>
              <p className="text-lg font-bold text-accent-secondary">
                {dayAvailability[selectedDay].occupancyPercent}%
              </p>
            </div>
          </div>

          <Text variant="small" className="text-accent-secondary/70">
            {dayAvailability[selectedDay].freeSlots > 0
              ? `There are ${dayAvailability[selectedDay].freeSlots} available 15-minute slots on this day. Click "Book this room" to reserve a time.`
              : "This day is fully booked. Please select another day."}
          </Text>
        </Card>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 mt-6 p-4 bg-surface-muted/50 rounded-xl">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500/80" />
          <Text variant="small" className="text-accent-secondary/70">Available (0-50%)</Text>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-yellow-500/80" />
          <Text variant="small" className="text-accent-secondary/70">Busy (50-80%)</Text>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500/80" />
          <Text variant="small" className="text-accent-secondary/70">Full (80-100%)</Text>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translate(-50%, 4px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </div>
  );
}
