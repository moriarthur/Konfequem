from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from .models import Booking, Room, RoomFeature
from django.db.models import Q

class RoomFeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoomFeature
        fields = ['id', 'name', 'icon']

class BookingSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source="room.name", read_only=True)
    
    class Meta:
        model = Booking
        fields = ['id', 'room', 'room_name', 'start_time', 'end_time', 'user']
        read_only_fields = ['user']
        
    def to_representation(self, instance):
        """Convert times to Berlin timezone for consistent display"""
        ret = super().to_representation(instance)
        berlin_tz = timezone.get_default_timezone()
        ret['start_time'] = instance.start_time.astimezone(berlin_tz).isoformat()
        ret['end_time'] = instance.end_time.astimezone(berlin_tz).isoformat()
        return ret
    
    def validate(self, data):
        errors = []
        # For partial updates, use instance values for missing fields
        if self.partial and self.instance:
            start = data.get('start_time', self.instance.start_time)
            end = data.get('end_time', self.instance.end_time)
            room = data.get('room', self.instance.room)
        else:
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

            # Get Berlin timezone
            berlin_tz = timezone.get_default_timezone()

            # Ensure times are in Berlin timezone for validation
            start_local = start.astimezone(berlin_tz)
            end_local = end.astimezone(berlin_tz)

            # Office hours: 08:00 – 22:00 (Berlin time)
            if start_local.hour < 8 or start_local.hour >= 22 or end_local.hour > 22 or end_local.hour < 8:
                errors.append("Bookings must be within office hours (08:00–22:00).")

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
        # Resource validation can be added here if needed in the future

        if errors:
            raise serializers.ValidationError({"general": errors})

        return data

    # User is assigned in the viewset's perform_create

class RoomSerializer(serializers.ModelSerializer):
    features = RoomFeatureSerializer(many=True, read_only=True)

    class Meta:
        model = Room
        fields = ['id', 'name', 'location', 'capacity', 'features']
