from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone

from .models import Room, Booking, RoomFeature
from .serializers import (
    RoomSerializer,
    BookingSerializer,
    RoomFeatureSerializer,
)


def _check_booking_modifiable(booking, action="modify"):
    """Raise PermissionDenied if booking is in progress or already ended."""
    now = timezone.now()
    if now >= booking.end_time:
        raise PermissionDenied(f"Cannot {action} a booking that has already ended.")
    if now >= booking.start_time:
        raise PermissionDenied(
            f"Cannot {action} a booking that is currently in progress."
        )


class RoomViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only view for rooms."""

    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [AllowAny]


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
        queryset = Booking.objects.filter(user=user)

        room_id = self.request.query_params.get("room")
        date_str = self.request.query_params.get("date")
        month_str = self.request.query_params.get("month")  # YYYY-MM format

        if room_id:
            queryset = queryset.filter(room_id=room_id)

        if month_str:
            # Parse YYYY-MM format
            try:
                parts = month_str.split("-")
                if len(parts) != 2:
                    raise ValueError("Month parameter must be in YYYY-MM format")
                year, month = map(int, parts)
                if not (1 <= month <= 12) or year < 2020 or year > 2100:
                    raise ValueError("Invalid year or month values")
                # Get all bookings for the month
                queryset = queryset.filter(
                    start_time__year=year, start_time__month=month
                )
            except (ValueError, TypeError) as e:
                # Return proper error response instead of silent failure
                from rest_framework.exceptions import ValidationError

                raise ValidationError(
                    f"Invalid month parameter '{month_str}': {str(e)}"
                )
        elif date_str:
            queryset = queryset.filter(start_time__date=date_str)

        return queryset.select_related("room")

    def perform_create(self, serializer):
        # Attach current user to booking
        serializer.save(user=self.request.user)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        _check_booking_modifiable(instance, "modify")
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        if serializer.instance.user != self.request.user:
            raise PermissionDenied("You can only modify your own bookings")
        _check_booking_modifiable(serializer.instance, "modify")
        return super().perform_update(serializer)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        _check_booking_modifiable(instance, "delete")
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        if instance.user != self.request.user:
            raise PermissionDenied("You can only delete your own bookings")
        _check_booking_modifiable(instance, "delete")
        return super().perform_destroy(instance)


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
            }
        )

    def put(self, request):
        user = request.user
        first_name = request.data.get("first_name", user.first_name)
        last_name = request.data.get("last_name", user.last_name)
        email = request.data.get("email", user.email)

        if email and "@" not in email:
            return Response({"error": "Enter a valid email."}, status=400)

        user.first_name = first_name
        user.last_name = last_name
        user.email = email
        user.save()
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
            }
        )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

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

        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError

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
