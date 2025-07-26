from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RoomViewSet, BookingViewSet

router = DefaultRouter()
router.register(r'rooms', RoomViewSet)  # Register the RoomViewSet with the router at the 'rooms' endpoint

router = DefaultRouter()
router.register(r'bookings', BookingViewSet, basename='booking')

# The URL patterns for the API
# This will automatically create the necessary routes for the RoomViewSet
urlpatterns = [
    path('', include(router.urls)), # Include the router URLs
]
