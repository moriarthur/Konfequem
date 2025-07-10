from rest_framework import serializers
from .models import Room, Booking

class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'name', 'capacity', 'location']

class BookingSerializer(serializers.ModelSerializer):
    # Отображаем поле user только для чтения
    user = serializers.ReadOnlyField(source='user.id')

    class Meta:
        model = Booking
        fields = ['id', 'room', 'user', 'start_time', 'end_time']
