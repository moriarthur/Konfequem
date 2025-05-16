from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RoomViewSet

router = DefaultRouter()
router.register(r'rooms', RoomViewSet)  # Register the RoomViewSet with the router at the 'rooms' endpoint

# The URL patterns for the API
# This will automatically create the necessary routes for the RoomViewSet
urlpatterns = [
    path('', include(router.urls)), # Include the router URLs
]
