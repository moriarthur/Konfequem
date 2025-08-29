from django.core.exceptions import ValidationError
from django.db.models import Q
from rest_framework import serializers
from django.utils import timezone
from .models import Room, Booking


class RoomSerializer(serializers.ModelSerializer):
    """Serializer for Room."""
    class Meta:
        model = Room
        fields = ['id', 'name', 'capacity', 'location']


class BookingSerializer(serializers.ModelSerializer):
    """Serializer for reading bookings."""
    room = RoomSerializer(read_only=True)
    user = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Booking
        fields = ['id', 'room', 'user', 'start_time', 'end_time', 'created_at']


class BookingCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating bookings with full validation."""

    class Meta:
        model = Booking
        fields = ['room', 'start_time', 'end_time']

    def validate(self, data):
        """Validate booking constraints."""
        booking = Booking(**data, user=self.context['request'].user)
        try:
            booking.clean()
        except ValidationError as e:
            # Convert Django ValidationError to DRF-friendly format
            if hasattr(e, 'message_dict'):
                raise serializers.ValidationError(e.message_dict)
            else:
                raise serializers.ValidationError({'non_field_errors': e.messages})
        return data

    def create(self, validated_data):
        """Create booking and associate with user."""
        user = self.context['request'].user
        booking = Booking(**validated_data, user=user)
        booking.clean()  # run model validations again to be safe
        booking.save()
        return booking
