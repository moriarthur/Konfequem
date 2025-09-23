from rest_framework import serializers
from .models import Room, Booking

class BookingSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source="room.name", read_only=True)
    start_time = serializers.SerializerMethodField()
    end_time = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = ['id', 'room', 'room_name', 'start_time', 'end_time', 'user']
        read_only_fields = ['user']

    def get_start_time(self, obj):
        return obj.start_time.strftime("%Y-%m-%dT%H:%M:%S")  # keep full datetime for JS parsing

    def get_end_time(self, obj):
        return obj.end_time.strftime("%Y-%m-%dT%H:%M:%S")  # keep full datetime for JS parsing


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'name', 'location', 'capacity']
