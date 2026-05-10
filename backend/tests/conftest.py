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
from rest_framework_simplejwt.tokens import RefreshToken
from freezegun import freeze_time

from rooms.models import Room, Booking

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
# Authentication Fixtures
# ============================================================================


@pytest.fixture
def user(db):
    """Create a standard test user."""
    return User.objects.create_user(
        username="testuser",
        email="testuser@example.com",
        password="testpass123",
        first_name="Test",
        last_name="User",
    )


@pytest.fixture
def staff_user(db):
    """Create a staff user for admin tests."""
    return User.objects.create_user(
        username="staffuser",
        email="staff@example.com",
        password="staffpass123",
        first_name="Staff",
        last_name="User",
        is_staff=True,
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


# ============================================================================
# Model Fixtures
# ============================================================================


@pytest.fixture
def room(db):
    """Create a standard test room."""
    return Room.objects.create(
        name="Conference Room A", location="Floor 1", capacity=10
    )


@pytest.fixture
def small_room(db):
    """Create a small room (capacity 2)."""
    return Room.objects.create(name="Huddle Room", location="Floor 2", capacity=2)


@pytest.fixture
def large_room(db):
    """Create a large room (capacity 50)."""
    return Room.objects.create(name="Main Hall", location="Ground Floor", capacity=50)


@pytest.fixture
def rooms(db):
    """Create multiple test rooms."""
    rooms = [
        Room(name=f"Room {i}", location=f"Floor {i % 3}", capacity=5 + i * 5)
        for i in range(1, 6)
    ]
    return Room.objects.bulk_create(rooms)


# ============================================================================
# Booking Fixtures
# ============================================================================


@pytest.fixture
def future_start_time(utc_now):
    """Return a start time 1 hour in the future (within office hours)."""
    future = utc_now + timedelta(hours=1)
    # Ensure we're within office hours (8:00 - 22:00 Berlin time)
    berlin_tz = timezone.get_default_timezone()
    local_time = future.astimezone(berlin_tz)
    if local_time.hour < 8:
        future = future.replace(hour=8, minute=0, second=0, microsecond=0)
    elif local_time.hour >= 22:
        future = future.replace(hour=8, minute=0, second=0, microsecond=0) + timedelta(
            days=1
        )
    return future


@pytest.fixture
def booking(db, user, room, future_start_time):
    """Create a valid test booking (2 hours duration)."""
    return Booking.objects.create(
        room=room,
        user=user,
        start_time=future_start_time,
        end_time=future_start_time + timedelta(hours=2),
    )


@pytest.fixture
def past_booking(db, user, room):
    """Create a booking in the past (for testing retrieval)."""
    past_time = timezone.now() - timedelta(days=1)
    return Booking.objects.create(
        room=room,
        user=user,
        start_time=past_time,
        end_time=past_time + timedelta(hours=1),
    )


@pytest.fixture
def today_bookings(db, user, room, berlin_now):
    """Create multiple bookings for today for testing overlap logic."""
    bookings = []
    base_time = berlin_now.replace(hour=9, minute=0, second=0, microsecond=0)

    # Create non-overlapping bookings
    for i in range(3):
        start = base_time + timedelta(hours=i * 3)
        bookings.append(
            Booking(
                room=room,
                user=user,
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
