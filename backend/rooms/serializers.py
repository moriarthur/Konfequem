from rest_framework import serializers
from .models import Room, Booking


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = '__all__'


class BookingSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source="room.name", read_only=True)

    class Meta:
        model = Booking
        fields = ['id', 'room', 'room_name', 'start_time', 'end_time', 'user']
        read_only_fields = ['user']
