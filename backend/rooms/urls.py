from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RoomViewSet,
    BookingViewSet,
    CurrentUserView,
    RoomFeatureViewSet,
    ChangePasswordView,
    RegisterView,
    InvitePreviewView,
    JoinView,
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.views import TokenBlacklistView

router = DefaultRouter()
router.register(r"rooms", RoomViewSet)
router.register(r"room-features", RoomFeatureViewSet, basename="room-feature")
router.register(r"bookings", BookingViewSet, basename="booking")

urlpatterns = [
    path("", include(router.urls)),
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("token/blacklist/", TokenBlacklistView.as_view(), name="token_blacklist"),
    path("users/me/", CurrentUserView.as_view(), name="current_user"),
    path(
        "users/change-password/", ChangePasswordView.as_view(), name="change_password"
    ),
    path("register/", RegisterView.as_view(), name="register"),
    path("join/", JoinView.as_view(), name="join"),
    path("invites/<uuid:key>/", InvitePreviewView.as_view(), name="invite_preview"),
]
