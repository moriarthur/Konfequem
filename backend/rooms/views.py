import uuid as uuid_mod

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenBlacklistView,
)

from .models import Room, Booking, RoomFeature
from .models_users import Organization, User
from .serializers import (
    RoomSerializer,
    BookingSerializer,
    RoomFeatureSerializer,
    RegisterSerializer,
    JoinSerializer,
    ProfileUpdateSerializer,
)


def _user_response_data(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "organization": (
            {
                "id": user.organization.id,
                "name": user.organization.name,
                "slug": user.organization.slug,
            }
            if user.organization
            else None
        ),
    }


def _check_booking_modifiable(booking, action="modify"):
    """Raise PermissionDenied if booking is in progress or already ended."""
    now = timezone.now()
    if now >= booking.end_time:
        raise PermissionDenied(f"Cannot {action} a booking that has already ended.")
    if now >= booking.start_time:
        raise PermissionDenied(
            f"Cannot {action} a booking that is currently in progress."
        )


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """Login endpoint with brute-force rate limiting (scope: login)."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class ThrottledTokenRefreshView(TokenRefreshView):
    """Token refresh endpoint with rate limiting (scope: token_refresh)."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "token_refresh"


class ThrottledTokenBlacklistView(TokenBlacklistView):
    """Token blacklist endpoint with rate limiting (scope: token_blacklist)."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "token_blacklist"


class RoomViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only view for rooms, scoped to the user's organization."""

    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Room.objects.all()
        return Room.objects.filter(organization=user.organization)


class RoomFeatureViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only view for room features."""

    queryset = RoomFeature.objects.all()
    serializer_class = RoomFeatureSerializer
    permission_classes = [AllowAny]


class BookingViewSet(viewsets.ModelViewSet):
    """CRUD view for bookings; user must be authenticated."""

    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Booking.objects.filter(
            user=user, organization=user.organization
        )

        room_id = self.request.query_params.get("room")
        date_str = self.request.query_params.get("date")
        month_str = self.request.query_params.get("month")

        if room_id:
            queryset = queryset.filter(room_id=room_id)

        if month_str:
            try:
                parts = month_str.split("-")
                if len(parts) != 2:
                    raise ValueError("Month parameter must be in YYYY-MM format")
                year, month = map(int, parts)
                if not (1 <= month <= 12) or year < 2020 or year > 2100:
                    raise ValueError("Invalid year or month values")
                queryset = queryset.filter(
                    start_time__year=year, start_time__month=month
                )
            except (ValueError, TypeError) as e:
                raise ValidationError(
                    f"Invalid month parameter '{month_str}': {str(e)}"
                )
        elif date_str:
            queryset = queryset.filter(start_time__date=date_str)

        return queryset.select_related("room")

    def perform_create(self, serializer):
        serializer.save(
            user=self.request.user,
            organization=self.request.user.organization,
        )

    def update(self, request, *args, **kwargs):
        _check_booking_modifiable(self.get_object(), "modify")
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        if serializer.instance.user != self.request.user:
            raise PermissionDenied("You can only modify your own bookings")
        _check_booking_modifiable(serializer.instance, "modify")
        return super().perform_update(serializer)

    def destroy(self, request, *args, **kwargs):
        _check_booking_modifiable(self.get_object(), "delete")
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        if instance.user != self.request.user:
            raise PermissionDenied("You can only delete your own bookings")
        _check_booking_modifiable(instance, "delete")
        return super().perform_destroy(instance)


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_user_response_data(request.user))

    def put(self, request):
        user = request.user
        serializer = ProfileUpdateSerializer(
            data=request.data, context={"user": user}
        )
        if not serializer.is_valid():
            # Flatten to this endpoint's {"error": "..."} contract — the
            # frontend reads `error` (or `message`) off the response body.
            first_error = next(iter(serializer.errors.values()))
            return Response({"error": str(first_error[0])}, status=400)

        data = serializer.validated_data
        user.first_name = data.get("first_name", user.first_name)
        user.last_name = data.get("last_name", user.last_name)
        user.email = data.get("email", user.email)
        user.save()
        return Response(_user_response_data(user))


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "change_password"

    def post(self, request):
        user = request.user
        old_password = request.data.get("old_password", "")
        new_password = request.data.get("new_password", "")
        confirm_password = request.data.get("confirm_password", "")

        if not old_password or not new_password or not confirm_password:
            return Response(
                {"error": "All fields are required."},
                status=400,
            )

        if not user.check_password(old_password):
            return Response(
                {"error": "Current password is incorrect."},
                status=400,
            )

        if new_password != confirm_password:
            return Response(
                {"error": "New passwords do not match."},
                status=400,
            )

        if old_password == new_password:
            return Response(
                {"error": "New password must be different from current password."},
                status=400,
            )

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as e:
            return Response(
                {"error": e.messages[0]},
                status=400,
            )

        user.set_password(new_password)
        user.save()
        return Response({"message": "Password changed successfully."})


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.save()
        return Response(data, status=201)


class InvitePreviewView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "invite_preview"

    def get(self, request, key):
        try:
            org = Organization.objects.get(invite_key=key)
        except Organization.DoesNotExist:
            return Response({"error": "Invite not found."}, status=404)
        return Response({"name": org.name, "slug": org.slug})


class JoinView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "join"

    def post(self, request):
        serializer = JoinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.save()
        return Response(data, status=201)


class OrgMembersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != "org_admin":
            return Response({"error": "Only org admins can view members."}, status=403)
        members = User.objects.filter(organization=user.organization).values(
            "id", "username", "email", "role", "first_name", "last_name"
        )
        return Response(list(members))


class RegenerateInviteView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "regenerate_invite"

    def post(self, request):
        user = request.user
        if user.role != "org_admin":
            return Response({"error": "Only org admins can regenerate invite keys."}, status=403)
        org = user.organization
        org.invite_key = uuid_mod.uuid4()
        org.save()
        return Response({"invite_key": str(org.invite_key)})
