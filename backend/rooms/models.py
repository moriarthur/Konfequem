from django.db import models
from django.conf import settings
from django.core.validators import (
    MinValueValidator,
    MaxValueValidator,
    ValidationError,
    RegexValidator,
)
from django.utils import timezone
from django.db.models import Q

from .models_users import Organization, User  # noqa: F401 — register models with Django
from .validators import booking_time_errors


class RoomFeature(models.Model):
    """Features/amenities that rooms can have."""

    name = models.CharField(max_length=100)
    icon = models.CharField(
        max_length=50,
        blank=True,
        help_text=(
            "Icon name for UI "
            "(e.g., 'projector', 'wifi', 'coffee', 'capacity', "
            "'whiteboard', 'phone', 'tv')"
        ),
    )

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Room Feature"
        verbose_name_plural = "Room Features"
        ordering = ["name"]


class Room(models.Model):
    """Room model."""

    organization = models.ForeignKey(
        "Organization",
        on_delete=models.CASCADE,
        related_name="rooms",
    )
    name = models.CharField(
        max_length=100,
        validators=[
            RegexValidator(
                r"^[a-zA-Z0-9\s\-\.]+$",
                message=(
                    "Room name can only contain letters, numbers, "
                    "spaces, hyphens, and periods."
                ),
            )
        ],
    )
    location = models.CharField(max_length=100, blank=True)
    capacity = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(50)]
    )
    features = models.ManyToManyField(
        RoomFeature,
        blank=True,
        related_name="rooms",
        help_text="Amenities and equipment available in this room",
    )

    def __str__(self):
        return self.name


class Booking(models.Model):
    """Booking model with minimal backend validation."""

    organization = models.ForeignKey(
        "Organization",
        on_delete=models.CASCADE,
        related_name="bookings",
    )
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="bookings")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bookings",
    )
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(
        max_length=20,
        default="ongoing",
        choices=[
            ("ongoing", "Ongoing"),
            ("completed", "Completed"),
            ("cancelled", "Cancelled"),
        ],
        help_text="Current status of the booking",
    )
    date = models.DateField(db_index=True)

    MAX_DAYS_AHEAD = 90

    class Meta:
        indexes = [
            models.Index(fields=["start_time"], name="rooms_booking_start_idx"),
        ]

    @staticmethod
    def overlapping(room, start, end, exclude_pk=None):
        """Active bookings for the room overlapping [start, end).

        Cancelled bookings are history and don't block — matching the
        serializer and the partial DB exclusion constraint (migration 0004).
        """
        overlapping = (
            Booking.objects.filter(room=room)
            .exclude(status="cancelled")
            .filter(Q(start_time__lt=end) & Q(end_time__gt=start))
        )
        if exclude_pk:
            overlapping = overlapping.exclude(pk=exclude_pk)
        return overlapping

    def clean(self):
        super().clean()
        # Same rules as the API serializer (rooms/validators.py) — the
        # admin gets office hours and duration limits too, not just the API.
        errors = {}
        for field, message in booking_time_errors(
            self.start_time, self.end_time, max_days_ahead=self.MAX_DAYS_AHEAD
        ):
            errors.setdefault(field, []).append(message)

        if (
            self.room_id
            and self.start_time
            and self.end_time
            and self.overlapping(
                self.room, self.start_time, self.end_time, exclude_pk=self.pk
            ).exists()
        ):
            errors.setdefault("non_field_errors", []).append(
                "This room is already booked for the selected time range."
            )

        # --- Tenant consistency ---
        # organization, room.organization and user.organization must agree.
        # The API enforces this in the serializer; admin/ORM writes get it
        # here — a mismatched row would leak a foreign room name into the
        # org's availability feed.
        if (
            self.organization_id
            and self.room_id
            and self.room.organization_id != self.organization_id
        ):
            errors.setdefault("non_field_errors", []).append(
                "Room does not belong to the booking's organization."
            )
        if (
            self.organization_id
            and self.user_id
            and self.user.organization_id != self.organization_id
        ):
            errors.setdefault("non_field_errors", []).append(
                "User does not belong to the booking's organization."
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.start_time:
            self.date = self.start_time.date()
        super().save(*args, **kwargs)

    @property
    def current_status(self):
        """Effective status: stored 'cancelled' wins, otherwise derived from times.

        The stored `status` column defaults to 'ongoing' and is never
        recomputed, so it is only meaningful as a 'cancelled' marker.
        """
        if self.status == "cancelled":
            return "cancelled"
        now = timezone.now()
        if now < self.start_time:
            return "upcoming"
        if now < self.end_time:
            return "ongoing"
        return "completed"

    def __str__(self):
        start_str = self.start_time.strftime("%H:%M")
        end_str = self.end_time.strftime("%H:%M")
        return f"{self.room.name} — {start_str} to {end_str}"
