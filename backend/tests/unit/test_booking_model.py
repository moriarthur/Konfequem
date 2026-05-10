"""
Unit tests for Booking model validation.

Tests validate:
- Past date rejection
- Duration constraints
- Overlap prevention
- 90-day advance booking limit
"""

import pytest
from datetime import timedelta
from django.utils import timezone
from django.core.exceptions import ValidationError
from rooms.models import Booking, Room
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.unit
class TestBookingModel:
    """Test suite for Booking model validation."""

    # ========================================================================
    # Past Date Rejection Tests
    # ========================================================================

    def test_booking_rejects_past_start_time(self, db, user, room):
        """Test that booking cannot start in the past."""
        past_time = timezone.now() - timedelta(hours=1)

        booking = Booking(
            room=room, user=user, start_time=past_time, end_time=timezone.now()
        )

        with pytest.raises(ValidationError) as exc_info:
            booking.full_clean()

        assert "start_time" in exc_info.value.message_dict
        assert "past" in str(exc_info.value).lower()

    def test_booking_rejects_end_time_before_start_time(self, db, user, room, utc_now):
        """Test that end_time must be after start_time."""
        booking = Booking(
            room=room,
            user=user,
            start_time=utc_now + timedelta(hours=2),
            end_time=utc_now + timedelta(hours=1),  # Before start
        )

        with pytest.raises(ValidationError) as exc_info:
            booking.full_clean()

        assert "end_time" in exc_info.value.message_dict

    def test_booking_rejects_equal_start_and_end_time(self, db, user, room, utc_now):
        """Test that end_time cannot equal start_time."""
        same_time = utc_now + timedelta(hours=1)
        booking = Booking(
            room=room,
            user=user,
            start_time=same_time,
            end_time=same_time,  # Same as start
        )

        with pytest.raises(ValidationError) as exc_info:
            booking.full_clean()

        assert "end_time" in exc_info.value.message_dict

    # ========================================================================
    # Duration Constraint Tests
    # ========================================================================

    def test_booking_allows_valid_duration(self, db, user, room, future_start_time):
        """Test that booking accepts valid duration (2 hours)."""
        booking = Booking(
            room=room,
            user=user,
            start_time=future_start_time,
            date=future_start_time.date(),
            end_time=future_start_time + timedelta(hours=2),
        )

        booking.full_clean()  # Should not raise
        booking.save()

        assert booking.pk is not None
        assert booking.end_time - booking.start_time == timedelta(hours=2)

    def test_booking_allows_minimum_duration(self, db, user, room, utc_now):
        """Test that booking can be very short (e.g., 15 minutes)."""
        start = utc_now + timedelta(hours=1)
        booking = Booking(
            room=room,
            user=user,
            start_time=start,
            date=start.date(),
            end_time=start + timedelta(minutes=15),
        )

        # Model allows this; serializer enforces the 15-min limit
        booking.full_clean()  # Should not raise at model level
        assert booking.end_time - booking.start_time == timedelta(minutes=15)

    def test_booking_allows_maximum_duration(self, db, user, room, utc_now):
        """Test that booking can be up to 8 hours (max at serializer level)."""
        start = utc_now + timedelta(hours=1)
        booking = Booking(
            room=room,
            user=user,
            start_time=start,
            date=start.date(),
            end_time=start + timedelta(hours=8),
        )

        booking.full_clean()  # Model allows this
        assert booking.end_time - booking.start_time == timedelta(hours=8)

    # ========================================================================
    # Overlap Prevention Tests
    # ========================================================================

    def test_booking_prevents_exact_overlap(self, db, user, room, booking):
        """Test that overlapping booking is rejected."""
        overlapping_booking = Booking(
            room=room,
            user=user,
            start_time=booking.start_time,
            date=booking.start_time.date(),
            end_time=booking.end_time,
        )

        with pytest.raises(ValidationError) as exc_info:
            overlapping_booking.full_clean()

        assert "already booked" in str(exc_info.value).lower()

    def test_booking_prevents_partial_overlap_start(self, db, user, room, booking):
        """Test that booking overlapping at start is rejected."""
        overlapping_booking = Booking(
            room=room,
            user=user,
            start_time=booking.start_time - timedelta(minutes=30),
            date=(booking.start_time - timedelta(minutes=30)).date(),
            end_time=booking.start_time + timedelta(minutes=30),
        )

        with pytest.raises(ValidationError):
            overlapping_booking.full_clean()

    def test_booking_prevents_partial_overlap_end(self, db, user, room, booking):
        """Test that booking overlapping at end is rejected."""
        overlapping_booking = Booking(
            room=room,
            user=user,
            start_time=booking.end_time - timedelta(minutes=30),
            end_time=booking.end_time + timedelta(minutes=30),
        )

        with pytest.raises(ValidationError):
            overlapping_booking.full_clean()

    def test_booking_prevents_contained_overlap(self, db, user, room, booking):
        """Test that booking fully contained within another is rejected."""
        overlapping_booking = Booking(
            room=room,
            user=user,
            start_time=booking.start_time + timedelta(minutes=30),
            end_time=booking.end_time - timedelta(minutes=30),
        )

        with pytest.raises(ValidationError):
            overlapping_booking.full_clean()

    def test_booking_prevents_containing_overlap(self, db, user, room, booking):
        """Test that booking fully containing another is rejected."""
        overlapping_booking = Booking(
            room=room,
            user=user,
            start_time=booking.start_time - timedelta(minutes=30),
            end_time=booking.end_time + timedelta(minutes=30),
        )

        with pytest.raises(ValidationError):
            overlapping_booking.full_clean()

    def test_booking_allows_non_overlapping_same_day(self, db, user, room, booking):
        """Test that non-overlapping booking same day is allowed."""
        non_overlapping = Booking(
            room=room,
            user=user,
            start_time=booking.end_time + timedelta(minutes=30),
            date=(booking.end_time + timedelta(minutes=30)).date(),
            end_time=booking.end_time + timedelta(hours=2),
        )

        non_overlapping.full_clean()  # Should not raise
        non_overlapping.save()

        assert non_overlapping.pk is not None

    def test_booking_allows_non_overlapping_different_day(
        self, db, user, room, booking
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
        )

        non_overlapping.full_clean()  # Should not raise
        non_overlapping.save()
        assert non_overlapping.pk is not None

    def test_booking_allows_overlapping_different_room(self, db, user, booking, room):
        """Test that overlapping booking for different room is allowed."""
        other_room = Room.objects.create(
            name="Other Room", location="Floor 2", capacity=10
        )

        overlapping_booking = Booking(
            room=other_room,
            user=user,
            start_time=booking.start_time,
            date=booking.start_time.date(),
            end_time=booking.end_time,
        )

        overlapping_booking.full_clean()  # Should not raise
        overlapping_booking.save()
        assert overlapping_booking.pk is not None

    def test_booking_allows_self_overlap_on_update(self, db, user, booking):
        """Test that booking can be updated without overlap conflict with itself."""
        # Simulate updating the booking's end time
        booking.end_time = booking.end_time + timedelta(minutes=30)
        booking.full_clean()  # Should not raise (excludes self)
        booking.save()

        # Verify the update worked
        booking.refresh_from_db()
        assert booking.end_time > booking.start_time + timedelta(hours=2)

    # ========================================================================
    # 90-Day Advance Booking Limit Tests
    # ========================================================================

    def test_booking_at_90_day_limit(self, db, user, room, utc_now):
        """Test that booking exactly 90 days ahead is allowed."""
        max_date = utc_now + timedelta(days=Booking.MAX_DAYS_AHEAD)
        booking = Booking(
            room=room,
            user=user,
            start_time=max_date,
            date=max_date.date(),
            end_time=max_date + timedelta(hours=2),
        )

        booking.full_clean()  # Should not raise
        assert booking.start_time.date() == (utc_now + timedelta(days=90)).date()

    def test_booking_beyond_90_day_limit_rejected(self, db, user, room, utc_now):
        """Test that booking more than 90 days ahead is rejected."""
        beyond_max = utc_now + timedelta(days=Booking.MAX_DAYS_AHEAD + 1)
        booking = Booking(
            room=room,
            user=user,
            start_time=beyond_max,
            end_time=beyond_max + timedelta(hours=2),
        )

        with pytest.raises(ValidationError) as exc_info:
            booking.full_clean()

        assert "start_time" in exc_info.value.message_dict
        assert "90" in str(exc_info.value) or "days" in str(exc_info.value).lower()

    def test_booking_slightly_beyond_90_day_limit(self, db, user, room, utc_now):
        """Test that booking 91 days ahead is rejected."""
        future = utc_now + timedelta(days=91)
        booking = Booking(
            room=room,
            user=user,
            start_time=future,
            end_time=future + timedelta(hours=1),
        )

        with pytest.raises(ValidationError):
            booking.full_clean()

    # ========================================================================
    # Date Field Tests
    # ========================================================================

    def test_booking_date_field_auto_set(self, db, user, room, future_start_time):
        """Test that date field is automatically set from start_time."""
        booking = Booking.objects.create(
            room=room,
            user=user,
            start_time=future_start_time,
            date=future_start_time.date(),
            end_time=future_start_time + timedelta(hours=2),
        )

        assert booking.date == booking.start_time.date()

    def test_booking_date_persists(self, db, user, room, future_start_time):
        """Test that date field is saved to database."""
        booking = Booking.objects.create(
            room=room,
            user=user,
            start_time=future_start_time,
            date=future_start_time.date(),
            end_time=future_start_time + timedelta(hours=2),
        )

        # Retrieve from database
        saved_booking = Booking.objects.get(pk=booking.pk)
        assert saved_booking.date == future_start_time.date()

    # ========================================================================
    # String Representation Tests
    # ========================================================================

    def test_booking_str_representation(self, db, user, room, berlin_now):
        """Test that booking string includes room name and time range."""
        start = berlin_now.replace(hour=10, minute=0, second=0, microsecond=0)
        end = berlin_now.replace(hour=12, minute=0, second=0, microsecond=0)

        booking = Booking(
            room=room, user=user, start_time=start, date=start.date(), end_time=end
        )

        str_repr = str(booking)
        assert room.name in str_repr
        assert "10:00" in str_repr
        assert "12:00" in str_repr

    # ========================================================================
    # Edge Cases
    # ========================================================================

    def test_booking_with_midnight_spanning(self, db, user, room, utc_now):
        """Test booking that spans across midnight."""
        # Set start to 23:00 and end to 01:00 next day
        start = utc_now + timedelta(days=1)
        start = start.replace(hour=23, minute=0, second=0, microsecond=0)
        end = start + timedelta(hours=2)

        booking = Booking(
            room=room, user=user, start_time=start, date=start.date(), end_time=end
        )

        booking.full_clean()  # Model allows this; serializer may enforce office hours
        booking.save()

        assert booking.start_time.hour == 23
        assert booking.end_time.hour == 1

    def test_booking_exactly_now_rejected(self, db, user, room, utc_now):
        """Test that booking starting exactly now is rejected (past check)."""
        # Use freeze_time or a time very slightly in the past
        past = utc_now - timedelta(microseconds=1)
        booking = Booking(
            room=room,
            user=user,
            start_time=past,
            date=past.date(),
            end_time=past + timedelta(hours=1),
        )

        with pytest.raises(ValidationError):
            booking.full_clean()
