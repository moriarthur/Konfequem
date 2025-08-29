from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator, ValidationError
from django.utils import timezone
from datetime import timedelta, time
from django.db.models import Q

User = get_user_model()


class Room(models.Model):
    """Room model."""
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=100, blank=True)
    capacity = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(50)]
    )

    def __str__(self):
        return self.name


class Booking(models.Model):
    """Booking model with validations."""
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='bookings')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    # Work hours constants
    WORK_START = time(8, 0)
    WORK_END = time(18, 0)
    MAX_DAYS_AHEAD = 14

    def clean(self):
        """Validate booking rules."""
        super().clean()
        now = timezone.now()

        # Cannot book in the past
        if self.start_time < now:
            raise ValidationError({'start_time': "Start time cannot be in the past."})

        # End must be after start
        if self.end_time <= self.start_time:
            raise ValidationError({'end_time': "End time must be after start time."})

        # Booking must be within working hours
        if self.start_time.time() < self.WORK_START or self.end_time.time() > self.WORK_END:
            raise ValidationError({
                'start_time': f"Booking must be within working hours {self.WORK_START}-{self.WORK_END}."
            })

        # Cannot book more than MAX_DAYS_AHEAD days ahead
        if self.start_time > now + timedelta(days=self.MAX_DAYS_AHEAD):
            raise ValidationError({
                'start_time': f"Booking cannot be more than {self.MAX_DAYS_AHEAD} days in advance."
            })

        # Check overlapping bookings
        overlapping = Booking.objects.filter(room=self.room).filter(
            Q(start_time__lt=self.end_time) & Q(end_time__gt=self.start_time)
        )
        if self.pk:
            overlapping = overlapping.exclude(pk=self.pk)
        if overlapping.exists():
            raise ValidationError("This room is already booked for the selected time range.")

    def __str__(self):
        return f"{self.room.name} — {self.start_time} to {self.end_time}"
