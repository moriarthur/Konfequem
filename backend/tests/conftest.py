"""
Shared fixtures and configuration for pytest.

This module provides common fixtures used across all test modules,
including database fixtures, authentication helpers, and test data factories.
"""

import pytest
from datetime import timedelta, time
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from freezegun import freeze_time

from rooms.models import Room, Booking, RoomFeature
from rooms.models_users import Organization

User = get_user_model()


# ============================================================================
# Timezone Fixtures
# ============================================================================


@pytest.fixture
def berlin_tz():
    """Return the Berlin timezone object."""
    return timezone.get_default_timezone()


@pytest.fixture
def utc_now():
    """Return current UTC time."""
    return timezone.now()


@pytest.fixture
def berlin_now(utc_now, berlin_tz):
    """Return current time in Berlin timezone."""
    return utc_now.astimezone(berlin_tz)


@pytest.fixture
def office_hours_start():
    """Return office hours start time (08:00)."""
    return time(8, 0)


@pytest.fixture
def office_hours_end():
    """Return office hours end time (22:00)."""
    return time(22, 0)


# ============================================================================
# Organization Fixtures
# ============================================================================


@pytest.fixture(autouse=True)
def organization(db):
    """Create a test organization (autouse — available in all tests)."""
    return Organization.objects.create(
        name="Test Organization",
        slug="test-org",
    )


# ============================================================================
# Authentication Fixtures
# ============================================================================


@pytest.fixture
def user(db, organization):
    """Create a standard test user."""
    return User.objects.create_user(
        username="testuser",
        email="testuser@example.com",
        password="testpass123",
        first_name="Test",
        last_name="User",
        organization=organization,
    )


@pytest.fixture
def staff_user(db, organization):
    """Create a staff user for admin tests."""
    return User.objects.create_user(
        username="staffuser",
        email="staff@example.com",
        password="staffpass123",
        first_name="Staff",
        last_name="User",
        is_staff=True,
        organization=organization,
    )


@pytest.fixture
def org_admin(db, organization):
    """Create an organization admin (role='org_admin')."""
    return User.objects.create_user(
        username="orgadmin",
        email="orgadmin@example.com",
        password="adminpass123",
        first_name="Org",
        last_name="Admin",
        role="org_admin",
        organization=organization,
    )


@pytest.fixture
def authenticated_client(client, user):
    """Return an authenticated APIClient for the given user."""
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return client


@pytest.fixture
def api_client():
    """Return a fresh APIClient instance."""
    return APIClient()


@pytest.fixture
def authenticated_api_client(api_client, user):
    """Return an authenticated APIClient instance."""
    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return api_client


@pytest.fixture
def admin_api_client(api_client, org_admin):
    """Return an authenticated APIClient for the org admin."""
    refresh = RefreshToken.for_user(org_admin)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return api_client


