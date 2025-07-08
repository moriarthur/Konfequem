from rest_framework import serializers
from .models import Room
from .models import Booking

class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'name', 'capacity', 'location']  # list the fields for the API

class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ['id', 'room', 'user', 'start_time', 'end_time']