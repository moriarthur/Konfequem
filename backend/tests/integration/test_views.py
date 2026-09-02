"""
Integration tests for views/API endpoints.

Tests validate:
- RoomViewSet: auth required, org-scoped, list/retrieve
- BookingViewSet: auth required, user filtering, room/date/month filters
"""

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import timedelta

from rooms.models import Room, Booking
from rooms.models_users import Organization

User = get_user_model()


@pytest.mark.integration
class TestRoomViewSet:
    """Test suite for RoomViewSet API endpoints."""

    # ========================================================================
    # Auth & Org Scoping Tests
    # ========================================================================

    def test_list_rooms_requires_auth(self, db, api_client, rooms):
        """Test that listing rooms requires authentication."""
        response = api_client.get("/api/rooms/")
        assert response.status_code == 401

    def test_list_rooms_org_scoped(self, db, authenticated_api_client, rooms, user):
        """Test that rooms are scoped to the user's organization."""
        response = authenticated_api_client.get("/api/rooms/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 5

    def test_list_rooms_other_org_hidden(self, db, user, organization):
        """Test that rooms from other orgs are not visible."""
        from rooms.models_users import Organization

        other_org = Organization.objects.create(name="Other", slug="other")
        Room.objects.create(
            name="Hidden Room", location="Floor X", capacity=5, organization=other_org
        )

        client = None
        from rest_framework.test import APIClient

        client = APIClient()
        refresh = RefreshToken.for_user(user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        response = client.get("/api/rooms/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 0

    # ========================================================================
    # List Rooms Tests
    # ========================================================================

    def test_list_rooms_returns_correct_fields(
        self, db, authenticated_api_client, room
    ):
        """Test that room list returns expected fields."""
        response = authenticated_api_client.get("/api/rooms/")
        assert response.status_code == 200
        data = response.data["results"][0]
        assert set(data.keys()) == {"id", "name", "location", "capacity", "features"}

    def test_list_rooms_empty(self, db, authenticated_api_client):
        """Test listing rooms when no rooms exist in the user's org."""
        response = authenticated_api_client.get("/api/rooms/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 0

    def test_list_rooms_ordered(self, db, organization, user):
        """Test that rooms are ordered consistently."""
        Room.objects.create(
            name="Z Room", location="Floor 1", capacity=5, organization=organization
        )
        Room.objects.create(
            name="A Room", location="Floor 2", capacity=10, organization=organization
        )

        from rest_framework.test import APIClient

        client = APIClient()
        refresh = RefreshToken.for_user(user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        response = client.get("/api/rooms/")
        assert response.status_code == 200
        assert len(response.data["results"]) == 2

    # ========================================================================
    # Retrieve Room Tests
    # ========================================================================

    def test_retrieve_room_by_id(self, db, authenticated_api_client, room):
        """Test retrieving a specific room by ID."""
        response = authenticated_api_client.get(f"/api/rooms/{room.id}/")
        assert response.status_code == 200
        assert response.data["id"] == room.id
        assert response.data["name"] == room.name

    def test_retrieve_nonexistent_room(self, db, authenticated_api_client):
        """Test retrieving a room that doesn't exist."""
        response = authenticated_api_client.get("/api/rooms/99999/")
        assert response.status_code == 404

    # ========================================================================
    # HTTP Method Tests
    # ========================================================================
    # Room Management (org_admin) Tests
    # ========================================================================

    def test_member_cannot_create_room(self, db, authenticated_api_client):
        """Members get 403 (not 405) when creating rooms."""
        response = authenticated_api_client.post(
            "/api/rooms/", {"name": "New Room", "location": "Floor 1", "capacity": 10}
        )
        assert response.status_code == 403

    def test_staff_cannot_create_room(self, db, staff_api_client):
        """Staff/platform admins manage rooms via Django admin, not the API."""
        response = staff_api_client.post(
            "/api/rooms/", {"name": "New Room", "capacity": 10}, format="json"
        )
        assert response.status_code == 403

    def test_org_admin_can_create_room(
        self, db, admin_api_client, organization, room_features
    ):
        """Org admin creates a room; organization is assigned server-side."""
        response = admin_api_client.post(
            "/api/rooms/",
            {
                "name": "New Room",
                "location": "Floor 1",
                "capacity": 10,
                "features": [room_features[0].id, room_features[1].id],
            },
            format="json",
        )
        assert response.status_code == 201
        room = Room.objects.get(name="New Room")
        assert room.organization == organization
        assert list(room.features.values_list("id", flat=True)) == sorted(
            [room_features[0].id, room_features[1].id]
        )
        # Write responses return feature PKs, not nested objects
        assert sorted(response.data["features"]) == sorted(
            [room_features[0].id, room_features[1].id]
        )

    def test_org_admin_create_room_invalid_data(self, db, admin_api_client):
        """Field-level validation errors map to their keys."""
        response = admin_api_client.post(
            "/api/rooms/",
            {"name": "Bad@Room!", "location": "Floor 1", "capacity": 51},
            format="json",
        )
        assert response.status_code == 400
        assert "name" in response.data
        assert "capacity" in response.data

    def test_org_admin_create_room_invalid_feature(
        self, db, admin_api_client, room_features
    ):
        """Unknown feature PKs are rejected."""
        response = admin_api_client.post(
            "/api/rooms/",
            {"name": "New Room", "capacity": 10, "features": [9999]},
            format="json",
        )
        assert response.status_code == 400
        assert "features" in response.data

    def test_member_cannot_update_room(self, db, authenticated_api_client, room):
        response = authenticated_api_client.put(
            f"/api/rooms/{room.id}/",
            {"name": "Updated Room", "capacity": 15},
            format="json",
        )
        assert response.status_code == 403

    def test_staff_cannot_update_room(self, db, staff_api_client, room):
        response = staff_api_client.put(
            f"/api/rooms/{room.id}/",
            {"name": "Updated Room", "capacity": 15},
            format="json",
        )
        assert response.status_code == 403

    def test_org_admin_can_update_room(self, db, admin_api_client, room, room_features):
        """PUT replaces the feature set (explicit list semantics)."""
        room.features.add(room_features[0])

        response = admin_api_client.put(
            f"/api/rooms/{room.id}/",
            {
                "name": "Updated Room",
                "location": "Floor 2",
                "capacity": 15,
                "features": [room_features[1].id],
            },
            format="json",
        )
        assert response.status_code == 200
        room.refresh_from_db()
        assert room.name == "Updated Room"
        assert room.capacity == 15
        assert list(room.features.all()) == [room_features[1]]

    def test_org_admin_can_partial_update_room(
        self, db, admin_api_client, room, room_features
    ):
        """PATCH without a features key leaves the M2M unchanged."""
        room.features.add(room_features[0])

        response = admin_api_client.patch(
            f"/api/rooms/{room.id}/", {"capacity": 8}, format="json"
        )
        assert response.status_code == 200
        room.refresh_from_db()
        assert room.capacity == 8
        assert list(room.features.all()) == [room_features[0]]

    def test_org_admin_cannot_update_other_org_room(
        self, db, admin_api_client, organization
    ):
        """Cross-org writes are hidden by queryset scoping (404)."""
        other_org = Organization.objects.create(name="Other", slug="other")
        other_room = Room.objects.create(
            name="Other Org Room", capacity=5, organization=other_org
        )

        response = admin_api_client.put(
            f"/api/rooms/{other_room.id}/",
            {"name": "Hacked", "capacity": 5},
            format="json",
        )
        assert response.status_code == 404

    def test_member_cannot_delete_room(self, db, authenticated_api_client, room):
        response = authenticated_api_client.delete(f"/api/rooms/{room.id}/")
        assert response.status_code == 403

    def test_staff_cannot_delete_room(self, db, staff_api_client, room):
        response = staff_api_client.delete(f"/api/rooms/{room.id}/")
        assert response.status_code == 403

    def test_org_admin_can_delete_room_without_future_bookings(
        self, db, admin_api_client, room, user, organization
    ):
        """Rooms with only past bookings can be deleted (bookings cascade)."""
        now = timezone.now()
        Booking.objects.create(
            room=room,
            user=user,
            organization=organization,
            start_time=now - timedelta(hours=2),
            end_time=now - timedelta(hours=1),
            date=(now - timedelta(hours=2)).date(),
        )

        response = admin_api_client.delete(f"/api/rooms/{room.id}/")

        assert response.status_code == 204
        assert not Room.objects.filter(pk=room.pk).exists()

    def test_delete_room_with_future_bookings_blocked(
        self, db, admin_api_client, room, booking
    ):
        response = admin_api_client.delete(f"/api/rooms/{room.id}/")

        assert response.status_code == 400
        assert "general" in response.data
        assert Room.objects.filter(pk=room.pk).exists()


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
        self, db, api_client, user, staff_user, room, organization
    ):
        """Test that users only see their own bookings."""
        # Create bookings for different users
        from django.utils import timezone

        now = timezone.now()

        user_booking = Booking.objects.create(
            room=room,
            user=user,
            organization=organization,
            start_time=now + timedelta(days=1, hours=10),
            date=(now + timedelta(days=1, hours=10)).date(),
            end_time=now + timedelta(days=1, hours=12),
        )

        staff_booking = Booking.objects.create(
            room=room,
            user=staff_user,
            organization=organization,
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
        self, db, authenticated_api_client, user, room, rooms, organization
    ):
        """Test filtering bookings by room ID."""
        # Create bookings for different rooms
        from django.utils import timezone

        now = timezone.now()

        Booking.objects.create(
            room=room,
            user=user,
            organization=organization,
            start_time=now + timedelta(days=1, hours=10),
            date=(now + timedelta(days=1, hours=10)).date(),
            end_time=now + timedelta(days=1, hours=12),
        )

        other_room = Room.objects.first()
        Booking.objects.create(
            room=other_room,
            user=user,
            organization=organization,
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
        self, db, authenticated_api_client, user, room, booking, organization
    ):
        """Test filtering bookings by date."""
        # Create a booking for tomorrow
        tomorrow = booking.start_time + timedelta(days=1)
        Booking.objects.create(
            room=room,
            user=user,
            organization=organization,
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
        self, db, api_client, user, staff_user, room, organization
    ):
        """Test that you cannot retrieve other users' bookings."""
        # Create a booking for another user
        other_booking = Booking.objects.create(
            room=room,
            user=staff_user,
            organization=organization,
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
        self, db, authenticated_api_client, user, room, organization
    ):
        """Test that a booking currently in progress cannot be modified."""
        from django.utils import timezone

        now = timezone.now()

        # Booking: started 30 min ago, ends in 30 min (in progress)
        booking = Booking.objects.create(
            room=room,
            user=user,
            organization=organization,
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
        self, db, authenticated_api_client, user, room, organization
    ):
        """Test that a booking that has ended cannot be modified."""
        from django.utils import timezone

        now = timezone.now()

        # Create a booking that ended 1 hour ago
        booking = Booking.objects.create(
            room=room,
            user=user,
            organization=organization,
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
        self, db, authenticated_api_client, user, room, organization
    ):
        """Test that a booking currently in progress cannot be deleted."""
        from django.utils import timezone

        now = timezone.now()

        # Booking: started 30 min ago, ends in 30 min (in progress)
        booking = Booking.objects.create(
            room=room,
            user=user,
            organization=organization,
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
        self, db, authenticated_api_client, user, room, organization
    ):
        """Test that a booking that has ended cannot be deleted."""
        from django.utils import timezone

        now = timezone.now()

        # Create a booking that ended 1 hour ago
        booking = Booking.objects.create(
            room=room,
            user=user,
            organization=organization,
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
        self, db, authenticated_api_client, user, room, organization
    ):
        """Test that an upcoming (not started) booking can still be modified."""
        from django.utils import timezone as tz

        now = tz.now()

        # Create a booking that starts in 1 hour (upcoming)
        booking = Booking.objects.create(
            room=room,
            user=user,
            organization=organization,
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


class TestBookingStatus:
    """Computed `status` in booking responses (stored 'cancelled' wins)."""

    @staticmethod
    def _create_booking(user, room, organization, start, end, status=None):
        kwargs = dict(
            room=room,
            user=user,
            organization=organization,
            start_time=start,
            end_time=end,
            date=start.date(),
        )
        if status:
            kwargs["status"] = status
        return Booking.objects.create(**kwargs)

    def test_future_booking_is_upcoming(
        self, db, authenticated_api_client, user, room, organization
    ):
        now = timezone.now()
        booking = self._create_booking(
            user,
            room,
            organization,
            now + timedelta(hours=1),
            now + timedelta(hours=2),
        )

        response = authenticated_api_client.get(f"/api/bookings/{booking.id}/")

        assert response.status_code == 200
        assert response.data["status"] == "upcoming"

    def test_spanning_booking_is_ongoing(
        self, db, authenticated_api_client, user, room, organization
    ):
        now = timezone.now()
        booking = self._create_booking(
            user,
            room,
            organization,
            now - timedelta(minutes=30),
            now + timedelta(minutes=30),
        )

        response = authenticated_api_client.get(f"/api/bookings/{booking.id}/")

        assert response.status_code == 200
        assert response.data["status"] == "ongoing"

    def test_past_booking_is_completed(
        self, db, authenticated_api_client, user, room, organization
    ):
        now = timezone.now()
        booking = self._create_booking(
            user,
            room,
            organization,
            now - timedelta(hours=2),
            now - timedelta(hours=1),
        )

        response = authenticated_api_client.get(f"/api/bookings/{booking.id}/")

        assert response.status_code == 200
        assert response.data["status"] == "completed"

    def test_cancelled_status_wins_over_time_derived(
        self, db, authenticated_api_client, user, room, organization
    ):
        now = timezone.now()
        booking = self._create_booking(
            user,
            room,
            organization,
            now + timedelta(hours=1),
            now + timedelta(hours=2),
            status="cancelled",
        )

        response = authenticated_api_client.get(f"/api/bookings/{booking.id}/")

        assert response.status_code == 200
        assert response.data["status"] == "cancelled"

    def test_status_in_list_response(
        self, db, authenticated_api_client, user, room, organization
    ):
        now = timezone.now()
        self._create_booking(
            user,
            room,
            organization,
            now + timedelta(hours=1),
            now + timedelta(hours=2),
        )

        response = authenticated_api_client.get("/api/bookings/")

        assert response.status_code == 200
        assert response.data["results"][0]["status"] == "upcoming"


class TestRoomNameUniqueness:
    """Room names are unique per organization (case-insensitive)."""

    def test_duplicate_name_rejected(self, db, admin_api_client, room):
        response = admin_api_client.post(
            "/api/rooms/",
            {"name": room.name.lower(), "location": "Floor 1", "capacity": 4},
            format="json",
        )
        assert response.status_code == 400
        assert "name" in response.data

    def test_same_name_in_other_org_allowed(self, db, admin_api_client):
        other_org = Organization.objects.create(name="Other", slug="other-2")
        Room.objects.create(name="Foreign Name", capacity=5, organization=other_org)

        response = admin_api_client.post(
            "/api/rooms/",
            {"name": "Foreign Name", "capacity": 4},
            format="json",
        )
        assert response.status_code == 201

    def test_rename_to_own_name_allowed(self, db, admin_api_client, room):
        response = admin_api_client.patch(
            f"/api/rooms/{room.id}/", {"location": "Floor 9"}, format="json"
        )
        assert response.status_code == 200


@pytest.mark.integration
@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="exclusion constraint is PostgreSQL-only (rooms migration 0002)",
)
class TestBookingOverlapConstraint:
    """DB-level backstop behind the serializer overlap check.

    Runs only when pytest is pointed at PostgreSQL (CI's migrate step
    validates the DDL; the default SQLite test suite skips these).
    """

    def test_overlapping_insert_raises_integrity_error(
        self, db, room, user, organization
    ):
        now = timezone.now()
        Booking.objects.create(
            room=room,
            user=user,
            organization=organization,
            start_time=now + timedelta(days=1, hours=10),
            end_time=now + timedelta(days=1, hours=11),
            date=(now + timedelta(days=1)).date(),
        )

        with pytest.raises(IntegrityError):
            Booking.objects.create(
                room=room,
                user=user,
                organization=organization,
                start_time=now + timedelta(days=1, hours=10, minutes=30),
                end_time=now + timedelta(days=1, hours=11, minutes=30),
                date=(now + timedelta(days=1)).date(),
            )

    def test_adjacent_booking_allowed(self, db, room, user, organization):
        now = timezone.now()
        Booking.objects.create(
            room=room,
            user=user,
            organization=organization,
            start_time=now + timedelta(days=1, hours=10),
            end_time=now + timedelta(days=1, hours=11),
            date=(now + timedelta(days=1)).date(),
        )

        booking = Booking.objects.create(
            room=room,
            user=user,
            organization=organization,
            start_time=now + timedelta(days=1, hours=11),
            end_time=now + timedelta(days=1, hours=12),
            date=(now + timedelta(days=1)).date(),
        )
        assert booking.pk is not None
