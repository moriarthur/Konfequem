"""
Unit tests for Booking model validation.

Tests validate:
- Past date rejection
- Office hours, duration and advance limits (shared validator)
- Overlap prevention (cancelled bookings don't block)
- 90-day advance booking limit
"""

import pytest
from datetime import timedelta
from django.utils import timezone
from django.core.exceptions import ValidationError
from rooms.models import Booking, Room
from rooms.models_users import Organization
from django.contrib.auth import get_user_model

User = get_user_model()


def berlin_at(days_ahead, hour, minute=0):
    """Deterministic aware datetime: N days from now at a fixed Berlin hour.

    Booking rules are enforced in Berlin local time, so tests pin the
    local hour instead of deriving times from "now + timedelta" — those
    drift in and out of office hours depending on when the suite runs.
    """
    local_now = timezone.now().astimezone(timezone.get_default_timezone())
    return (local_now + timedelta(days=days_ahead)).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    )


@pytest.mark.unit
class TestBookingModel:
    """Test suite for Booking model validation."""

    # ========================================================================
    # Past Date Rejection Tests
    # ========================================================================

    # ========================================================================
    # Tenant Consistency Tests (admin/ORM writes — API checks the same in
    # the serializer; a mismatched row would leak a foreign room name into
    # the org's availability feed)
    # ========================================================================

    def test_clean_rejects_room_from_other_organization(self, db, user, organization):
        foreign_org = Organization.objects.create(name="Foreign", slug="foreign-tc")
        foreign_room = Room.objects.create(
            name="Foreign Room", organization=foreign_org, capacity=4
        )

        booking = Booking(
            room=foreign_room,
            user=user,
            organization=organization,
            start_time=berlin_at(1, 10),
            date=berlin_at(1, 10).date(),
            end_time=berlin_at(1, 11),
        )

        with pytest.raises(ValidationError) as exc_info:
            booking.full_clean()

        assert "Room does not belong" in str(exc_info.value)

    def test_clean_rejects_user_from_other_organization(self, db, user, room):
        foreign_org = Organization.objects.create(name="Foreign", slug="foreign-tc2")
        colleague = User.objects.create_user(
            username="tc-colleague",
            email="tc-colleague@example.com",
            password="tc-pass-123456",
            organization=foreign_org,
        )

        booking = Booking(
            room=room,
            user=colleague,
            organization=user.organization,
            start_time=berlin_at(1, 10),
            date=berlin_at(1, 10).date(),
            end_time=berlin_at(1, 11),
        )

        with pytest.raises(ValidationError) as exc_info:
            booking.full_clean()

        assert "User does not belong" in str(exc_info.value)

    def test_clean_accepts_consistent_organization(self, db, user, room, organization):
        booking = Booking(
            room=room,
            user=user,
            organization=organization,
            start_time=berlin_at(1, 10),
            date=berlin_at(1, 10).date(),
            end_time=berlin_at(1, 11),
        )

        booking.full_clean()  # Should not raise

    def test_booking_rejects_past_start_time(self, db, user, room, organization):
        """Test that booking cannot start in the past."""
        past_time = timezone.now() - timedelta(hours=1)

        booking = Booking(
            room=room,
            user=user,
            start_time=past_time,
            end_time=timezone.now(),
            organization=organization,
        )

        with pytest.raises(ValidationError) as exc_info:
            booking.full_clean()

        assert "start_time" in exc_info.value.message_dict
        assert "past" in str(exc_info.value).lower()

    def test_booking_rejects_end_time_before_start_time(
        self, db, user, room, utc_now, organization
    ):
        """Test that end_time must be after start_time."""
        booking = Booking(
            room=room,
            user=user,
            start_time=utc_now + timedelta(hours=2),
            end_time=utc_now + timedelta(hours=1),  # Before start
            organization=organization,
        )

        with pytest.raises(ValidationError) as exc_info:
            booking.full_clean()

        assert "end_time" in exc_info.value.message_dict

    def test_booking_rejects_equal_start_and_end_time(
        self, db, user, room, utc_now, organization
    ):
        """Test that end_time cannot equal start_time."""
        same_time = utc_now + timedelta(hours=1)
        booking = Booking(
            room=room,
            user=user,
            start_time=same_time,
            end_time=same_time,  # Same as start
            organization=organization,
        )

        with pytest.raises(ValidationError) as exc_info:
            booking.full_clean()

        assert "end_time" in exc_info.value.message_dict

    # ========================================================================
    # Duration Constraint Tests
    # ========================================================================

    def test_booking_allows_valid_duration(
        self, db, user, room, future_start_time, organization
    ):
        """Test that booking accepts valid duration (2 hours)."""
        booking = Booking(
            room=room,
            user=user,
            start_time=future_start_time,
            date=future_start_time.date(),
            end_time=future_start_time + timedelta(hours=2),
            organization=organization,
        )

        booking.full_clean()  # Should not raise
        booking.save()

        assert booking.pk is not None
        assert booking.end_time - booking.start_time == timedelta(hours=2)

    def test_booking_allows_minimum_duration(self, db, user, room, organization):
        """Test that booking can be exactly 15 minutes."""
        start = berlin_at(1, 10)
        booking = Booking(
            room=room,
            user=user,
            start_time=start,
            date=start.date(),
            end_time=start + timedelta(minutes=15),
            organization=organization,
        )

        booking.full_clean()  # Should not raise
        assert booking.end_time - booking.start_time == timedelta(minutes=15)

    def test_booking_rejects_short_duration(self, db, user, room, organization):
        """Test that a sub-15-minute booking is rejected (shared rule)."""
        start = berlin_at(1, 10)
        booking = Booking(
            room=room,
            user=user,
            start_time=start,
            date=start.date(),
            end_time=start + timedelta(minutes=5),
            organization=organization,
        )

        with pytest.raises(ValidationError) as exc_info:
            booking.full_clean()

        assert "at least 15 minutes" in str(exc_info.value)

    def test_booking_allows_maximum_duration(self, db, user, room, organization):
        """Test that booking can be up to 8 hours."""
        start = berlin_at(1, 10)
        booking = Booking(
            room=room,
            user=user,
            start_time=start,
            date=start.date(),
            end_time=start + timedelta(hours=8),
            organization=organization,
        )

        booking.full_clean()  # Should not raise
        assert booking.end_time - booking.start_time == timedelta(hours=8)

    def test_booking_rejects_overlong_duration(self, db, user, room, organization):
        """Test that a booking longer than 8 hours is rejected (shared rule)."""
        start = berlin_at(1, 10)
        booking = Booking(
            room=room,
            user=user,
            start_time=start,
            date=start.date(),
            end_time=start + timedelta(hours=9),
            organization=organization,
        )

        with pytest.raises(ValidationError) as exc_info:
            booking.full_clean()

        assert "cannot exceed 8 hours" in str(exc_info.value)

    # ========================================================================
    # Office Hours Tests (shared validator — previously serializer-only)
    # ========================================================================

    def test_booking_rejects_start_before_office_hours(
        self, db, user, room, organization
    ):
        booking = Booking(
            room=room,
            user=user,
            start_time=berlin_at(1, 7),
            date=berlin_at(1, 7).date(),
            end_time=berlin_at(1, 9),
            organization=organization,
        )

        with pytest.raises(ValidationError) as exc_info:
            booking.full_clean()

        assert "start_time" in exc_info.value.message_dict
        assert "between 08:00 and 21:45" in str(exc_info.value)

    def test_booking_rejects_end_after_office_hours(self, db, user, room, organization):
        booking = Booking(
            room=room,
            user=user,
            start_time=berlin_at(1, 21),
            date=berlin_at(1, 21).date(),
            end_time=berlin_at(2, 0, minute=30),
            organization=organization,
        )

        with pytest.raises(ValidationError) as exc_info:
            booking.full_clean()

        assert "end_time" in exc_info.value.message_dict
        assert "end by 22:00" in str(exc_info.value)

    def test_booking_allows_last_possible_slot(self, db, user, room, organization):
        """21:45 start (min duration) through 22:00 same day is the latest slot."""
        booking = Booking(
            room=room,
            user=user,
            start_time=berlin_at(1, 21, minute=45),
            date=berlin_at(1, 21).date(),
            end_time=berlin_at(1, 22),
            organization=organization,
        )

        booking.full_clean()  # Should not raise

    # ========================================================================
    # Overlap Prevention Tests
    # ========================================================================

    def test_booking_prevents_exact_overlap(
        self, db, user, room, booking, organization
    ):
        """Test that overlapping booking is rejected."""
        overlapping_booking = Booking(
            room=room,
            user=user,
            start_time=booking.start_time,
            date=booking.start_time.date(),
            end_time=booking.end_time,
            organization=organization,
        )

        with pytest.raises(ValidationError) as exc_info:
            overlapping_booking.full_clean()

        assert "already booked" in str(exc_info.value).lower()

    def test_booking_prevents_partial_overlap_start(
        self, db, user, room, booking, organization
    ):
        """Test that booking overlapping at start is rejected."""
        overlapping_booking = Booking(
            room=room,
            user=user,
            start_time=booking.start_time - timedelta(minutes=30),
            date=(booking.start_time - timedelta(minutes=30)).date(),
            end_time=booking.start_time + timedelta(minutes=30),
            organization=organization,
        )

        with pytest.raises(ValidationError):
            overlapping_booking.full_clean()

    def test_booking_prevents_partial_overlap_end(
        self, db, user, room, booking, organization
    ):
        """Test that booking overlapping at end is rejected."""
        overlapping_booking = Booking(
            room=room,
            user=user,
            start_time=booking.end_time - timedelta(minutes=30),
            end_time=booking.end_time + timedelta(minutes=30),
            organization=organization,
        )

        with pytest.raises(ValidationError):
            overlapping_booking.full_clean()

    def test_booking_prevents_contained_overlap(
        self, db, user, room, booking, organization
    ):
        """Test that booking fully contained within another is rejected."""
        overlapping_booking = Booking(
            room=room,
            user=user,
            start_time=booking.start_time + timedelta(minutes=30),
            end_time=booking.end_time - timedelta(minutes=30),
            organization=organization,
        )

        with pytest.raises(ValidationError):
            overlapping_booking.full_clean()

    def test_booking_prevents_containing_overlap(
        self, db, user, room, booking, organization
    ):
        """Test that booking fully containing another is rejected."""
        overlapping_booking = Booking(
            room=room,
            user=user,
            start_time=booking.start_time - timedelta(minutes=30),
            end_time=booking.end_time + timedelta(minutes=30),
            organization=organization,
        )

        with pytest.raises(ValidationError):
            overlapping_booking.full_clean()

    def test_booking_allows_non_overlapping_same_day(
        self, db, user, room, organization
    ):
        """Test that non-overlapping booking same day is allowed."""
        first = Booking.objects.create(
            room=room,
            user=user,
            start_time=berlin_at(1, 10),
            date=berlin_at(1, 10).date(),
            end_time=berlin_at(1, 12),
            organization=organization,
        )

        non_overlapping = Booking(
            room=room,
            user=user,
            start_time=berlin_at(1, 12, minute=30),
            date=berlin_at(1, 12).date(),
            end_time=berlin_at(1, 14),
            organization=organization,
        )

        non_overlapping.full_clean()  # Should not raise
        non_overlapping.save()

        assert non_overlapping.pk is not None
        assert first.pk is not None

    def test_booking_allows_non_overlapping_different_day(
        self, db, user, room, booking, organization
    ):
        """Test that booking on different day is allowed."""
        next_day = booking.start_time + timedelta(days=1)
        next_day = next_day.replace(hour=9, minute=0)

        non_overlapping = Booking(
            room=room,
            user=user,
            start_time=next_day,
            date=next_day.date(),
            end_time=next_day + timedelta(hours=2),
            organization=organization,
        )

        non_overlapping.full_clean()  # Should not raise
        non_overlapping.save()
        assert non_overlapping.pk is not None

    def test_booking_allows_overlapping_different_room(
        self, db, user, booking, room, organization
    ):
        """Test that overlapping booking for different room is allowed."""
        other_room = Room.objects.create(
            name="Other Room",
            location="Floor 2",
            capacity=10,
            organization=organization,
        )

        overlapping_booking = Booking(
            room=other_room,
            user=user,
            start_time=booking.start_time,
            date=booking.start_time.date(),
            end_time=booking.end_time,
            organization=organization,
        )

        overlapping_booking.full_clean()  # Should not raise
        overlapping_booking.save()
        assert overlapping_booking.pk is not None

    def test_booking_allows_self_overlap_on_update(self, db, user, booking):
        """Test that booking can be updated without overlap conflict with itself."""
        # Pin office-hours-safe times so the extended end can't cross 22:00
        # regardless of when the suite runs.
        booking.start_time = berlin_at(1, 10)
        booking.end_time = berlin_at(1, 12)
        booking.save()
        # Simulate updating the booking's end time
        booking.end_time = berlin_at(1, 12, minute=30)
        booking.full_clean()  # Should not raise (excludes self)
        booking.save()

        # Verify the update worked
        booking.refresh_from_db()
        assert booking.end_time == berlin_at(1, 12, minute=30)

    # ========================================================================
    # Cancelled Bookings Don't Block (parity with serializer + DB constraint)
    # ========================================================================

    def test_clean_ignores_cancelled_overlap(self, db, user, room, organization):
        """A cancelled booking is history — clean() must not treat it as busy."""
        Booking.objects.create(
            room=room,
            user=user,
            organization=organization,
            start_time=berlin_at(1, 10),
            date=berlin_at(1, 10).date(),
            end_time=berlin_at(1, 11),
            status="cancelled",
        )

        rebooking = Booking(
            room=room,
            user=user,
            start_time=berlin_at(1, 10, minute=30),
            date=berlin_at(1, 10).date(),
            end_time=berlin_at(1, 11, minute=30),
            organization=organization,
        )

        rebooking.full_clean()  # Should not raise (cancelled doesn't block)

    # ========================================================================
    # 90-Day Advance Booking Limit Tests
    # ========================================================================

    def test_booking_at_90_day_limit(self, db, user, room, organization):
        """Test that a booking just inside the 90-day window is allowed."""
        # 89 days out at a fixed Berlin hour — always inside the limit and
        # inside office hours, regardless of when the suite runs.
        near_max = berlin_at(89, 10)
        booking = Booking(
            room=room,
            user=user,
            start_time=near_max,
            date=near_max.date(),
            end_time=near_max + timedelta(hours=2),
            organization=organization,
        )

        booking.full_clean()  # Should not raise

    def test_booking_beyond_90_day_limit_rejected(self, db, user, room, organization):
        """Test that booking more than 90 days ahead is rejected."""
        beyond_max = berlin_at(Booking.MAX_DAYS_AHEAD + 1, 10)
        booking = Booking(
            room=room,
            user=user,
            start_time=beyond_max,
            date=beyond_max.date(),
            end_time=beyond_max + timedelta(hours=2),
            organization=organization,
        )

        with pytest.raises(ValidationError) as exc_info:
            booking.full_clean()

        assert "start_time" in exc_info.value.message_dict
        assert "90" in str(exc_info.value) or "days" in str(exc_info.value).lower()

    def test_booking_slightly_beyond_90_day_limit(self, db, user, room, organization):
        """Test that booking 91 days ahead is rejected."""
        future = berlin_at(91, 10)
        booking = Booking(
            room=room,
            user=user,
            start_time=future,
            date=future.date(),
            end_time=future + timedelta(hours=1),
            organization=organization,
        )

        with pytest.raises(ValidationError):
            booking.full_clean()

    # ========================================================================
    # Date Field Tests
    # ========================================================================

    def test_booking_date_field_auto_set(
        self, db, user, room, future_start_time, organization
    ):
        """Test that date field is automatically set from start_time."""
        booking = Booking.objects.create(
            room=room,
            user=user,
            start_time=future_start_time,
            date=future_start_time.date(),
            end_time=future_start_time + timedelta(hours=2),
            organization=organization,
        )

        assert booking.date == booking.start_time.date()

    def test_booking_date_persists(
        self, db, user, room, future_start_time, organization
    ):
        """Test that date field is saved to database."""
        booking = Booking.objects.create(
            room=room,
            user=user,
            start_time=future_start_time,
            date=future_start_time.date(),
            end_time=future_start_time + timedelta(hours=2),
            organization=organization,
        )

        # Retrieve from database
        saved_booking = Booking.objects.get(pk=booking.pk)
        assert saved_booking.date == future_start_time.date()

    # ========================================================================
    # String Representation Tests
    # ========================================================================

    def test_booking_str_representation(self, db, user, room, berlin_now, organization):
        """Test that booking string includes room name and time range."""
        start = berlin_now.replace(hour=10, minute=0, second=0, microsecond=0)
        end = berlin_now.replace(hour=12, minute=0, second=0, microsecond=0)

        booking = Booking(
            room=room,
            user=user,
            start_time=start,
            date=start.date(),
            end_time=end,
            organization=organization,
        )

        str_repr = str(booking)
        assert room.name in str_repr
        assert "10:00" in str_repr
        assert "12:00" in str_repr

    # ========================================================================
    # Edge Cases
    # ========================================================================

    def test_booking_with_midnight_spanning(self, db, user, room, organization):
        """Overnight bookings are rejected: 22:00 close + same-day end rule.

        The model used to allow these (only the serializer checked office
        hours) — validation is centralized now, so clean() rejects them.
        """
        start = berlin_at(1, 23)
        end = start + timedelta(hours=2)

        booking = Booking(
            room=room,
            user=user,
            start_time=start,
            date=start.date(),
            end_time=end,
            organization=organization,
        )

        with pytest.raises(ValidationError) as exc_info:
            booking.full_clean()

        assert "start_time" in exc_info.value.message_dict
        assert "end_time" in exc_info.value.message_dict

    def test_booking_exactly_now_rejected(self, db, user, room, utc_now, organization):
        """Test that booking starting exactly now is rejected (past check)."""
        # Use freeze_time or a time very slightly in the past
        past = utc_now - timedelta(microseconds=1)
        booking = Booking(
            room=room,
            user=user,
            start_time=past,
            date=past.date(),
            end_time=past + timedelta(hours=1),
            organization=organization,
        )

        with pytest.raises(ValidationError):
            booking.full_clean()
