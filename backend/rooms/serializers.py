from django.core.exceptions import ValidationError
from rest_framework import serializers
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
        """Run model validation and convert to DRF errors."""
        booking = Booking(**data, user=self.context['request'].user)
        try:
            booking.clean()
        except ValidationError as e:
            if hasattr(e, 'message_dict'):
                # Use non_field_errors for general errors
                errors = {}
                for k, v in e.message_dict.items():
                    if k in ['start_time', 'end_time']:
                        errors[k] = v
                    else:
                        errors['non_field_errors'] = v
                raise serializers.ValidationError(errors)
            else:
                raise serializers.ValidationError({'non_field_errors': e.messages})
        return data

    def create(self, validated_data):
        """Create booking with user and automatic date."""
        user = self.context['request'].user
        booking = Booking(**validated_data, user=user)
        booking.save()  # date will be auto-set in save()
        return booking