@pytest.fixture
def staff_api_client(api_client, staff_user):
    """Return an authenticated APIClient for the staff user."""
    refresh = RefreshToken.for_user(staff_user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return api_client


# ============================================================================
# Model Fixtures
# ============================================================================


@pytest.fixture
def room_features(db):
    """Create a fixed set of room features."""
    features = [
        RoomFeature(name="Projector", icon="projector"),
        RoomFeature(name="Whiteboard", icon="whiteboard"),
        RoomFeature(name="Phone", icon="phone"),
    ]
    return list(RoomFeature.objects.bulk_create(features))


@pytest.fixture
def room(db, organization):
    """Create a standard test room."""
    return Room.objects.create(
        name="Conference Room A",
        location="Floor 1",
        capacity=10,
        organization=organization,
    )


@pytest.fixture
def small_room(db, organization):
    """Create a small room (capacity 2)."""
    return Room.objects.create(
        name="Huddle Room", location="Floor 2", capacity=2, organization=organization
    )


@pytest.fixture
def large_room(db, organization):
    """Create a large room (capacity 50)."""
    return Room.objects.create(
        name="Main Hall",
        location="Ground Floor",
        capacity=50,
        organization=organization,
    )


@pytest.fixture
def rooms(db, organization):
    """Create multiple test rooms."""
    rooms = [
        Room(
            name=f"Room {i}",
            location=f"Floor {i % 3}",
            capacity=5 + i * 5,
            organization=organization,
        )
        for i in range(1, 6)
    ]
    return Room.objects.bulk_create(rooms)


# ============================================================================
# Booking Fixtures
# ============================================================================


@pytest.fixture
def future_start_time(utc_now):
    """Return a start time in the future, within office hours (8-22 Berlin)."""
    berlin_tz = timezone.get_default_timezone()
    local_time = utc_now.astimezone(berlin_tz)

    # Start with tomorrow 10:00 as safe default, then try today if possible
    candidate = (local_time + timedelta(days=1)).replace(
        hour=10, minute=0, second=0, microsecond=0
    )

    # If there's still time today (before 20:00), use today at +1h rounded up
    if local_time.hour < 20:
        today_candidate = local_time + timedelta(hours=1)
        today_candidate = today_candidate.replace(minute=0, second=0, microsecond=0)
        if today_candidate.hour < 8:
            today_candidate = today_candidate.replace(hour=8)
        # Make sure it's actually in the future
        if today_candidate > local_time:
            candidate = today_candidate

    return candidate


@pytest.fixture
def booking(db, user, room, organization, future_start_time):
    """Create a valid test booking (2 hours duration)."""
    return Booking.objects.create(
        room=room,
        user=user,
        organization=organization,
        start_time=future_start_time,
        end_time=future_start_time + timedelta(hours=2),
    )


@pytest.fixture
def past_booking(db, user, room, organization):
    """Create a booking in the past (for testing retrieval)."""
    past_time = timezone.now() - timedelta(days=1)
    return Booking.objects.create(
        room=room,
        user=user,
        organization=organization,
        start_time=past_time,
        end_time=past_time + timedelta(hours=1),
    )


@pytest.fixture
def today_bookings(db, user, room, organization, future_start_time):
    """Create multiple bookings starting from future_start_time."""
    bookings = []
    base_time = future_start_time

    # Create non-overlapping bookings
    for i in range(3):
        start = base_time + timedelta(hours=i * 3)
        bookings.append(
            Booking(
                room=room,
                user=user,
                organization=organization,
                start_time=start,
                end_time=start + timedelta(hours=2),
            )
        )

    return Booking.objects.bulk_create(bookings)


# ============================================================================
# Time-based fixtures for testing edge cases
# ============================================================================


@pytest.fixture
def frozen_time():
    """Return a context manager for freezing time."""
    return freeze_time


@pytest.fixture
def tomorrow(utc_now):
    """Return tomorrow's date."""
    return (utc_now + timedelta(days=1)).date()


@pytest.fixture
def next_month(utc_now):
    """Return a date approximately one month from now."""
    return (utc_now + timedelta(days=30)).date()


@pytest.fixture
def max_booking_date(utc_now):
    """Return the maximum allowed booking date (90 days from now)."""
    return utc_now + timedelta(days=90)


@pytest.fixture
def beyond_max_booking_date(utc_now):
    """Return a date beyond the maximum allowed booking limit."""
    return utc_now + timedelta(days=91)


# ============================================================================
# JWT Token Fixtures
# ============================================================================


@pytest.fixture
def jwt_tokens(user):
    """Return access and refresh tokens for the given user."""
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


@pytest.fixture
def expired_token():
    """Return an expired JWT token for testing auth failures."""
    # This would typically be hardcoded or generated with expired time
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDB9.expired"


# ============================================================================
# Test Data Generators
# ============================================================================


@pytest.fixture
def booking_data(room, future_start_time):
    """Return valid booking data dict for API requests."""
    return {
        "room": room.id,
        "start_time": future_start_time.isoformat(),
        "end_time": (future_start_time + timedelta(hours=2)).isoformat(),
    }


@pytest.fixture
def invalid_booking_data(room, utc_now):
    """Return invalid booking data for testing validation."""
    return {
        "room": room.id,
        "start_time": (utc_now - timedelta(hours=1)).isoformat(),  # Past time
        "end_time": utc_now.isoformat(),
    }


# ============================================================================
# Cleanup
# ============================================================================


@pytest.fixture(autouse=True)
def clear_cache():
    """Clear Django cache before each test."""
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def disable_throttling():
    """Disable rate limiting during tests unless explicitly re-enabled.

    Mutates SimpleRateThrottle.THROTTLE_RATES in place — it is a class-level
    snapshot of settings captured at import time, so replacing the dict in
    django settings (or reloading api_settings) is invisible to it. A rate
    of None disables a throttle; a missing key would raise
    ImproperlyConfigured.
    """
    SimpleRateThrottle.THROTTLE_RATES.update(
        {key: None for key in SimpleRateThrottle.THROTTLE_RATES}
    )


@pytest.fixture
def enable_scoped_throttling():
    """Re-enable scoped throttling with low rates for testing.

    Must run after disable_throttling (autouse fixtures are set up first),
    and mutates THROTTLE_RATES in place for the same reason.
    """
    SimpleRateThrottle.THROTTLE_RATES.update(
        {
            "login": "3/min",
            "token_refresh": "2/min",
            "register": "2/min",
            "join": "2/min",
            "invite_preview": "2/min",
            "change_password": "2/min",
            "regenerate_invite": "2/min",
            "token_blacklist": "2/min",
        }
    )
