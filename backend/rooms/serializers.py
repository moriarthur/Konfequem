from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from .models import Booking, Room
from django.db.models import Q

class BookingSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source="room.name", read_only=True)
    
    class Meta:
        model = Booking
        fields = ['id', 'room', 'room_name', 'start_time', 'end_time', 'user']
        read_only_fields = ['user']

    def validate(self, data):
        errors = []
        start = data.get('start_time')
        end = data.get('end_time')
        room = data.get('room')
        user = self.context['request'].user

        now = timezone.now()

        # --- Technical validation ---
        if not start or not end or not room:
            errors.append("All fields are required.")
        else:
            # Check proper datetime
            if start >= end:
                errors.append("End time must be after start time.")
            if start < now:
                errors.append("Start time cannot be in the past.")

            # Office hours: 08:00 – 20:00
            if start.hour < 8 or start.hour >= 20 or end.hour > 20 or end.hour <= 8:
                errors.append("Bookings must be within office hours (08:00–20:00).")

            # Duration limits: 15 min – 8 hours
            duration = (end - start).total_seconds() / 60
            if duration < 15:
                errors.append("Booking must be at least 15 minutes.")
            if duration > 8*60:
                errors.append("Booking cannot exceed 8 hours.")

            # Max advance booking
            max_days = getattr(Booking, 'MAX_DAYS_AHEAD', 90)
            if start > now + timedelta(days=max_days):
                errors.append(f"Booking cannot be more than {max_days} days in advance.")

        # --- Logical validation ---
        if room and start and end:
            overlapping = Booking.objects.filter(room=room).filter(
                Q(start_time__lt=end) & Q(end_time__gt=start)
            )
            if self.instance:
                overlapping = overlapping.exclude(pk=self.instance.pk)
            if overlapping.exists() and not user.is_staff:
                errors.append("This room is already booked for the selected time range.")

        # --- Company rules ---
        user_bookings_week = Booking.objects.filter(
            user=user,
            start_time__gte=now,
            start_time__lt=now + timedelta(days=7)
        )
        if user_bookings_week.count() >= 5 and not user.is_staff:
            errors.append("You cannot book more than 5 times in a single week.")

        # --- Resource validation ---
        if room and data.get('attendees'):
            if data['attendees'] > room.capacity:
                errors.append(f"Room capacity exceeded: {room.capacity} people max.")

        if errors:
            raise serializers.ValidationError({"general": errors})

        return data

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ['id', 'name', 'location', 'capacity']
