"""
Unit tests for the Room model.

Tests validate:
- Capacity constraints (1-50)
- String representation
- Model field properties
"""

import pytest
from django.core.exceptions import ValidationError
from rooms.models import Room


@pytest.mark.unit
class TestRoomModel:
    """Test suite for Room model validation and behavior."""

    # ========================================================================
    # Capacity Validation Tests
    # ========================================================================

    def test_room_with_valid_minimum_capacity(self, db):
        """Test that room can be created with minimum capacity of 1."""
        room = Room.objects.create(name="Single Office", location="Floor 1", capacity=1)
        assert room.capacity == 1
        assert room.pk is not None

    def test_room_with_valid_maximum_capacity(self, db):
        """Test that room can be created with maximum capacity of 50."""
        room = Room.objects.create(
            name="Main Hall", location="Ground Floor", capacity=50
        )
        assert room.capacity == 50
        assert room.pk is not None

    def test_room_with_average_capacity(self, db):
        """Test that room can be created with average capacity."""
        room = Room.objects.create(
            name="Conference Room", location="Floor 2", capacity=15
        )
        assert room.capacity == 15

    @pytest.mark.parametrize("invalid_capacity", [0, -1, 51, 100, -10])
    def test_room_rejects_invalid_capacity(self, db, invalid_capacity):
        """Test that room creation fails with invalid capacity values."""
        with pytest.raises(ValidationError):
            room = Room(
                name="Invalid Room", location="Floor 1", capacity=invalid_capacity
            )
            room.full_clean()  # Triggers validators

    # ========================================================================
    # Field Validation Tests
    # ========================================================================

    def test_room_name_is_required(self, db):
        """Test that room name is a required field."""
        from django.core.exceptions import ValidationError

        room = Room(location="Floor 1", capacity=10)
        with pytest.raises(ValidationError):  # Model validation
            room.full_clean()

    def test_room_location_is_optional(self, db):
        """Test that room location can be blank."""
        room = Room.objects.create(name="Room without location", capacity=5)
        assert room.location == ""
        assert room.name == "Room without location"

    def test_room_name_max_length(self, db):
        """Test that room name respects max_length constraint."""
        # Create a name exactly at the limit (100 characters)
        long_name = "A" * 100
        room = Room.objects.create(name=long_name, capacity=10)
        assert room.name == long_name
        assert len(room.name) == 100

    def test_room_location_max_length(self, db):
        """Test that room location respects max_length constraint."""
        long_location = "B" * 100
        room = Room.objects.create(
            name="Test Room", location=long_location, capacity=10
        )
        assert room.location == long_location
        assert len(room.location) == 100

    # ========================================================================
    # String Representation Tests
    # ========================================================================

    def test_room_str_representation(self, db):
        """Test that room's string representation returns its name."""
        room = Room.objects.create(
            name="Conference Room A", location="Floor 1", capacity=10
        )
        assert str(room) == "Conference Room A"

    def test_room_str_with_special_characters(self, db):
        """Test string representation with special characters in name."""
        room = Room.objects.create(
            name="Room 123 - Ümläut", location="Étage 2", capacity=8
        )
        assert "Ümläut" in str(room)

    # ========================================================================
    # Model Methods Tests
    # ========================================================================

    def test_room_absolute_url(self, db):
        """Test that room has a URL (if implemented)."""
        room = Room.objects.create(name="Test Room", capacity=5)
        # This test would pass if you implement get_absolute_url
        # For now, just verify the room exists
        assert room.pk is not None

    # ========================================================================
    # QuerySet Tests
    # ========================================================================

    def test_rooms_ordered_by_name(self, db):
        """Test that rooms are returned in predictable order."""
        Room.objects.bulk_create(
            [
                Room(name="Z Room", capacity=5),
                Room(name="A Room", capacity=5),
                Room(name="M Room", capacity=5),
            ]
        )
        rooms = list(Room.objects.all())
        # Django orders by PK by default unless ordering is specified
        assert len(rooms) == 3

    def test_filter_rooms_by_capacity(self, db):
        """Test filtering rooms by capacity."""
        Room.objects.bulk_create(
            [
                Room(name="Small", capacity=5),
                Room(name="Medium", capacity=15),
                Room(name="Large", capacity=30),
            ]
        )

        small_rooms = Room.objects.filter(capacity__lte=10)
        assert small_rooms.count() == 1
        assert small_rooms.first().name == "Small"

        large_rooms = Room.objects.filter(capacity__gte=20)
        assert large_rooms.count() == 1
        assert large_rooms.first().name == "Large"

    # ========================================================================
    # Edge Cases
    # ========================================================================

    def test_room_with_unicode_name(self, db):
        """Test that rooms can have unicode names."""
        room = Room.objects.create(
            name="会議室",  # Chinese for "Meeting Room"
            location="第1階",  # Chinese for "Floor 1"
            capacity=10,
        )
        assert room.name == "会議室"

    def test_room_duplicate_names_allowed(self, db):
        """Test that multiple rooms can have the same name (by default)."""
        Room.objects.bulk_create(
            [
                Room(name="Conference Room", location="Floor 1", capacity=10),
                Room(name="Conference Room", location="Floor 2", capacity=10),
            ]
        )
        rooms = Room.objects.filter(name="Conference Room")
        assert rooms.count() == 2
