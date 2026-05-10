from rest_framework import viewsets
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
        """Override to check booking status before validation runs."""
        # Get the booking instance first
        instance = self.get_object()
        now = timezone.now()

        # Check if booking is in progress or ended before allowing update
        if now >= instance.end_time:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Cannot modify a booking that has already ended.")
        if now >= instance.start_time:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "Cannot modify a booking that is currently in progress."
            )

        # Proceed with normal update flow
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        # Ensure user can only modify their own bookings
        if serializer.instance.user != self.request.user:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You can only modify your own bookings")

        # Prevent modification of bookings in progress or already ended
        now = timezone.now()
        booking = serializer.instance

        if now >= booking.end_time:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Cannot modify a booking that has already ended.")
        if now >= booking.start_time:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "Cannot modify a booking that is currently in progress."
            )

        return super().perform_update(serializer)

    def destroy(self, request, *args, **kwargs):
        """Override to check booking status before deletion."""
        # Get the booking instance first
        instance = self.get_object()
        now = timezone.now()

        # Check if booking is in progress or ended before allowing deletion
        if now >= instance.end_time:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Cannot delete a booking that has already ended.")
        if now >= instance.start_time:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "Cannot delete a booking that is currently in progress."
            )

        # Proceed with normal delete flow
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        # Ensure user can only delete their own bookings
        if instance.user != self.request.user:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You can only delete your own bookings")

        # Prevent deletion of bookings that are currently in progress or already ended
        now = timezone.now()

        if now >= instance.end_time:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Cannot delete a booking that has already ended.")
        if now >= instance.start_time:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "Cannot delete a booking that is currently in progress."
            )

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
