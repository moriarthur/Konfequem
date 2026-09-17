from rest_framework import serializers
from django.utils import timezone
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Booking, Room, RoomFeature
from .models_users import Organization, User
from .validators import booking_time_errors, DEFAULT_MAX_DAYS_AHEAD


class RoomFeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoomFeature
        fields = ["id", "name", "icon"]


def _berlin_iso(dt):
    """ISO string in the project timezone (Europe/Berlin)."""
    return dt.astimezone(timezone.get_default_timezone()).isoformat()


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
        ret["start_time"] = _berlin_iso(instance.start_time)
        ret["end_time"] = _berlin_iso(instance.end_time)
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

        # --- Technical validation (shared with Booking.clean) ---
        if not start or not end or not room:
            errors.append("All fields are required.")
        else:
            errors.extend(
                message
                for _, message in booking_time_errors(
                    start,
                    end,
                    now=now,
                    max_days_ahead=getattr(
                        Booking, "MAX_DAYS_AHEAD", DEFAULT_MAX_DAYS_AHEAD
                    ),
                )
            )

        # --- Tenant isolation ---
        # A booking must target a room in the requester's organization —
        # on create and on update (PATCH/PUT can swap the room). Staff
        # writes never reach this point: StaffReadOnly denies them at the
        # viewset (staff manage bookings via Django admin).
        if room:
            request_user = self.context["request"].user
            if room.organization_id != request_user.organization_id:
                errors.append("You can only book rooms in your own organization.")

        # --- Logical validation ---
        if room and start and end:
            # Check for overlapping bookings. Two requests that pass this check
            # simultaneously are caught by the DB exclusion constraint
            # (rooms migration 0002) and surfaced as the same 400 by the
            # viewset's IntegrityError handling.
            if Booking.overlapping(
                room,
                start,
                end,
                exclude_pk=self.instance.pk if self.instance else None,
            ).exists():
                errors.append(
                    "This room is already booked for the selected time range."
                )

        # --- Company rules ---
        # Resource validation can be added here if needed in the future

        if errors:
            raise serializers.ValidationError({"general": errors})

        return data

    # User is assigned in the viewset's perform_create


class AvailabilitySerializer(serializers.ModelSerializer):
    """Org-wide busy slots: minimal fields, no personal data.

    Exposes id/room/room_name/times + computed status. Deliberately omits
    `user` — the calendar and conflict pre-checks only need occupancy.
    """

    room_name = serializers.CharField(source="room.name", read_only=True)
    status = serializers.CharField(source="current_status", read_only=True)

    class Meta:
        model = Booking
        fields = ["id", "room", "room_name", "start_time", "end_time", "status"]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret["start_time"] = _berlin_iso(instance.start_time)
        ret["end_time"] = _berlin_iso(instance.end_time)
        return ret


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

    def validate(self, data):
        instance = self.instance
        organization = (
            instance.organization
            if instance
            else self.context["request"].user.organization
        )
        name = (data.get("name") or (instance.name if instance else "")).strip()
        duplicates = Room.objects.filter(organization=organization, name__iexact=name)
        if instance:
            duplicates = duplicates.exclude(pk=instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError(
                {"name": ["A room with this name already exists in your organization."]}
            )
        return data


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
        try:
            # Atomic: a unique-constraint race (username / org slug taken
            # between validate_* and INSERT) must roll back the org too —
            # no orphan organizations — and surface as a friendly 400.
            with transaction.atomic():
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
        except IntegrityError:
            raise serializers.ValidationError(
                "A user with this username or an organization with this slug "
                "already exists."
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
        try:
            with transaction.atomic():
                user = User.objects.create_user(
                    username=validated_data["username"],
                    email=validated_data["email"],
                    password=validated_data["password"],
                    first_name=validated_data.get("first_name", ""),
                    last_name=validated_data.get("last_name", ""),
                    role="member",
                    organization=self._org,
                )
        except IntegrityError:
            raise serializers.ValidationError(
                "A user with this username already exists."
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
