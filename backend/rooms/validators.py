"""Shared booking business rules.

Single source of truth for the time-related booking rules, enforced both
by BookingSerializer (API) and Booking.clean() (admin / full_clean). They
had drifted apart: the serializer enforced office hours and duration
limits, the model only checked past/advance/overlap — and treated
cancelled bookings as blocking in its overlap check, unlike the
serializer and the DB partial constraint.
"""

from datetime import timedelta

from django.utils import timezone

OFFICE_START_HOUR = 8
OFFICE_END_HOUR = 22
MIN_DURATION_MINUTES = 15
MAX_DURATION_MINUTES = 8 * 60
DEFAULT_MAX_DAYS_AHEAD = 90


def booking_time_errors(start, end, *, now=None, max_days_ahead=DEFAULT_MAX_DAYS_AHEAD):
    """Return [(field, message), ...] for the shared time rules.

    Field keys match Booking's fields; "__all__" marks non-field errors
    (the duration limits have no single field). Callers decide the error
    surface: the serializer flattens messages into its "general" list,
    Booking.clean() raises them as a ValidationError dict.
    """
    if start is None or end is None:
        return []

    errors = []
    if now is None:
        now = timezone.now()

    if start >= end:
        errors.append(("end_time", "End time must be after start time."))
    if start < now:
        errors.append(("start_time", "Start time cannot be in the past."))

    # Office hours: 08:00 – 22:00 Berlin time; starts allowed until 21:45
    # so the booking still ends by 22:00. The end must land on the same
    # local day — otherwise an overnight slot like 21:45→05:45 would slip
    # through the hour checks.
    local_tz = timezone.get_default_timezone()
    start_local = start.astimezone(local_tz)
    end_local = end.astimezone(local_tz)
    if start_local.hour < OFFICE_START_HOUR or start_local.hour >= OFFICE_END_HOUR:
        errors.append(("start_time", "Bookings must start between 08:00 and 21:45."))
    if (
        end_local.date() != start_local.date()
        or end_local.hour > OFFICE_END_HOUR
        or (end_local.hour == OFFICE_END_HOUR and end_local.minute > 0)
    ):
        errors.append(("end_time", "Bookings must end by 22:00."))

    duration = (end - start).total_seconds() / 60
    if duration < MIN_DURATION_MINUTES:
        errors.append(("__all__", "Booking must be at least 15 minutes."))
    if duration > MAX_DURATION_MINUTES:
        errors.append(("__all__", "Booking cannot exceed 8 hours."))

    if start > now + timedelta(days=max_days_ahead):
        errors.append(
            (
                "start_time",
                f"Booking cannot be more than {max_days_ahead} days in advance.",
            )
        )

    return errors
