import { useMemo } from "react";
import { DateTime } from "luxon";
import { OFFICE_TIMEZONE, OFFICE_HOURS } from "../utils/bookingUtils";
import type { BookingData } from "../utils/bookingUtils";
import { Text } from "./ui/Typography";

type AvailabilityStatus = "available" | "busy" | "full";

interface DayAvailability {
  date: DateTime;
  day: string;
  occupancyPercent: number;
  status: AvailabilityStatus;
}

interface RoomMiniAvailabilityProps {
  bookings?: BookingData[];
  roomId?: number | null;
}

export default function RoomMiniAvailability({ bookings = [], roomId = null }: RoomMiniAvailabilityProps) {
  const weeklyAvailability = useMemo<DayAvailability[]>(() => {
    const availability: DayAvailability[] = [];
    const today = DateTime.now().setZone(OFFICE_TIMEZONE);

    for (let i = 0; i < 7; i++) {
      const date = today.plus({ days: i });
      const dateKey = date.toFormat("yyyy-MM-dd");

      const dayBookings = bookings.filter((booking) => {
        const bookingDate = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE).toFormat("yyyy-MM-dd");
        return bookingDate === dateKey && booking.room === roomId;
      });

      const totalBookedMinutes = dayBookings.reduce((sum, booking) => {
        const start = DateTime.fromISO(booking.start_time).setZone(OFFICE_TIMEZONE);
        const end = DateTime.fromISO(booking.end_time).setZone(OFFICE_TIMEZONE);
        return sum + end.diff(start, "minutes").minutes;
      }, 0);

      const officeHoursMinutes = (OFFICE_HOURS.end - OFFICE_HOURS.start) * 60;
      const occupancyPercent = Math.round((totalBookedMinutes / officeHoursMinutes) * 100);

      availability.push({
        date,
        day: date.toFormat("EEE"),
        occupancyPercent,
        status: occupancyPercent >= 80 ? "full" : occupancyPercent >= 50 ? "busy" : "available",
      });
    }

    return availability;
  }, [bookings, roomId]);

  const getStatusColor = (status: AvailabilityStatus): string => {
    switch (status) {
      case "available": return "bg-status-success";
      case "busy": return "bg-status-warning";
      case "full": return "bg-status-danger";
    }
  };

  return (
    <div className="mt-4">
      <Text variant="small" className="font-medium text-accent-secondary/70 mb-3 block">
        This Week
      </Text>
      <div className="space-y-2 mb-3">
        {weeklyAvailability.map((day, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-xs font-medium text-accent-secondary/60 w-8 flex-shrink-0">{day.day}</span>
            <div className="flex-1 h-2 bg-surface-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${getStatusColor(day.status)}`}
                style={{ width: `${Math.min(day.occupancyPercent, 100)}%` }}
              />
            </div>
            <span className="text-xs font-medium text-accent-secondary/60 w-8 text-right flex-shrink-0">
              {day.occupancyPercent}%
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-xs text-accent-secondary/50">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-status-success flex-shrink-0" />
          <span className="whitespace-nowrap">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-status-warning flex-shrink-0" />
          <span className="whitespace-nowrap">Busy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-status-danger flex-shrink-0" />
          <span className="whitespace-nowrap">Full</span>
        </div>
      </div>
    </div>
  );
}
