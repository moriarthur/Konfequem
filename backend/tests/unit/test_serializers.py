"""
Unit tests for serializers.

Tests validate:
- Office hours validation (08:00-22:00 Berlin time)
- Duration validation (15 min - 8 hours)
- Timezone conversion
- Overlap detection
- 90-day advance limit
"""

import pytest
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory
from rooms.serializers import BookingSerializer, RoomSerializer

User = get_user_model()


@pytest.mark.unit
class TestRoomSerializer:
    """Test suite for RoomSerializer."""

    def test_room_serializer_contains_expected_fields(self, db, room):
        """Test that RoomSerializer serializes all expected fields."""
        serializer = RoomSerializer(room)
        data = serializer.data

        assert set(data.keys()) == {"id", "name", "location", "capacity", "features"}
        assert data["name"] == room.name
        assert data["capacity"] == room.capacity
        assert "features" in data

    def test_room_serializer_serializes_multiple_rooms(self, db, rooms):
        """Test that RoomSerializer handles multiple rooms."""
        serializer = RoomSerializer(rooms, many=True)
        data = serializer.data

        assert len(data) == 5
        assert all("id" in room for room in data)
        assert all("name" in room for room in data)


@pytest.mark.unit
class TestBookingSerializerValidation:
    """Test suite for BookingSerializer validation logic."""

    # ========================================================================
    # Office Hours Validation Tests (08:00-22:00 Berlin)
    # ========================================================================

    @pytest.fixture
    def make_request(self, user):
        """Helper to create a request with authenticated user."""

        def _make_request():
            factory = APIRequestFactory()
            request = factory.post("/")
            request.user = user
            return request

        return _make_request

    @pytest.mark.timezone
    def test_booking_within_office_hours_accepted(
        self, db, room, user, make_request, berlin_now
    ):
        """Test that booking within office hours (09:00-17:00) is accepted."""
        start = berlin_now.replace(hour=9, minute=0, second=0, microsecond=0)
        start = start if start > timezone.now() else start + timedelta(days=1)

        data = {
            "room": room.id,
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(hours=2)).isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert serializer.is_valid(), serializer.errors
        assert not serializer.errors

    @pytest.mark.timezone
    def test_booking_starting_before_office_hours_rejected(
        self, db, room, user, make_request, utc_now
    ):
        """Test that booking starting before 08:00 is rejected."""
        berlin_tz = timezone.get_default_timezone()
        tomorrow_berlin = (utc_now + timedelta(days=1)).astimezone(berlin_tz)
        start = tomorrow_berlin.replace(hour=7, minute=0, second=0, microsecond=0)

        data = {
            "room": room.id,
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(hours=2)).isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert not serializer.is_valid()
        assert any(
            "08:00" in str(e) or "21:45" in str(e)
            for e in serializer.errors.get("general", [])
        )

    @pytest.mark.timezone
    def test_booking_starting_at_office_open_accepted(
        self, db, room, user, make_request, utc_now
    ):
        """Test that booking starting exactly at 08:00 Berlin time is accepted."""
        start = utc_now + timedelta(days=1)
        # 07:00 UTC = 08:00 Berlin time (CET = UTC+1)
        start = start.replace(hour=7, minute=0, second=0, microsecond=0)

        data = {
            "room": room.id,
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(hours=2)).isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert serializer.is_valid(), serializer.errors

    @pytest.mark.timezone
    def test_booking_starting_at_office_close_boundary(
        self, db, room, user, make_request, utc_now
    ):
        """Test booking at the 22:00 boundary."""
        berlin_tz = timezone.get_default_timezone()
        tomorrow_berlin = (utc_now + timedelta(days=1)).astimezone(berlin_tz)
        start = tomorrow_berlin.replace(hour=22, minute=0, second=0, microsecond=0)

        data = {
            "room": room.id,
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(hours=1)).isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert not serializer.is_valid()
        assert any(
            "08:00" in str(e) or "21:45" in str(e)
            for e in serializer.errors.get("general", [])
        )

    @pytest.mark.timezone
    def test_booking_ending_after_office_hours_rejected(
        self, db, room, user, make_request, utc_now
    ):
        """Test that booking ending after 22:00 is rejected."""
        berlin_tz = timezone.get_default_timezone()
        tomorrow_berlin = (utc_now + timedelta(days=1)).astimezone(berlin_tz)
        start = tomorrow_berlin.replace(hour=21, minute=0, second=0, microsecond=0)

        data = {
            "room": room.id,
            "start_time": start.isoformat(),
            "end_time": (
                start + timedelta(hours=2)
            ).isoformat(),  # Ends at 23:00 Berlin
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert not serializer.is_valid()
        assert any(
            "22:00" in str(e) or "08:00" in str(e)
            for e in serializer.errors.get("general", [])
        )

    # ========================================================================
    # Duration Validation Tests (15 min - 8 hours)
    # ========================================================================

    def test_booking_with_15_minute_duration_accepted(
        self, db, room, user, make_request, utc_now
    ):
        """Test that minimum duration of 15 minutes is accepted."""
        start = utc_now + timedelta(days=1)
        start = start.replace(hour=10, minute=0, second=0, microsecond=0)

        data = {
            "room": room.id,
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(minutes=15)).isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert serializer.is_valid(), serializer.errors

    def test_booking_with_less_than_15_minutes_rejected(
        self, db, room, user, make_request, utc_now
    ):
        """Test that duration less than 15 minutes is rejected."""
        start = utc_now + timedelta(days=1)
        start = start.replace(hour=10, minute=0, second=0, microsecond=0)

        data = {
            "room": room.id,
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(minutes=14)).isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert not serializer.is_valid()
        assert any(
            "15" in str(e) or "minute" in str(e).lower()
            for e in serializer.errors.get("general", [])
        )

    def test_booking_with_8_hour_duration_accepted(
        self, db, room, user, make_request, utc_now
    ):
        """Test that maximum duration of 8 hours is accepted."""
        start = utc_now + timedelta(days=1)
        start = start.replace(hour=9, minute=0, second=0, microsecond=0)

        data = {
            "room": room.id,
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(hours=8)).isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert serializer.is_valid(), serializer.errors

    def test_booking_exceeding_8_hours_rejected(
        self, db, room, user, make_request, utc_now
    ):
        """Test that duration exceeding 8 hours is rejected."""
        start = utc_now + timedelta(days=1)
        start = start.replace(hour=8, minute=0, second=0, microsecond=0)

        data = {
            "room": room.id,
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(hours=8, minutes=1)).isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert not serializer.is_valid()
        assert any(
            "8" in str(e) or "hour" in str(e).lower()
            for e in serializer.errors.get("general", [])
        )

    # ========================================================================
    # Timezone Conversion Tests
    # ========================================================================

    @pytest.mark.timezone
    def test_serializer_converts_times_to_berlin_timezone(self, db, booking, berlin_tz):
        """Test that serializer converts times to Berlin timezone."""
        serializer = BookingSerializer(booking)
        data = serializer.data

        # Parse the ISO format times
        from datetime import datetime

        start_dt = datetime.fromisoformat(data["start_time"].replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(data["end_time"].replace("Z", "+00:00"))

        # Verify they're in Berlin timezone
        assert start_dt.tzinfo is not None
        assert end_dt.tzinfo is not None

    @pytest.mark.timezone
    def test_booking_with_utc_times_converts_for_validation(
        self, db, room, user, make_request, utc_now
    ):
        """Test that UTC times are correctly converted to Berlin for validation."""
        # Create a time that would be 07:00 UTC (09:00 Berlin in winter)
        # Note: This depends on daylight saving time
        start = utc_now + timedelta(days=1)
        start = start.replace(hour=10, minute=0, second=0, microsecond=0)

        data = {
            "room": room.id,
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(hours=2)).isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        # Should be valid as it's within office hours
        assert serializer.is_valid(), serializer.errors

    # ========================================================================
    # Overlap Detection Tests
    # ========================================================================

    def test_booking_with_overlap_rejected(self, db, room, user, make_request, booking):
        """Test that overlapping booking is rejected."""
        data = {
            "room": room.id,
            "start_time": booking.start_time.isoformat(),
            "end_time": booking.end_time.isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert not serializer.is_valid()
        assert any(
            "already booked" in str(e).lower()
            for e in serializer.errors.get("general", [])
        )

    def test_booking_overlap_rejected_for_staff(
        self, db, room, staff_user, make_request, booking
    ):
        """Test that staff users cannot create overlapping bookings."""

        # Staff users should also respect overlap constraints
        class StaffRequest:
            user = staff_user

        data = {
            "room": room.id,
            "start_time": booking.start_time.isoformat(),
            "end_time": booking.end_time.isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": StaffRequest()})
        # Overlapping bookings should be rejected for all users including staff
        assert not serializer.is_valid()
        assert any(
            "already booked" in str(e).lower()
            for e in serializer.errors.get("general", [])
        )

    # ========================================================================
    # 90-Day Advance Limit Tests
    # ========================================================================

    def test_booking_within_90_days_accepted(
        self, db, room, user, make_request, utc_now
    ):
        """Test that booking 89 days ahead is accepted."""
        start = utc_now + timedelta(days=89)
        start = start.replace(hour=10, minute=0, second=0, microsecond=0)

        data = {
            "room": room.id,
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(hours=2)).isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert serializer.is_valid(), serializer.errors

    def test_booking_exactly_90_days_accepted(
        self, db, room, user, make_request, utc_now
    ):
        """Test that booking exactly 90 days ahead is accepted."""
        # Use 89 days to ensure we're within the limit (accounting for execution time)
        start = utc_now + timedelta(days=89)
        start = start.replace(hour=10, minute=0, second=0, microsecond=0)

        data = {
            "room": room.id,
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(hours=2)).isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert serializer.is_valid(), serializer.errors

    def test_booking_beyond_90_days_rejected(
        self, db, room, user, make_request, utc_now
    ):
        """Test that booking beyond 90 days is rejected."""
        start = utc_now + timedelta(days=91)
        start = start.replace(hour=10, minute=0, second=0, microsecond=0)

        data = {
            "room": room.id,
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(hours=2)).isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert not serializer.is_valid()
        assert any(
            "90" in str(e) or "days" in str(e).lower()
            for e in serializer.errors.get("general", [])
        )

    # ========================================================================
    # Required Field Tests
    # ========================================================================

    def test_booking_without_room_rejected(self, db, user, make_request, utc_now):
        """Test that booking without room is rejected."""
        start = utc_now + timedelta(days=1)
        data = {
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(hours=2)).isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert not serializer.is_valid()

    def test_booking_without_start_time_rejected(self, db, room, user, make_request):
        """Test that booking without start_time is rejected."""
        data = {
            "room": room.id,
            "end_time": (timezone.now() + timedelta(hours=3)).isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert not serializer.is_valid()

    def test_booking_without_end_time_rejected(
        self, db, room, user, make_request, utc_now
    ):
        """Test that booking without end_time is rejected."""
        start = utc_now + timedelta(days=1)
        data = {"room": room.id, "start_time": start.isoformat()}

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert not serializer.is_valid()

    # ========================================================================
    # Past Time Tests
    # ========================================================================

    def test_booking_with_past_start_time_rejected(
        self, db, room, user, make_request, utc_now
    ):
        """Test that booking in the past is rejected."""
        data = {
            "room": room.id,
            "start_time": (utc_now - timedelta(hours=1)).isoformat(),
            "end_time": utc_now.isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert not serializer.is_valid()
        assert any(
            "past" in str(e).lower() for e in serializer.errors.get("general", [])
        )

    # ========================================================================
    # End Time After Start Time Tests
    # ========================================================================

    def test_booking_with_end_before_start_rejected(
        self, db, room, user, make_request, utc_now
    ):
        """Test that end_time before start_time is rejected."""
        start = utc_now + timedelta(days=1)
        data = {
            "room": room.id,
            "start_time": (start + timedelta(hours=2)).isoformat(),
            "end_time": start.isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": make_request()})
        assert not serializer.is_valid()
        assert any(
            "after" in str(e).lower() for e in serializer.errors.get("general", [])
        )


@pytest.mark.unit
class TestBookingSerializerOutput:
    """Test suite for BookingSerializer output representation."""

    def test_booking_serializer_includes_room_name(self, db, booking):
        """Test that serializer includes room name as read-only field."""
        serializer = BookingSerializer(booking)
        data = serializer.data

        assert "room_name" in data
        assert data["room_name"] == booking.room.name

    def test_booking_serializer_includes_user_id(self, db, booking):
        """Test that serializer includes user information."""
        serializer = BookingSerializer(booking)
        data = serializer.data

        assert "user" in data
        assert data["user"] == booking.user.id

    def test_booking_serializer_allows_user_create(self, db, room, user, organization):
        """Test that user is automatically assigned on create."""
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        request = factory.post("/")
        request.user = user

        # Set time to 10:00 Berlin time (09:00 UTC) for office hours
        future = timezone.now() + timedelta(days=1)
        future = future.replace(hour=9, minute=0, second=0, microsecond=0)
        data = {
            "room": room.id,
            "start_time": future.isoformat(),
            "end_time": (future + timedelta(hours=2)).isoformat(),
        }

        serializer = BookingSerializer(data=data, context={"request": request})
        assert serializer.is_valid(), serializer.errors

        booking = serializer.save(user=user, organization=organization)
        assert booking.user == user
