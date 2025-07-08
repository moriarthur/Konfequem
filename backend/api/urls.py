from rest_framework.routers import DefaultRouter
from django.urls import path, include
from rooms.views import RoomViewSet, BookingViewSet

router = DefaultRouter()
router.register(r'rooms', RoomViewSet)
router.register(r'bookings', BookingViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
