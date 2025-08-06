from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Room, Booking
from .serializers import (
    RoomSerializer,
    BookingSerializer,
    BookingCreateSerializer
)


class RoomViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]


class BookingViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only show bookings made by the current user
        return Booking.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return BookingCreateSerializer
        return BookingSerializer

    def perform_create(self, serializer):
        # Automatically attach the current user
        serializer.save(user=self.request.user)
