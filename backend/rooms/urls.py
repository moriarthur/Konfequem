from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RoomViewSet, BookingViewSet, CurrentUserView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

router = DefaultRouter()
router.register(r'rooms', RoomViewSet)
router.register(r'bookings', BookingViewSet, basename='booking')

urlpatterns = [
    path('', include(router.urls)),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('users/me/', CurrentUserView.as_view(), name='current_user'),
]
