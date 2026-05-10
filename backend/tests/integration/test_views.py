"""
Integration tests for views/API endpoints.

Tests validate:
- RoomViewSet: public access, list/retrieve
- BookingViewSet: auth required, user filtering, room/date/month filters
"""

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import timedelta

from rooms.models import Room, Booking

User = get_user_model()


@pytest.mark.integration
class TestRoomViewSet:
    """Test suite for RoomViewSet API endpoints."""

    # ========================================================================
    # List Rooms Tests
    # ========================================================================

    def test_list_rooms_public_access(self, db, api_client, rooms):
        """Test that listing rooms doesn't require authentication."""
        response = api_client.get("/api/rooms/")

        assert response.status_code == 200
        assert len(response.data["results"]) == 5

    def test_list_rooms_returns_correct_fields(self, db, api_client, room):
        """Test that room list returns expected fields."""
        response = api_client.get("/api/rooms/")

        assert response.status_code == 200
        data = response.data["results"][0]
        assert set(data.keys()) == {"id", "name", "location", "capacity", "features"}

    def test_list_rooms_empty(self, db, api_client):
        """Test listing rooms when no rooms exist."""
        response = api_client.get("/api/rooms/")

        assert response.status_code == 200
        assert len(response.data["results"]) == 0

    def test_list_rooms_ordered(self, db, api_client):
        """Test that rooms are ordered consistently."""
        Room.objects.create(name="Z Room", location="Floor 1", capacity=5)
        Room.objects.create(name="A Room", location="Floor 2", capacity=10)

        response = api_client.get("/api/rooms/")

        assert response.status_code == 200
        assert len(response.data["results"]) == 2

    # ========================================================================
    # Retrieve Room Tests
    # ========================================================================

    def test_retrieve_room_by_id(self, db, api_client, room):
        """Test retrieving a specific room by ID."""
        response = api_client.get(f"/api/rooms/{room.id}/")

        assert response.status_code == 200
        assert response.data["id"] == room.id
        assert response.data["name"] == room.name
        assert response.data["capacity"] == room.capacity

    def test_retrieve_nonexistent_room(self, db, api_client):
        """Test retrieving a room that doesn't exist."""
        response = api_client.get("/api/rooms/99999/")

        assert response.status_code == 404

    def test_retrieve_room_without_auth(self, db, api_client, room):
        """Test that retrieving a room doesn't require authentication."""
        response = api_client.get(f"/api/rooms/{room.id}/")

        assert response.status_code == 200

    # ========================================================================
    # HTTP Method Tests
    # ========================================================================

    def test_rooms_read_only(self, db, api_client):
        """Test that rooms cannot be created/updated/deleted via API."""
        # Try to create a room
        create_response = api_client.post(
            "/api/rooms/", {"name": "New Room", "location": "Floor 1", "capacity": 10}
        )
        assert create_response.status_code == 405  # Method Not Allowed

        # Create a room for update/delete tests
        room = Room.objects.create(name="Test Room", capacity=5)

        # Try to update
        update_response = api_client.put(
            f"/api/rooms/{room.id}/",
            {"name": "Updated Room", "capacity": 15},
            format="json",
        )
        assert update_response.status_code == 405

        # Try to delete
        delete_response = api_client.delete(f"/api/rooms/{room.id}/")
        assert delete_response.status_code == 405


