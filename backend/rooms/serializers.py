from django.db.models import Q
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

    def validate(self, data):
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        room = data.get('room')

        if start_time < timezone.now():
            raise serializers.ValidationError("Start time cannot be in the past.")

        if end_time <= start_time:
            raise serializers.ValidationError("End time must be after start time.")

        # Check if booking overlaps with existing bookings for the same room
        overlapping = Booking.objects.filter(
            room=room
        ).filter(
            Q(start_time__lt=end_time) & Q(end_time__gt=start_time)
        )
        
        # When updating existing booking, exclude current instance
        if self.instance:
            overlapping = overlapping.exclude(pk=self.instance.pk)

        if overlapping.exists():
            raise serializers.ValidationError("This room is already booked for the selected time range.")

        return data

    def create(self, validated_data):
        user = self.context['request'].user
        booking = Booking(**validated_data, user=user)
        booking.clean()  # model validation (optional here, since we already validate)
        booking.save()
        return booking

class BookingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ['room', 'start_time', 'end_time']

    def validate(self, data):
        # your validation logic here (optional)
        return data

    def create(self, validated_data):
        user = self.context['request'].user
        booking = Booking(**validated_data, user=user)
        booking.clean()
        booking.save()
        return booking
