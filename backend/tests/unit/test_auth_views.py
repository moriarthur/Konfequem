import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rooms.models_users import Organization

User = get_user_model()


# ============================================================================
# Registration
# ============================================================================


@pytest.mark.django_db
class TestRegister:
    def _payload(self, **overrides):
        base = {
            "username": "alice",
            "email": "alice@example.com",
            "password": "Str0ng!Pass123",
            "org_name": "Acme Corp",
            "org_slug": "acme-corp",
        }
        base.update(overrides)
        return base

    def test_register_success(self):
        client = APIClient()
        resp = client.post("/api/register/", self._payload(), format="json")
        assert resp.status_code == 201
        data = resp.json()

        assert data["user"]["username"] == "alice"
        assert data["user"]["role"] == "org_admin"
        assert data["organization"]["slug"] == "acme-corp"
        assert "access" in data["tokens"]
        assert "refresh" in data["tokens"]

        user = User.objects.get(username="alice")
        assert user.organization.slug == "acme-corp"
        assert user.role == "org_admin"

    def test_register_with_names(self):
        client = APIClient()
        resp = client.post(
            "/api/register/",
            self._payload(first_name="Alice", last_name="Smith"),
            format="json",
        )
        assert resp.status_code == 201
        assert resp.json()["user"]["first_name"] == "Alice"

    def test_register_duplicate_username(self, user):
        client = APIClient()
        resp = client.post(
            "/api/register/",
            self._payload(username="testuser"),
            format="json",
        )
        assert resp.status_code == 400
        assert "username" in resp.json()

    def test_register_duplicate_slug(self, organization):
        client = APIClient()
        resp = client.post(
            "/api/register/",
            self._payload(org_slug="test-org"),
            format="json",
        )
        assert resp.status_code == 400
        assert "org_slug" in resp.json()

    def test_register_weak_password(self):
        client = APIClient()
        resp = client.post(
            "/api/register/",
            self._payload(password="123"),
            format="json",
        )
        assert resp.status_code == 400
        assert "password" in resp.json()

    def test_register_missing_fields(self):
        client = APIClient()
        resp = client.post("/api/register/", {}, format="json")
        assert resp.status_code == 400


# ============================================================================
# Invite Preview
# ============================================================================


@pytest.mark.django_db
class TestInvitePreview:
    def test_preview_found(self, organization):
        client = APIClient()
        resp = client.get(f"/api/invites/{organization.invite_key}/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == organization.name
        assert data["slug"] == organization.slug

    def test_preview_not_found(self):
        client = APIClient()
        resp = client.get("/api/invites/00000000-0000-0000-0000-000000000000/")
        assert resp.status_code == 404


# ============================================================================
# Join
# ============================================================================


@pytest.mark.django_db
class TestJoin:
    def _payload(self, organization, **overrides):
        base = {
            "invite_key": str(organization.invite_key),
            "username": "bob",
            "email": "bob@example.com",
            "password": "Str0ng!Pass123",
        }
        base.update(overrides)
        return base

    def test_join_success(self, organization):
        client = APIClient()
        resp = client.post("/api/join/", self._payload(organization), format="json")
        assert resp.status_code == 201
        data = resp.json()

        assert data["user"]["username"] == "bob"
        assert data["user"]["role"] == "member"
        assert data["organization"]["slug"] == "test-org"
        assert "access" in data["tokens"]

        user = User.objects.get(username="bob")
        assert user.organization == organization
        assert user.role == "member"

    def test_join_invalid_key(self):
        client = APIClient()
        resp = client.post(
            "/api/join/",
            {
                "invite_key": "00000000-0000-0000-0000-000000000000",
                "username": "bob",
                "email": "bob@example.com",
                "password": "Str0ng!Pass123",
            },
            format="json",
        )
        assert resp.status_code == 400
        assert "invite_key" in resp.json()

    def test_join_duplicate_username(self, organization, user):
        client = APIClient()
        resp = client.post(
            "/api/join/",
            self._payload(organization, username="testuser"),
            format="json",
        )
        assert resp.status_code == 400
        assert "username" in resp.json()

    def test_join_weak_password(self, organization):
        client = APIClient()
        resp = client.post(
            "/api/join/",
            self._payload(organization, password="123"),
            format="json",
        )
        assert resp.status_code == 400
        assert "password" in resp.json()

    def test_join_missing_fields(self, organization):
        client = APIClient()
        resp = client.post("/api/join/", {}, format="json")
        assert resp.status_code == 400