@pytest.mark.integration
class TestBookingViewSet:
    """Test suite for BookingViewSet API endpoints."""

    # ========================================================================
    # Authentication Tests
    # ========================================================================

    def test_list_bookings_requires_auth(self, db, api_client):
        """Test that listing bookings requires authentication."""
        response = api_client.get("/api/bookings/")

        assert response.status_code == 401

    def test_create_booking_requires_auth(
        self, db, api_client, room, future_start_time
    ):
        """Test that creating a booking requires authentication."""
        start = future_start_time
        response = api_client.post(
            "/api/bookings/",
            {
                "room": room.id,
                "start_time": start.isoformat(),
                "end_time": (start + timedelta(hours=2)).isoformat(),
            },
        )

        assert response.status_code == 401

    # ========================================================================
    # List Bookings Tests
    # ========================================================================

    def test_list_bookings_authenticated(
        self, db, authenticated_api_client, user, booking
    ):
        """Test that authenticated users can list their bookings."""
        response = authenticated_api_client.get("/api/bookings/")

        assert response.status_code == 200
        assert len(response.data["results"]) >= 1

    def test_list_bookings_filters_by_user(
        self, db, api_client, user, staff_user, room
    ):
        """Test that users only see their own bookings."""
        # Create bookings for different users
        from django.utils import timezone

        now = timezone.now()

        user_booking = Booking.objects.create(
            room=room,
            user=user,
            start_time=now + timedelta(days=1, hours=10),
            date=(now + timedelta(days=1, hours=10)).date(),
            end_time=now + timedelta(days=1, hours=12),
        )

        staff_booking = Booking.objects.create(
            room=room,
            user=staff_user,
            start_time=now + timedelta(days=2, hours=10),
            date=(now + timedelta(days=2, hours=10)).date(),
            end_time=now + timedelta(days=2, hours=12),
        )

        # Authenticate as regular user
        refresh = RefreshToken.for_user(user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        response = api_client.get("/api/bookings/")

        assert response.status_code == 200
        booking_ids = [b["id"] for b in response.data["results"]]
        assert user_booking.id in booking_ids
        assert staff_booking.id not in booking_ids

    # ========================================================================
    # Room Filter Tests
    # ========================================================================

    def test_filter_bookings_by_room(
        self, db, authenticated_api_client, user, room, rooms
    ):
        """Test filtering bookings by room ID."""
        # Create bookings for different rooms
        from django.utils import timezone

        now = timezone.now()

        Booking.objects.create(
            room=room,
            user=user,
            start_time=now + timedelta(days=1, hours=10),
            date=(now + timedelta(days=1, hours=10)).date(),
            end_time=now + timedelta(days=1, hours=12),
        )

        other_room = Room.objects.first()
        Booking.objects.create(
            room=other_room,
            user=user,
            start_time=now + timedelta(days=2, hours=10),
            date=(now + timedelta(days=2, hours=10)).date(),
            end_time=now + timedelta(days=2, hours=12),
        )

        # Filter by room
        response = authenticated_api_client.get(f"/api/bookings/?room={room.id}")

        assert response.status_code == 200
        for booking_data in response.data["results"]:
            assert booking_data["room"] == room.id

    # ========================================================================
    # Date Filter Tests
    # ========================================================================

    def test_filter_bookings_by_date(
        self, db, authenticated_api_client, user, room, booking
    ):
        """Test filtering bookings by date."""
        # Create a booking for tomorrow
        tomorrow = booking.start_time + timedelta(days=1)
        Booking.objects.create(
            room=room,
            user=user,
            start_time=tomorrow,
            end_time=tomorrow + timedelta(hours=2),
        )

        # Filter by today's date
        today_str = booking.start_time.date().isoformat()
        response = authenticated_api_client.get(f"/api/bookings/?date={today_str}")

        assert response.status_code == 200
        for booking_data in response.data["results"]:
            assert booking.start_time.date().isoformat() in booking_data["start_time"]

    # ========================================================================
    # Month Filter Tests
    # ========================================================================

    def test_filter_bookings_by_month(
        self, db, authenticated_api_client, user, room, booking
    ):
        """Test filtering bookings by month (YYYY-MM format)."""
        # Get current month
        current_month = booking.start_time.strftime("%Y-%m")

        response = authenticated_api_client.get(f"/api/bookings/?month={current_month}")

        assert response.status_code == 200
        # All returned bookings should be in the specified month

    def test_filter_bookings_invalid_month_format(
        self, db, authenticated_api_client, user, room
    ):
        """Test that invalid month format returns validation error."""
        response = authenticated_api_client.get("/api/bookings/?month=invalid")

        # Should return 400 with validation error
        assert response.status_code == 400
        assert "Invalid month parameter" in str(response.data)

    # ========================================================================
    # Create Booking Tests
    # ========================================================================

    def test_create_booking_success(
        self, db, authenticated_api_client, user, room, future_start_time
    ):
        """Test successful booking creation."""
        start = future_start_time
        response = authenticated_api_client.post(
            "/api/bookings/",
            {
                "room": room.id,
                "start_time": start.isoformat(),
                "end_time": (start + timedelta(hours=2)).isoformat(),
            },
            format="json",
        )

        assert response.status_code == 201
        assert response.data["room"] == room.id
        assert response.data["user"] == user.id

    def test_create_booking_auto_assigns_user(
        self, db, authenticated_api_client, user, room, future_start_time
    ):
        """Test that user is automatically assigned to booking."""
        start = future_start_time
        response = authenticated_api_client.post(
            "/api/bookings/",
            {
                "room": room.id,
                "start_time": start.isoformat(),
                "end_time": (start + timedelta(hours=2)).isoformat(),
            },
            format="json",
        )

        assert response.status_code == 201
        assert response.data["user"] == user.id

    def test_create_booking_past_time_rejected(
        self, db, authenticated_api_client, room, utc_now
    ):
        """Test that booking in the past is rejected."""
        past = utc_now - timedelta(hours=1)
        response = authenticated_api_client.post(
            "/api/bookings/",
            {
                "room": room.id,
                "start_time": past.isoformat(),
                "end_time": utc_now.isoformat(),
            },
            format="json",
        )

        assert response.status_code == 400

    def test_create_booking_overlap_rejected(
        self, db, authenticated_api_client, user, room, booking
    ):
        """Test that overlapping booking is rejected."""
        response = authenticated_api_client.post(
            "/api/bookings/",
            {
                "room": room.id,
                "start_time": booking.start_time.isoformat(),
                "end_time": booking.end_time.isoformat(),
            },
            format="json",
        )

        assert response.status_code == 400
        assert "already booked" in str(response.data).lower()

    # ========================================================================
    # Retrieve Booking Tests
    # ========================================================================

    def test_retrieve_own_booking(self, db, authenticated_api_client, user, booking):
        """Test retrieving a booking you own."""
        response = authenticated_api_client.get(f"/api/bookings/{booking.id}/")

        assert response.status_code == 200
        assert response.data["id"] == booking.id

    def test_cannot_retrieve_others_booking(
        self, db, api_client, user, staff_user, room
    ):
        """Test that you cannot retrieve other users' bookings."""
        # Create a booking for another user
        other_booking = Booking.objects.create(
            room=room,
            user=staff_user,
            start_time=timezone.now() + timedelta(days=1),
            end_time=timezone.now() + timedelta(days=1, hours=2),
        )

        # Authenticate as regular user
        refresh = RefreshToken.for_user(user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        response = api_client.get(f"/api/bookings/{other_booking.id}/")

        # Should return 404 (not found in user's bookings)
        assert response.status_code == 404

    # ========================================================================
    # Update Booking Tests
    # ========================================================================

    def test_update_own_booking(
        self, db, authenticated_api_client, user, booking, future_start_time
    ):
        """Test updating a booking you own."""
        from django.utils import timezone as tz

        berlin_tz = tz.get_default_timezone()
        # Set new start to 10:00 Berlin time, 1 day ahead
        new_start = (
            (future_start_time + timedelta(days=1))
            .astimezone(berlin_tz)
            .replace(hour=10, minute=0, second=0, microsecond=0)
        )

        response = authenticated_api_client.put(
            f"/api/bookings/{booking.id}/",
            {
                "room": booking.room.id,
                "start_time": new_start.isoformat(),
                "end_time": (new_start + timedelta(hours=3)).isoformat(),
            },
            format="json",
        )

        assert response.status_code == 200

    def test_partial_update_booking(self, db, authenticated_api_client, booking):
        """Test partial update of a booking."""
        response = authenticated_api_client.patch(
            f"/api/bookings/{booking.id}/", {"room": booking.room.id}, format="json"
        )

        assert response.status_code == 200

    # ========================================================================
    # Delete Booking Tests
    # ========================================================================

    def test_delete_own_booking(self, db, authenticated_api_client, booking):
        """Test deleting a booking you own."""
        response = authenticated_api_client.delete(f"/api/bookings/{booking.id}/")

        assert response.status_code == 204

    def test_delete_booking_removes_from_db(
        self, db, authenticated_api_client, booking
    ):
        """Test that deleted booking is removed from database."""
        booking_id = booking.id
        response = authenticated_api_client.delete(f"/api/bookings/{booking.id}/")

        assert response.status_code == 204
        assert not Booking.objects.filter(id=booking_id).exists()

    # ========================================================================
    # Response Data Tests
    # ========================================================================

    def test_booking_includes_room_name(self, db, authenticated_api_client, booking):
        """Test that booking response includes room name."""
        response = authenticated_api_client.get(f"/api/bookings/{booking.id}/")

        assert response.status_code == 200
        assert "room_name" in response.data
        assert response.data["room_name"] == booking.room.name

    def test_booking_times_in_berlin_timezone(
        self, db, authenticated_api_client, booking
    ):
        """Test that booking times are returned in Berlin timezone."""
        response = authenticated_api_client.get(f"/api/bookings/{booking.id}/")

        assert response.status_code == 200
        # Times should be in ISO format with timezone
        assert "+" in response.data["start_time"] or response.data[
            "start_time"
        ].endswith("Z")

    # ========================================================================
    # In-Progress Booking Protection Tests
    # ========================================================================

    def test_cannot_modify_booking_in_progress(
        self, db, authenticated_api_client, user, room
    ):
        """Test that a booking currently in progress cannot be modified."""
        from django.utils import timezone

        now = timezone.now()

        # Booking: started 30 min ago, ends in 30 min (in progress)
        booking = Booking.objects.create(
            room=room,
            user=user,
            start_time=now - timedelta(minutes=30),
            end_time=now + timedelta(minutes=30),
            date=(now - timedelta(minutes=30)).date(),
        )

        # Try to modify it
        response = authenticated_api_client.patch(
            f"/api/bookings/{booking.id}/",
            {
                "room": room.id,
                "start_time": (now + timedelta(days=1, hours=10)).isoformat(),
                "end_time": (now + timedelta(days=1, hours=12)).isoformat(),
            },
            format="json",
        )

        # Should return 403 Forbidden
        assert response.status_code == 403
        assert "currently in progress" in str(response.data).lower()

    def test_cannot_modify_ended_booking(
        self, db, authenticated_api_client, user, room
    ):
        """Test that a booking that has ended cannot be modified."""
        from django.utils import timezone

        now = timezone.now()

        # Create a booking that ended 1 hour ago
        booking = Booking.objects.create(
            room=room,
            user=user,
            start_time=now - timedelta(hours=2),
            end_time=now - timedelta(hours=1),
            date=(now - timedelta(hours=2)).date(),
        )

        # Try to modify it
        response = authenticated_api_client.patch(
            f"/api/bookings/{booking.id}/",
            {
                "room": room.id,
                "start_time": (now + timedelta(days=1, hours=10)).isoformat(),
                "end_time": (now + timedelta(days=1, hours=12)).isoformat(),
            },
            format="json",
        )

        # Should return 403 Forbidden
        assert response.status_code == 403
        assert "already ended" in str(response.data).lower()

    def test_cannot_delete_booking_in_progress(
        self, db, authenticated_api_client, user, room
    ):
        """Test that a booking currently in progress cannot be deleted."""
        from django.utils import timezone

        now = timezone.now()

        # Booking: started 30 min ago, ends in 30 min (in progress)
        booking = Booking.objects.create(
            room=room,
            user=user,
            start_time=now - timedelta(minutes=30),
            end_time=now + timedelta(minutes=30),
            date=(now - timedelta(minutes=30)).date(),
        )

        # Try to delete it
        response = authenticated_api_client.delete(f"/api/bookings/{booking.id}/")

        # Should return 403 Forbidden
        assert response.status_code == 403
        assert "currently in progress" in str(response.data).lower()

    def test_cannot_delete_ended_booking(
        self, db, authenticated_api_client, user, room
    ):
        """Test that a booking that has ended cannot be deleted."""
        from django.utils import timezone

        now = timezone.now()

        # Create a booking that ended 1 hour ago
        booking = Booking.objects.create(
            room=room,
            user=user,
            start_time=now - timedelta(hours=2),
            end_time=now - timedelta(hours=1),
            date=(now - timedelta(hours=2)).date(),
        )

        # Try to delete it
        response = authenticated_api_client.delete(f"/api/bookings/{booking.id}/")

        # Should return 403 Forbidden
        assert response.status_code == 403
        assert "already ended" in str(response.data).lower()

    def test_can_modify_upcoming_booking(
        self, db, authenticated_api_client, user, room
    ):
        """Test that an upcoming (not started) booking can still be modified."""
        from django.utils import timezone as tz

        now = tz.now()

        # Create a booking that starts in 1 hour (upcoming)
        booking = Booking.objects.create(
            room=room,
            user=user,
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=3),
            date=(now + timedelta(hours=1)).date(),
        )

        # Move to 10:00 Berlin time, 2 days from now (within office hours)
        berlin_tz = tz.get_default_timezone()
        new_start = (
            (now + timedelta(days=2))
            .astimezone(berlin_tz)
            .replace(hour=10, minute=0, second=0, microsecond=0)
        )
        response = authenticated_api_client.patch(
            f"/api/bookings/{booking.id}/",
            {
                "room": room.id,
                "start_time": new_start.isoformat(),
                "end_time": (new_start + timedelta(hours=2)).isoformat(),
            },
            format="json",
        )

        # Should succeed (200 OK)
        assert response.status_code == 200
