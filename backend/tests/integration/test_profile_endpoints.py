"""
Integration tests for profile endpoints.

PUT   /api/users/me/             — field validation (email format + uniqueness)
POST  /api/users/change-password/ — every error branch and the success path

These views predate their test coverage: the whole error surface of
ChangePasswordView and the PUT validation of CurrentUserView were exercised
only through the success path (or not at all).
"""

import pytest
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)

from rooms.models_users import User

ME_URL = "/api/users/me/"
CHANGE_PASSWORD_URL = "/api/users/change-password/"

NEW_PASSWORD = "NewStrongPass456!"


def _auth(api_client, user):
    refresh = RefreshToken.for_user(user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
    return api_client


@pytest.mark.integration
class TestUpdateCurrentUser:
    """PUT /api/users/me/ — validation branches."""

    def test_updates_names_and_email(self, api_client, user):
        response = _auth(api_client, user).put(
            ME_URL,
            {
                "first_name": "Renamed",
                "last_name": "Person",
                "email": "renamed@example.com",
            },
            format="json",
        )

        assert response.status_code == 200
        assert response.data["first_name"] == "Renamed"
        assert response.data["last_name"] == "Person"
        assert response.data["email"] == "renamed@example.com"

        user.refresh_from_db()
        assert user.first_name == "Renamed"
        assert user.email == "renamed@example.com"

    def test_rejects_malformed_email(self, api_client, user):
        response = _auth(api_client, user).put(
            ME_URL, {"email": "not-an-email"}, format="json"
        )

        assert response.status_code == 400
        assert "error" in response.data
        user.refresh_from_db()
        assert user.email == "testuser@example.com"

    def test_rejects_email_taken_by_other_user(self, api_client, user, organization):
        User.objects.create_user(
            username="otheruser",
            email="other@example.com",
            password="otherpass123",
            organization=organization,
        )

        response = _auth(api_client, user).put(
            ME_URL, {"email": "other@example.com"}, format="json"
        )

        assert response.status_code == 400
        assert "already exists" in response.data["error"]
        user.refresh_from_db()
        assert user.email == "testuser@example.com"

    def test_email_uniqueness_is_case_insensitive(self, api_client, user, organization):
        User.objects.create_user(
            username="otheruser",
            email="Other@Example.com",
            password="otherpass123",
            organization=organization,
        )

        response = _auth(api_client, user).put(
            ME_URL, {"email": "other@example.com"}, format="json"
        )

        assert response.status_code == 400
        assert "already exists" in response.data["error"]

    def test_allows_keeping_own_email(self, api_client, user):
        response = _auth(api_client, user).put(
            ME_URL, {"email": user.email}, format="json"
        )

        assert response.status_code == 200
        assert response.data["email"] == user.email

    def test_partial_update_keeps_other_fields(self, api_client, user):
        response = _auth(api_client, user).put(
            ME_URL, {"first_name": "OnlyName"}, format="json"
        )

        assert response.status_code == 200
        user.refresh_from_db()
        assert user.first_name == "OnlyName"
        assert user.last_name == "User"
        assert user.email == "testuser@example.com"

    def test_empty_body_changes_nothing(self, api_client, user):
        response = _auth(api_client, user).put(ME_URL, {}, format="json")

        assert response.status_code == 200
        user.refresh_from_db()
        assert user.first_name == "Test"
        assert user.last_name == "User"
        assert user.email == "testuser@example.com"


@pytest.mark.integration
class TestChangePassword:
    """POST /api/users/change-password/ — every documented error branch."""

    def test_changes_password(self, api_client, user):
        response = _auth(api_client, user).post(
            CHANGE_PASSWORD_URL,
            {
                "old_password": "testpass123",
                "new_password": NEW_PASSWORD,
                "confirm_password": NEW_PASSWORD,
            },
            format="json",
        )

        assert response.status_code == 200
        assert "success" in response.data["message"].lower()

        user.refresh_from_db()
        assert user.check_password(NEW_PASSWORD)

    def test_blacklists_all_outstanding_refresh_tokens(self, api_client, user):
        """A stolen refresh token must not survive a password change."""
        stolen = str(RefreshToken.for_user(user))
        RefreshToken.for_user(user)
        RefreshToken.for_user(user)

        response = _auth(api_client, user).post(
            CHANGE_PASSWORD_URL,
            {
                "old_password": "testpass123",
                "new_password": NEW_PASSWORD,
                "confirm_password": NEW_PASSWORD,
            },
            format="json",
        )

        assert response.status_code == 200
        # Every outstanding token is blacklisted, including the current
        # session's (RefreshToken.for_user records an OutstandingToken).
        outstanding = OutstandingToken.objects.filter(user=user).count()
        assert outstanding == 4
        assert BlacklistedToken.objects.filter(token__user=user).count() == outstanding

        refresh_response = api_client.post(
            "/api/token/refresh/", {"refresh": stolen}, format="json"
        )
        assert refresh_response.status_code == 401

    def test_blacklisting_is_idempotent(self, api_client, user):
        """Tokens already blacklisted don't blow up the password change."""
        pre_blacklisted = RefreshToken.for_user(user)
        pre_blacklisted.blacklist()

        response = _auth(api_client, user).post(
            CHANGE_PASSWORD_URL,
            {
                "old_password": "testpass123",
                "new_password": NEW_PASSWORD,
                "confirm_password": NEW_PASSWORD,
            },
            format="json",
        )

        assert response.status_code == 200
        assert BlacklistedToken.objects.filter(token__user=user).count() == (
            OutstandingToken.objects.filter(user=user).count()
        )

    def test_no_tokens_outstanding_still_succeeds(self, api_client, user):
        """Auth via a bare access token — no refresh outstanding at all."""
        access = AccessToken.for_user(user)
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        response = api_client.post(
            CHANGE_PASSWORD_URL,
            {
                "old_password": "testpass123",
                "new_password": NEW_PASSWORD,
                "confirm_password": NEW_PASSWORD,
            },
            format="json",
        )

        assert response.status_code == 200
        assert BlacklistedToken.objects.filter(token__user=user).count() == 0

    def test_requires_all_fields(self, api_client, user):
        response = _auth(api_client, user).post(
            CHANGE_PASSWORD_URL,
            {"old_password": "testpass123", "new_password": NEW_PASSWORD},
            format="json",
        )

        assert response.status_code == 400
        assert response.data["error"] == "All fields are required."
        user.refresh_from_db()
        assert user.check_password("testpass123")

    def test_rejects_wrong_old_password(self, api_client, user):
        response = _auth(api_client, user).post(
            CHANGE_PASSWORD_URL,
            {
                "old_password": "wrong-old-pass",
                "new_password": NEW_PASSWORD,
                "confirm_password": NEW_PASSWORD,
            },
            format="json",
        )

        assert response.status_code == 400
        assert response.data["error"] == "Current password is incorrect."
        user.refresh_from_db()
        assert user.check_password("testpass123")

    def test_rejects_mismatched_confirmation(self, api_client, user):
        response = _auth(api_client, user).post(
            CHANGE_PASSWORD_URL,
            {
                "old_password": "testpass123",
                "new_password": NEW_PASSWORD,
                "confirm_password": "different-pass-123",
            },
            format="json",
        )

        assert response.status_code == 400
        assert response.data["error"] == "New passwords do not match."
        user.refresh_from_db()
        assert user.check_password("testpass123")

    def test_rejects_new_password_same_as_old(self, api_client, user):
        response = _auth(api_client, user).post(
            CHANGE_PASSWORD_URL,
            {
                "old_password": "testpass123",
                "new_password": "testpass123",
                "confirm_password": "testpass123",
            },
            format="json",
        )

        assert response.status_code == 400
        assert "different" in response.data["error"]

    def test_rejects_weak_new_password(self, api_client, user):
        response = _auth(api_client, user).post(
            CHANGE_PASSWORD_URL,
            {
                "old_password": "testpass123",
                "new_password": "short",
                "confirm_password": "short",
            },
            format="json",
        )

        assert response.status_code == 400
        assert "error" in response.data
        user.refresh_from_db()
        assert user.check_password("testpass123")

    def test_requires_authentication(self, api_client, user):
        response = api_client.post(
            CHANGE_PASSWORD_URL,
            {
                "old_password": "testpass123",
                "new_password": NEW_PASSWORD,
                "confirm_password": NEW_PASSWORD,
            },
            format="json",
        )

        assert response.status_code == 401
