from rest_framework import viewsets
from .models import Room, Booking
from .serializers import RoomSerializer, BookingSerializer
from rest_framework.permissions import AllowAny  # временно

class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer

class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer
    permission_classes = [AllowAny]  # пока любой может бронировать

    def perform_create(self, serializer):
        # Привязываем бронь к текущему пользователю запроса
        serializer.save(user=self.request.user)
