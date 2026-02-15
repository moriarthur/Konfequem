from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator, ValidationError, RegexValidator
from django.utils import timezone
from datetime import timedelta
from django.db.models import Q

User = get_user_model()

class RoomFeature(models.Model):
    """Features/amenities that rooms can have."""
    name = models.CharField(max_length=100)
    icon = models.CharField(
        max_length=50,
        blank=True,
        help_text="Icon name for UI (e.g., 'projector', 'wifi', 'coffee', 'capacity', 'whiteboard', 'phone', 'tv')"
    )

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Room Feature"
        verbose_name_plural = "Room Features"
        ordering = ["name"]

class Room(models.Model):
    """Room model."""
    name = models.CharField(
        max_length=100,
        validators=[
            RegexValidator(
                r'^[a-zA-Z0-9\s\-\.]+$',
                message='Room name can only contain letters, numbers, spaces, hyphens, and periods.'
            )
        ]
    )
    location = models.CharField(max_length=100, blank=True)
    capacity = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(50)])
    features = models.ManyToManyField(
        RoomFeature,
        blank=True,
        related_name="rooms",
        help_text="Amenities and equipment available in this room"
    )

    def __str__(self):
        return self.name

class Booking(models.Model):
    """Booking model with minimal backend validation."""
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='bookings')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(
        max_length=20,
        default='ongoing',
        choices=[
            ('ongoing', 'Ongoing'),
            ('completed', 'Completed'),
            ('cancelled', 'Cancelled')
        ],
        help_text='Current status of the booking'
    )
    date = models.DateField(db_index=True)

    MAX_DAYS_AHEAD = 90

    def clean(self):
        super().clean()
        now = timezone.now()

        if self.start_time < now:
            raise ValidationError({'start_time': "Start time cannot be in the past."})
        if self.end_time <= self.start_time:
            raise ValidationError({'end_time': "End time must be after start time."})
        if self.start_time > now + timedelta(days=self.MAX_DAYS_AHEAD):
            raise ValidationError({'start_time': f"Booking cannot be more than {self.MAX_DAYS_AHEAD} days in advance."})

        overlapping = Booking.objects.filter(room=self.room).filter(
            Q(start_time__lt=self.end_time) & Q(end_time__gt=self.start_time)
        )
        if self.pk:
            overlapping = overlapping.exclude(pk=self.pk)
        if overlapping.exists():
            raise ValidationError({'non_field_errors': "This room is already booked for the selected time range."})

    def save(self, *args, **kwargs):
        if self.start_time:
            self.date = self.start_time.date()
        super().save(*args, **kwargs)

    def __str__(self):
        start_str = self.start_time.strftime("%H:%M")
        end_str = self.end_time.strftime("%H:%M")
        return f"{self.room.name} — {start_str} to {end_str}"

