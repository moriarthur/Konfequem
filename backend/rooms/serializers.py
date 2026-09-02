from rest_framework import serializers
from django.utils import timezone
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import timedelta
from .models import Booking, Room, RoomFeature
from .models_users import Organization, User
from django.db.models import Q


class RoomFeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoomFeature
        fields = ["id", "name", "icon"]


class BookingSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source="room.name", read_only=True)
    user = serializers.PrimaryKeyRelatedField(read_only=True)
    status = serializers.CharField(read_only=True)

    class Meta:
        model = Booking
        fields = ["id", "room", "room_name", "start_time", "end_time", "user", "status"]

    def to_representation(self, instance):
        """Convert times to Berlin timezone for consistent display"""
        ret = super().to_representation(instance)
        berlin_tz = timezone.get_default_timezone()
        ret["start_time"] = instance.start_time.astimezone(berlin_tz).isoformat()
        ret["end_time"] = instance.end_time.astimezone(berlin_tz).isoformat()
        ret["status"] = instance.current_status
        return ret

    def validate(self, data):
        errors = []
        # For partial updates, use instance values for missing fields
        if self.partial and self.instance:
            start = data.get("start_time", self.instance.start_time)
            end = data.get("end_time", self.instance.end_time)
            room = data.get("room", self.instance.room)
        else:
            start = data.get("start_time")
            end = data.get("end_time")
            room = data.get("room")

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
            # Bookings can start from 08:00 until 21:45 (to end by 22:00)
            if start_local.hour < 8 or start_local.hour >= 22:
                errors.append("Bookings must start between 08:00 and 21:45.")
            if end_local.hour > 22 or (end_local.hour == 22 and end_local.minute > 0):
                errors.append("Bookings must end by 22:00.")

            # Duration limits: 15 min – 8 hours
            duration = (end - start).total_seconds() / 60
            if duration < 15:
                errors.append("Booking must be at least 15 minutes.")
            if duration > 8 * 60:
                errors.append("Booking cannot exceed 8 hours.")

            # Max advance booking
            max_days = getattr(Booking, "MAX_DAYS_AHEAD", 90)
            if start > now + timedelta(days=max_days):
                errors.append(
                    f"Booking cannot be more than {max_days} days in advance."
                )

        # --- Logical validation ---
        if room and start and end:
            # Check for overlapping bookings
            # Note: There is a theoretical race condition where two users could
            # validate simultaneously and both see no overlaps, then both create.
            # This is rare in practice. A proper fix would require database
            # constraints or different locking strategy.
            overlapping = Booking.objects.filter(room=room).filter(
                Q(start_time__lt=end) & Q(end_time__gt=start)
            )
            if self.instance:
                overlapping = overlapping.exclude(pk=self.instance.pk)
            if overlapping.exists():
                errors.append(
                    "This room is already booked for the selected time range."
                )

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
        fields = ["id", "name", "location", "capacity", "features"]


class RoomWriteSerializer(serializers.ModelSerializer):
    """Create/update serializer — features referenced by primary key.

    Write responses return feature PKs (not nested objects); the client
    re-fetches the room list after mutations.
    """

    features = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=RoomFeature.objects.all(),
        required=False,
    )

    class Meta:
        model = Room
        fields = ["id", "name", "location", "capacity", "features"]


# ---------------------------------------------------------------------------
# Auth serializers
# ---------------------------------------------------------------------------


def _user_response(user, organization):
    refresh = RefreshToken.for_user(user)
    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "organization": organization.id,
        },
        "organization": {
            "id": organization.id,
            "name": organization.name,
            "slug": organization.slug,
            "invite_key": str(organization.invite_key),
        },
        "tokens": {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        },
    }


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=False, default="")
    last_name = serializers.CharField(required=False, default="")
    org_name = serializers.CharField()
    org_slug = serializers.SlugField()

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.messages)
        return value

    def validate_org_slug(self, value):
        if Organization.objects.filter(slug=value).exists():
            raise serializers.ValidationError(
                "This organization slug is already taken."
            )
        return value

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError(
                "A user with this username already exists."
            )
        return value

    def create(self, validated_data):
        org = Organization.objects.create(
            name=validated_data["org_name"],
            slug=validated_data["org_slug"],
        )
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            role="org_admin",
            organization=org,
        )
        return _user_response(user, org)


class JoinSerializer(serializers.Serializer):
    invite_key = serializers.UUIDField()
    username = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=False, default="")
    last_name = serializers.CharField(required=False, default="")

    def validate_invite_key(self, value):
        try:
            self._org = Organization.objects.get(invite_key=value)
        except Organization.DoesNotExist:
            raise serializers.ValidationError("Invalid or expired invite key.")
        return value

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.messages)
        return value

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError(
                "A user with this username already exists."
            )
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            role="member",
            organization=self._org,
        )
        return _user_response(user, self._org)


class ProfileUpdateSerializer(serializers.Serializer):
    """Validation for PUT /api/users/me/.

    AbstractUser.email has no unique constraint at the database level, so
    uniqueness is enforced here (case-insensitive, excluding the user's own
    row) instead of trusting a bare "@" check.
    """

    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    email = serializers.EmailField(required=False)

    def validate_email(self, value):
        user = self.context["user"]
        if User.objects.exclude(pk=user.pk).filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value
