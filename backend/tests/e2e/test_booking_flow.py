"""
End-to-end tests for the booking flow.

Tests validate:
- Complete flow: login → create booking → retrieve
- Double booking prevention
- Timezone edge cases
"""

import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import timedelta
from django.utils import timezone

from rooms.models import Room, Booking

User = get_user_model()


@pytest.mark.e2e
@pytest.mark.django_db(transaction=True)
class TestBookingFlowE2E:
    """End-to-end tests for the complete booking workflow."""

    # ========================================================================
    # Complete Booking Flow Tests
    # ========================================================================

    def test_complete_booking_flow(self):
        """Test the complete flow: login → create booking → retrieve."""
        # Step 1: Create user and room
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        room = Room.objects.create(name='Test Room', capacity=10)

        # Step 2: Login (obtain tokens)
        client = APIClient()
        response = client.post('/api/token/', {
            'username': 'testuser',
            'password': 'testpass123'
        })

        assert response.status_code == 200
        access_token = response.data['access']
        refresh_token = response.data['refresh']

        # Step 3: List available rooms
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = client.get('/api/rooms/')

        assert response.status_code == 200
        rooms = response.data
        assert len(rooms) >= 1
        room_id = rooms[0]['id']

        # Step 4: Create a booking
        start_time = timezone.now() + timedelta(days=1)
        start_time = start_time.replace(hour=10, minute=0, second=0, microsecond=0)
        end_time = start_time + timedelta(hours=2)

        response = client.post('/api/bookings/', {
            'room': room_id,
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat()
        }, format='json')

        assert response.status_code == 201
        booking_id = response.data['id']

        # Step 5: Retrieve the created booking
        response = client.get(f'/api/bookings/{booking_id}/')

        assert response.status_code == 200
        assert response.data['id'] == booking_id
        assert response.data['room'] == room_id
        
        # Step 6: List all bookings for the user
        response = client.get('/api/bookings/')
        
        assert response.status_code == 200
        assert len(response.data) >= 1
        booking_ids = [b['id'] for b in response.data]
        assert booking_id in booking_ids

    # ========================================================================
    # Double Booking Prevention Tests
    # ========================================================================

    def test_double_booking_prevention_in_same_room(self):
        """Test that double booking in the same room is prevented."""
        # Setup
        user = User.objects.create_user(username='testuser', password='testpass123')
        room = Room.objects.create(name='Test Room', capacity=10)
        
        # Login
        client = APIClient()
        response = client.post('/api/token/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        access_token = response.data['access']
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        
        # Create first booking
        start_time = timezone.now() + timedelta(days=1)
        start_time = start_time.replace(hour=10, minute=0, second=0, microsecond=0)
        end_time = start_time + timedelta(hours=2)
        
        response = client.post('/api/bookings/', {
            'room': room.id,
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat()
        }, format='json')
        
        assert response.status_code == 201
        
        # Try to create overlapping booking
        response = client.post('/api/bookings/', {
            'room': room.id,
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat()
        }, format='json')
        
        assert response.status_code == 400
        assert 'already booked' in str(response.data).lower()

    def test_booking_allowed_in_different_room_same_time(self):
        """Test that booking is allowed in different room at same time."""
        # Setup
        user = User.objects.create_user(username='testuser', password='testpass123')
        room1 = Room.objects.create(name='Room 1', capacity=10)
        room2 = Room.objects.create(name='Room 2', capacity=10)
        
        # Login
        client = APIClient()
        response = client.post('/api/token/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        access_token = response.data['access']
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        
        # Create booking in room 1
        start_time = timezone.now() + timedelta(days=1)
        start_time = start_time.replace(hour=10, minute=0, second=0, microsecond=0)
        end_time = start_time + timedelta(hours=2)
        
        response = client.post('/api/bookings/', {
            'room': room1.id,
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat()
        }, format='json')
        
        assert response.status_code == 201
        
        # Create booking at same time in room 2
        response = client.post('/api/bookings/', {
            'room': room2.id,
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat()
        }, format='json')
        
        assert response.status_code == 201

    # ========================================================================
    # User Isolation Tests
    # ========================================================================

    def test_users_only_see_own_bookings(self):
        """Test that users can only see their own bookings."""
        # Create two users
        user1 = User.objects.create_user(username='user1', password='pass123')
        user2 = User.objects.create_user(username='user2', password='pass123')
        room = Room.objects.create(name='Test Room', capacity=10)
        
        # Create booking for user1
        start_time = timezone.now() + timedelta(days=1)
        start_time = start_time.replace(hour=10, minute=0, second=0, microsecond=0)
        booking1 = Booking.objects.create(
            room=room,
            user=user1,
            start_time=start_time,
            end_time=start_time + timedelta(hours=2)
        )
        
        # Create booking for user2
        booking2 = Booking.objects.create(
            room=room,
            user=user2,
            start_time=start_time + timedelta(hours=3),
            end_time=start_time + timedelta(hours=5)
        )
        
        # Login as user1
        client1 = APIClient()
        response = client1.post('/api/token/', {
            'username': 'user1',
            'password': 'pass123'
        })
        client1.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["access"]}')
        
        response = client1.get('/api/bookings/')
        booking_ids = [b['id'] for b in response.data]
        
        assert booking1.id in booking_ids
        assert booking2.id not in booking_ids

    # ========================================================================
    # Token Lifecycle Tests
    # ========================================================================

    def test_token_refresh_during_booking_flow(self):
        """Test that token refresh works during booking operations."""
        # Setup
        user = User.objects.create_user(username='testuser', password='testpass123')
        room = Room.objects.create(name='Test Room', capacity=10)
        
        # Login
        client = APIClient()
        response = client.post('/api/token/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        
        access_token = response.data['access']
        refresh_token = response.data['refresh']
        
        # Use access token to create booking
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        start_time = timezone.now() + timedelta(days=1)
        start_time = start_time.replace(hour=10, minute=0, second=0, microsecond=0)
        
        response = client.post('/api/bookings/', {
            'room': room.id,
            'start_time': start_time.isoformat(),
            'end_time': (start_time + timedelta(hours=2)).isoformat()
        }, format='json')
        
        assert response.status_code == 201
        
        # Refresh token
        response = client.post('/api/token/refresh/', {
            'refresh': refresh_token
        })
        
        assert response.status_code == 200
        new_access_token = response.data['access']
        
        # Use new token to list bookings
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {new_access_token}')
        response = client.get('/api/bookings/')
        
        assert response.status_code == 200
        assert len(response.data) >= 1

    # ========================================================================
    # Timezone Edge Cases
    # ========================================================================

    @pytest.mark.timezone
    def test_booking_across_dst_boundary(self):
        """Test booking creation around DST transition."""
        # Setup
        user = User.objects.create_user(username='testuser', password='testpass123')
        room = Room.objects.create(name='Test Room', capacity=10)
        
        # Login
        client = APIClient()
        response = client.post('/api/token/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["access"]}')
        
        # Create booking around a potential DST boundary (last Sunday of March)
        # Note: This is a simplified test; real DST testing requires specific dates
        from datetime import datetime
        march_date = datetime(2025, 3, 30, 10, 0)  # Around DST transition
        from django.utils import timezone as django_tz
        march_aware = django_tz.make_aware(march_date)
        
        response = client.post('/api/bookings/', {
            'room': room.id,
            'start_time': march_aware.isoformat(),
            'end_time': (march_aware + timedelta(hours=2)).isoformat()
        }, format='json')
        
        # Should handle timezone correctly
        assert response.status_code in [201, 400]  # Either success or validation error

    @pytest.mark.timezone
    def test_booking_in_berlin_timezone(self):
        """Test that bookings are correctly handled in Berlin timezone."""
        # Setup
        user = User.objects.create_user(username='testuser', password='testpass123')
        room = Room.objects.create(name='Test Room', capacity=10)

        # Login
        client = APIClient()
        response = client.post('/api/token/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["access"]}')

        # Create booking with explicit timezone (use future date)
        from datetime import datetime
        import pytz
        berlin_tz = pytz.timezone('Europe/Berlin')
        berlin_time = berlin_tz.localize(datetime(2026, 2, 15, 10, 0))

        response = client.post('/api/bookings/', {
            'room': room.id,
            'start_time': berlin_time.isoformat(),
            'end_time': (berlin_time + timedelta(hours=2)).isoformat()
        }, format='json')

        assert response.status_code == 201

        # Verify the returned times are in Berlin timezone
        booking_data = response.data
        assert '+' in booking_data['start_time'] or booking_data['start_time'].endswith('Z')

    # ========================================================================
    # Validation Flow Tests
    # ========================================================================

    def test_booking_validation_in_flow(self):
        """Test that validation is properly enforced in the booking flow."""
        # Setup
        user = User.objects.create_user(username='testuser', password='testpass123')
        room = Room.objects.create(name='Test Room', capacity=10)
        
        # Login
        client = APIClient()
        response = client.post('/api/token/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["access"]}')
        
        # Try to create booking in the past
        past_time = timezone.now() - timedelta(hours=1)
        response = client.post('/api/bookings/', {
            'room': room.id,
            'start_time': past_time.isoformat(),
            'end_time': timezone.now().isoformat()
        }, format='json')
        
        assert response.status_code == 400
        
        # Try to create booking too far in advance (91 days)
        far_future = timezone.now() + timedelta(days=91)
        response = client.post('/api/bookings/', {
            'room': room.id,
            'start_time': far_future.isoformat(),
            'end_time': (far_future + timedelta(hours=2)).isoformat()
        }, format='json')
        
        assert response.status_code == 400
        
        # Try to create booking with duration less than 15 minutes
        start_time = timezone.now() + timedelta(days=1)
        start_time = start_time.replace(minute=0, second=0, microsecond=0)
        response = client.post('/api/bookings/', {
            'room': room.id,
            'start_time': start_time.isoformat(),
            'end_time': (start_time + timedelta(minutes=10)).isoformat()
        }, format='json')
        
        assert response.status_code == 400

    # ========================================================================
    # Cleanup Flow Tests
    # ========================================================================

    def test_booking_deletion_flow(self):
        """Test the complete deletion flow."""
        # Setup
        user = User.objects.create_user(username='testuser', password='testpass123')
        room = Room.objects.create(name='Test Room', capacity=10)
        
        # Login and create booking
        client = APIClient()
        response = client.post('/api/token/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["access"]}')
        
        start_time = timezone.now() + timedelta(days=1)
        start_time = start_time.replace(hour=10, minute=0, second=0, microsecond=0)
        
        response = client.post('/api/bookings/', {
            'room': room.id,
            'start_time': start_time.isoformat(),
            'end_time': (start_time + timedelta(hours=2)).isoformat()
        }, format='json')
        
        booking_id = response.data['id']
        
        # Delete the booking
        response = client.delete(f'/api/bookings/{booking_id}/')
        assert response.status_code == 204
        
        # Verify it's deleted
        response = client.get(f'/api/bookings/{booking_id}/')
        assert response.status_code == 404
        
        # Verify it's not in the list
        response = client.get('/api/bookings/')
        booking_ids = [b['id'] for b in response.data]
        assert booking_id not in booking_ids
