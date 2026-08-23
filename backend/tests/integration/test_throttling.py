"""
Integration tests for scoped rate limiting.

Regression background: global anon/user throttles (30/min, 60/min) used to
apply to every endpoint. The frontend fires 2-3 parallel requests per page
mount, so a user clicking through tabs exhausted the budget and every data
request returned 429 (pages rendered empty lists). Throttling must now be
scoped to auth/session-sensitive endpoints only.
"""

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from rooms.models_users import User

LOGIN_URL = "/api/token/"
REFRESH_URL = "/api/token/refresh/"
REGISTER_URL = "/api/register/"
ROOMS_URL = "/api/rooms/"
CHANGE_PASSWORD_URL = "/api/users/change-password/"
REGENERATE_INVITE_URL = "/api/org/invite/regenerate/"
BLACKLIST_URL = "/api/token/blacklist/"


@pytest.mark.integration
class TestScopedThrottling:
    """Scoped throttle behavior: sensitive endpoints limited, data endpoints not."""

    def test_login_throttles_after_rate(
        self, db, api_client, enable_scoped_throttling
    ):
        """Login allows 3 attempts/min, then returns 429 with Retry-After."""
        payload = {"username": "nouser", "password": "wrongpass"}

        for _ in range(3):
            response = api_client.post(LOGIN_URL, payload)
            assert response.status_code == 401

        response = api_client.post(LOGIN_URL, payload)
        assert response.status_code == 429
        assert "throttled" in str(response.data["detail"]).lower()
        assert int(response["Retry-After"]) >= 1

    def test_rooms_burst_stays_unthrottled(
        self, authenticated_api_client, room, enable_scoped_throttling
    ):
        """Rapid navigation (burst of data requests) must not be throttled."""
        for _ in range(40):
            response = authenticated_api_client.get(ROOMS_URL)
            assert response.status_code == 200

    def test_token_refresh_throttles_after_rotation(
        self, user, api_client, enable_scoped_throttling
    ):
        """Refresh allows 2 requests/min; each response rotates the token."""
        refresh_token = str(RefreshToken.for_user(user))

        for _ in range(2):
            response = api_client.post(
                REFRESH_URL, {"refresh": refresh_token}, format="json"
            )
            assert response.status_code == 200
            # ROTATE_REFRESH_TOKENS + blacklist: use the fresh token next
            refresh_token = response.data["refresh"]

        response = api_client.post(
            REFRESH_URL, {"refresh": refresh_token}, format="json"
        )
        assert response.status_code == 429

    def test_register_scope_throttles(self, api_client, enable_scoped_throttling):
        """Register allows 2 requests/min regardless of validation outcome."""
        payload = {"username": "u", "password": "short"}

        for _ in range(2):
            response = api_client.post(REGISTER_URL, payload, format="json")
            assert response.status_code == 400

        response = api_client.post(REGISTER_URL, payload, format="json")
        assert response.status_code == 429

    def test_change_password_scope_throttles(
        self, authenticated_api_client, enable_scoped_throttling
    ):
        """Change-password allows 2 requests/min per user."""
        payload = {
            "old_password": "wrong",
            "new_password": "newpass123",
            "confirm_password": "newpass123",
        }

        for _ in range(2):
            response = authenticated_api_client.post(
                CHANGE_PASSWORD_URL, payload, format="json"
            )
            assert response.status_code == 400

        response = authenticated_api_client.post(
            CHANGE_PASSWORD_URL, payload, format="json"
        )
        assert response.status_code == 429

    def test_regenerate_invite_scope_throttles(
        self, db, organization, enable_scoped_throttling
    ):
        """Invite-key rotation allows 2 requests/min per org admin."""
        admin = User.objects.create_user(
            username="orgadmin",
            password="testpass123",
            role="org_admin",
            organization=organization,
        )
        client = APIClient()
        refresh = RefreshToken.for_user(admin)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        for _ in range(2):
            response = client.post(REGENERATE_INVITE_URL)
            assert response.status_code == 200

        response = client.post(REGENERATE_INVITE_URL)
        assert response.status_code == 429
