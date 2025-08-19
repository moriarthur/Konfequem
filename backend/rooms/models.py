from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator, ValidationError
from django.utils import timezone
from datetime import date, timedelta
from django.utils.translation import gettext_lazy as _
from django.db.models import Q

User = get_user_model()  

# --- Room ---
class Room(models.Model):
    name = models.CharField(max_length=100)                         # Name of the room
    location = models.CharField(max_length=100, blank=True)         # Location of the room
    capacity = models.PositiveIntegerField(                         # Capacity (how many people can fit)
        validators=[MinValueValidator(1), MaxValueValidator(50)] 
    )  

    def __str__(self):  
        return self.name

# --- Booking ---
class Booking(models.Model):
    room = models.ForeignKey('Room', on_delete=models.CASCADE, related_name='bookings')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings')
    date = models.DateField(default=date.today)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        super().clean()
        if not self.start_time or not self.end_time:
            return

        now = timezone.now()

        if self.start_time < now:
            raise ValidationError({'start_time': _("Das Startdatum der Buchung darf nicht in der Vergangenheit liegen.")})

        if self.end_time <= self.start_time:
            raise ValidationError({'end_time': _("Das Enddatum muss nach dem Startdatum liegen.")})

        max_end = now + timedelta(days=14)
        if self.end_time > max_end:
            raise ValidationError({'end_time': _("Das Enddatum darf nicht später als in 14 Tagen liegen.")})  

        overlapping = Booking.objects.filter(
            room=self.room
        ).filter(
            Q(start_time__lt=self.end_time) & Q(end_time__gt=self.start_time)
        )

        if self.pk:
            overlapping = overlapping.exclude(pk=self.pk)

        if overlapping.exists():
            raise ValidationError(_("Diese Zeit ist für diesen Raum bereits gebucht."))

    def __str__(self):
        return f"{self.room.name} — {self.start_time} to {self.end_time}"

    class Meta:
        ordering = ['start_time']
        unique_together = ['room', 'start_time', 'end_time']
