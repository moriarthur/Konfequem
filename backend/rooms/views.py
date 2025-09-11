from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Room, Booking
from .serializers import RoomSerializer, BookingSerializer


class RoomViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only view for rooms."""
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [AllowAny]


class BookingViewSet(viewsets.ModelViewSet):
    """CRUD view for bookings; user must be authenticated."""
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Show only bookings for current user
        return Booking.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # Attach current user to booking
        serializer.save(user=self.request.user)


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user(request):
    user = request.user
    return Response({
        "id": user.id,
        "username": user.username,
        "email": user.email
    })
