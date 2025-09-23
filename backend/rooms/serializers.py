from rest_framework import serializers
from .models import Room, Booking
from django.utils import timezone

class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = "__all__"
        
class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = "__all__"
        read_only_fields = ["user"]
        #room_name = serializers.CharField(source="room.name", reed_only=True)

    def validate(self, data):
        start = data.get("start")
        end = data.get("end")

        if start and start < timezone.now():
            raise serializers.ValidationError(
                {"non_field_errors": ["Start time cannot be in the past."]}
            )

        if start and end and end <= start:
            raise serializers.ValidationError(
                {"non_field_errors": ["End time must be after start time."]}
            )

        if start and end:
            overlapping = Booking.objects.filter(
                room=data["room"],
                start__lt=end,
                end__gt=start,
            )
            if self.instance:
                overlapping = overlapping.exclude(pk=self.instance.pk)
            if overlapping.exists():
                raise serializers.ValidationError(
                    {"non_field_errors": ["This booking overlaps with an existing one."]}
                )

        return data
