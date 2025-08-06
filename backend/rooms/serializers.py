from rest_framework import serializers
from .models import Room, Booking
from django.utils import timezone


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'name', 'capacity', 'location']


class BookingSerializer(serializers.ModelSerializer):
    room = RoomSerializer(read_only=True)
    user = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Booking
        fields = ['id', 'room', 'user', 'start_time', 'end_time', 'created_at']


class BookingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ['room', 'start_time', 'end_time']

    def validate(self, data):
        # Optional: prevent bookings in the past at serializer level
        if data['start_time'] < timezone.now():
            raise serializers.ValidationError("Start time cannot be in the past.")
        return data

    def create(self, validated_data):
        # Attach the current user to the booking
        user = self.context['request'].user
        booking = Booking(**validated_data, user=user)
        booking.clean()  # model-level validation
        booking.save()
        return booking
