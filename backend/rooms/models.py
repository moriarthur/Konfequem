from django.db import models
from django.contrib.auth import get_user_model

class Room(models.Model):
    name = models.CharField(max_length=100)  # Name of the room
    location = models.CharField(max_length=100, blank=True)  # Location of the room
    capacity = models.PositiveIntegerField()  # Capacity (how many people can fit)

    def __str__(self):
        return self.name  # When we see the object, its name is displayed

User = get_user_model()

class Booking(models.Model):
    room = models.ForeignKey('Room', on_delete=models.CASCADE, related_name='bookings')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.room.name} — {self.start_time} to {self.end_time}"

    class Meta:
        ordering = ['start_time']
        unique_together = ['room', 'start_time', 'end_time']
