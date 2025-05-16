from django.db import models

class Room(models.Model):
    name = models.CharField(max_length=100)  # Name of the room
    location = models.CharField(max_length=100, blank=True)  # Location of the room
    capacity = models.PositiveIntegerField()  # Capacity (how many people can fit)

    def __str__(self):
        return self.name  # When we see the object, its name is displayed
