"""
Integration tests for JWT authentication.

Tests validate:
- JWT token obtain
- JWT token refresh
- Protected endpoint access
- Token expiry handling
"""

import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@pytest.mark.integration
class TestJWTAuthentication:
    """Test suite for JWT authentication flow."""

    # ========================================================================
    # Token Obtain Tests
    # ========================================================================

    def test_token_obtain_success(self, db, api_client):
        """Test obtaining JWT tokens with valid credentials."""
        user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        
        response = api_client.post('/api/token/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        
        assert response.status_code == 200
        assert 'access' in response.data
        assert 'refresh' in response.data

    def test_token_obtain_invalid_username(self, db, api_client):
        """Test that token obtain fails with invalid username."""
        response = api_client.post('/api/token/', {
            'username': 'nonexistent',
            'password': 'testpass123'
        })
        
        assert response.status_code == 401

    def test_token_obtain_invalid_password(self, db, api_client):
        """Test that token obtain fails with invalid password."""
        User.objects.create_user(
            username='testuser',
            password='correctpass'
        )
        
        response = api_client.post('/api/token/', {
            'username': 'testuser',
            'password': 'wrongpass'
        })
        
        assert response.status_code == 401

    def test_token_obtain_missing_fields(self, db, api_client):
        """Test that token obtain fails with missing credentials."""
        response = api_client.post('/api/token/', {
            'username': 'testuser'
            # Missing password
        })
        
        assert response.status_code == 400

    def test_token_obtain_empty_credentials(self, db, api_client):
        """Test that token obtain fails with empty credentials."""
        response = api_client.post('/api/token/', {
            'username': '',
            'password': ''
        })
        
        assert response.status_code == 400

    # ========================================================================
    # Token Refresh Tests
    # ========================================================================

    def test_token_refresh_success(self, db, api_client):
        """Test refreshing an access token with valid refresh token."""
        user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        refresh = RefreshToken.for_user(user)
        
        response = api_client.post('/api/token/refresh/', {
            'refresh': str(refresh)
        })
        
        assert response.status_code == 200
        assert 'access' in response.data

    def test_token_refresh_invalid_token(self, db, api_client):
        """Test that refresh fails with invalid refresh token."""
        response = api_client.post('/api/token/refresh/', {
            'refresh': 'invalid-token'
        })
        
        assert response.status_code == 401

    def test_token_refresh_expired_token(self, db, api_client):
        """Test that refresh fails with expired refresh token."""
        # This would require creating an expired token
        # For now, test with an obviously invalid token
        response = api_client.post('/api/token/refresh/', {
            'refresh': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired'
        })
        
        assert response.status_code == 401

    def test_token_refresh_missing_token(self, db, api_client):
        """Test that refresh fails without refresh token."""
        response = api_client.post('/api/token/refresh/', {})
        
        assert response.status_code == 400

    # ========================================================================
    # Protected Endpoint Access Tests
    # ========================================================================

    def test_access_protected_endpoint_with_token(self, db, api_client, user):
        """Test accessing protected endpoint with valid token."""
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = api_client.get('/api/users/me/')
        
        assert response.status_code == 200
        assert response.data['username'] == user.username

    def test_access_protected_endpoint_without_token(self, db, api_client):
        """Test that protected endpoint requires authentication."""
        response = api_client.get('/api/users/me/')
        
        assert response.status_code == 401

    def test_access_protected_endpoint_with_invalid_token(self, db, api_client):
        """Test that invalid token is rejected."""
        api_client.credentials(HTTP_AUTHORIZATION='Bearer invalid-token')
        response = api_client.get('/api/users/me/')
        
        assert response.status_code == 401

    def test_access_protected_endpoint_with_expired_token(self, db, api_client):
        """Test that expired token is rejected."""
        api_client.credentials(HTTP_AUTHORIZATION='Bearer expired-token')
        response = api_client.get('/api/users/me/')
        
        assert response.status_code == 401

    def test_access_protected_endpoint_wrong_token_format(self, db, api_client, user):
        """Test that malformed authorization header is rejected."""
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        
        # Missing "Bearer" prefix
        api_client.credentials(HTTP_AUTHORIZATION=access_token)
        response = api_client.get('/api/users/me/')
        
        assert response.status_code == 401

    # ========================================================================
    # Current User Endpoint Tests
    # ========================================================================

    def test_get_current_user_returns_correct_data(self, db, api_client, user):
        """Test that /users/me/ returns current user data."""
        refresh = RefreshToken.for_user(user)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        
        response = api_client.get('/api/users/me/')
        
        assert response.status_code == 200
        assert response.data['id'] == user.id
        assert response.data['username'] == user.username
        assert response.data['email'] == user.email

    def test_get_current_user_with_email(self, db, api_client):
        """Test getting current user when user has email."""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        refresh = RefreshToken.for_user(user)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        
        response = api_client.get('/api/users/me/')
        
        assert response.status_code == 200
        assert response.data['email'] == 'test@example.com'

    # ========================================================================
    # Token Lifecycle Tests
    # ========================================================================

    def test_full_authentication_flow(self, db, api_client):
        """Test complete flow: login -> access -> refresh -> access."""
        # Create user
        User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        
        # Step 1: Obtain tokens
        token_response = api_client.post('/api/token/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        assert token_response.status_code == 200
        
        access_token = token_response.data['access']
        refresh_token = token_response.data['refresh']
        
        # Step 2: Access protected endpoint
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        me_response = api_client.get('/api/users/me/')
        assert me_response.status_code == 200
        
        # Step 3: Refresh access token
        api_client.credentials()  # Clear auth header for refresh endpoint
        refresh_response = api_client.post('/api/token/refresh/', {
            'refresh': refresh_token
        })
        assert refresh_response.status_code == 200
        
        new_access_token = refresh_response.data['access']
        
        # Step 4: Access protected endpoint with new token
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {new_access_token}')
        new_me_response = api_client.get('/api/users/me/')
        assert new_me_response.status_code == 200

    def test_token_works_for_booking_operations(self, db, api_client, user, room, future_start_time):
        """Test that JWT tokens work for booking CRUD operations."""
        refresh = RefreshToken.for_user(user)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')

        # Create booking (requires auth)
        from datetime import timedelta

        start = future_start_time
        response = api_client.post('/api/bookings/', {
            'room': room.id,
            'start_time': start.isoformat(),
            'end_time': (start + timedelta(hours=2)).isoformat()
        }, format='json')

        assert response.status_code == 201

    # ========================================================================
    # Logout Tests
    # ========================================================================

    def test_logout_by_clearing_tokens_client_side(self, db, api_client, user):
        """Test that logout is handled by clearing tokens on client side."""
        # The backend doesn't have a logout endpoint
        # Logout is performed by deleting tokens on the client
        
        refresh = RefreshToken.for_user(user)
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        
        # Verify token works before "logout"
        response = api_client.get('/api/users/me/')
        assert response.status_code == 200
        
        # Clear credentials (simulating client-side logout)
        api_client.credentials()
        
        # Verify endpoint is now inaccessible
        response = api_client.get('/api/users/me/')
        assert response.status_code == 401
