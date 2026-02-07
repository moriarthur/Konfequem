"""
Generate a large number of realistic bookings to simulate real application operation.
Creates past, current, and future bookings with realistic distribution patterns.
"""
import os
import django
import random
from datetime import datetime, timedelta, time
from collections import defaultdict

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from rooms.models import Room, Booking, RoomFeature

User = get_user_model()

# Configuration
BOOKINGS_PER_USER = 50  # Average bookings per user
PAST_DAYS = 60  # How many days back to generate bookings
FUTURE_DAYS = 90  # How many days forward (max allowed by model)
BUSINESS_HOURS_START = 7  # 7:00 AM
BUSINESS_HOURS_END = 19  # 7:00 PM

# Time slots (30-minute intervals)
TIME_SLOTS = []
for hour in range(BUSINESS_HOURS_START, BUSINESS_HOURS_END):
    TIME_SLOTS.append(time(hour, 0))   # :00
    TIME_SLOTS.append(time(hour, 30))  # :30

# Durations (in minutes)
DURATIONS = [30, 60, 90, 120, 150, 180]


def get_all_users():
    """Get all users from database."""
    return list(User.objects.all())


def get_all_rooms():
    """Get all rooms from database."""
    return list(Room.objects.all())


def get_weighted_random_date(target_datetime):
    """
    Generate a date with weighted distribution:
    - Higher probability for weekdays
    - Gaussian distribution around target_date
    """
    days_offset = int(random.gauss(0, 15))  # 15 day standard deviation
    random_datetime = target_datetime + timedelta(days=days_offset)
    random_date = random_datetime.date()

    # Bias towards weekdays (retry if weekend)
    if random_date.weekday() >= 5:  # Saturday or Sunday
        if random.random() < 0.7:  # 70% chance to pick a weekday instead
            # Move to nearest weekday
            if random_date.weekday() == 5:  # Saturday
                random_date -= timedelta(days=1)
            else:  # Sunday
                random_date += timedelta(days=1)

    return random_date


def get_time_slot_for_date(booking_date, now):
    """
    Get a realistic time slot based on the date.
    - Past dates: any time
    - Today: only future times
    - Future dates: any time
    """
    max_attempts = 50

    for _ in range(max_attempts):
        slot = random.choice(TIME_SLOTS)
        duration = random.choice(DURATIONS)

        start_datetime = datetime.combine(booking_date, slot)
        end_datetime = start_datetime + timedelta(minutes=duration)

        # Ensure end time is within business hours
        if end_datetime.time() > time(BUSINESS_HOURS_END, 0):
            continue

        # If today, ensure start time is in the future
        # Make naive datetime timezone-aware for comparison
        now_date = now.date()
        if booking_date == now_date:
            start_aware = timezone.make_aware(start_datetime)
            if start_aware <= now:
                continue

        return start_datetime, end_datetime

    return None, None


def create_bookings_for_user(user, rooms, now, existing_bookings_by_room):
    """
    Create realistic bookings for a single user.
    Returns the number of bookings created.
    """
    created_count = 0
    target_count = max(20, int(random.gauss(BOOKINGS_PER_USER, 15)))

    # Mix of past, current (near future), and future bookings
    # Weight towards near future (next 30 days)
    for _ in range(target_count):
        # Determine time period: 20% past, 30% near future, 50% future
        period = random.choices(
            ['past', 'near_future', 'future'],
            weights=[0.2, 0.3, 0.5]
        )[0]

        if period == 'past':
            # Random date in the past
            days_back = random.randint(1, PAST_DAYS)
            target_date = now - timedelta(days=days_back)
        elif period == 'near_future':
            # Next 30 days
            target_date = now + timedelta(days=random.randint(0, 30))
        else:  # future
            # 30-90 days ahead
            target_date = now + timedelta(days=random.randint(30, FUTURE_DAYS))

        booking_date = get_weighted_random_date(target_date)

        # Skip if date is too far in the past (would violate model validation)
        if booking_date < (now.date() - timedelta(days=1)):
            continue

        # Skip if date is too far in the future (would violate MAX_DAYS_AHEAD)
        if booking_date > (now.date() + timedelta(days=Booking.MAX_DAYS_AHEAD)):
            continue

        # Get time slot
        start_time, end_time = get_time_slot_for_date(booking_date, now)
        if not start_time:
            continue

        # Select room (prefer rooms that match user's "preferences" - random but consistent)
        room = random.choice(rooms)

        # Check for overlapping bookings
        # Use a simple check: convert to timezone-aware for comparison
        start_aware = timezone.make_aware(start_time)
        end_aware = timezone.make_aware(end_time)

        overlaps = False
        for existing in existing_bookings_by_room[room.id]:
            if existing.start_time < end_aware and existing.end_time > start_aware:
                overlaps = True
                break

        if overlaps:
            continue

        # Create booking
        try:
            booking = Booking.objects.create(
                user=user,
                room=room,
                start_time=start_aware,
                end_time=end_aware
            )
            existing_bookings_by_room[room.id].add(booking)
            created_count += 1
        except Exception:
            # Skip if validation fails
            pass

    return created_count


def main():
    """Main function to generate bookings."""
    print("Starting booking generation...")
    print(f"Target: ~{BOOKINGS_PER_USER} bookings per user")
    print(f"Time range: {PAST_DAYS} days past to {FUTURE_DAYS} days future")
    print()

    now = timezone.now()

    # Get all users and rooms
    users = get_all_users()
    rooms = get_all_rooms()

    if not users:
        print("No users found! Please create users first.")
        return

    if not rooms:
        print("No rooms found! Please create rooms first.")
        return

    print(f"Found {len(users)} users and {len(rooms)} rooms")
    print()

    # Track existing bookings per room for collision detection
    existing_bookings_by_room = defaultdict(set)
    for booking in Booking.objects.select_related('room').all():
        existing_bookings_by_room[booking.room.id].add(booking)

    initial_count = Booking.objects.count()
    print(f"Existing bookings: {initial_count}")
    print()

    # Create bookings for each user
    total_created = 0
    for i, user in enumerate(users, 1):
        count = create_bookings_for_user(user, rooms, now, existing_bookings_by_room)
        total_created += count
        print(f"[{i}/{len(users)}] {user.username}: {count} bookings created")

    final_count = Booking.objects.count()
    print()
    print("=" * 50)
    print(f"Total bookings created: {total_created}")
    print(f"Total bookings in database: {final_count}")
    print("=" * 50)

    # Show distribution
    print()
    print("Booking distribution by user:")
    for user in users:
        count = user.bookings.count()
        print(f"  {user.username}: {count}")

    print()
    print("Booking distribution by room:")
    for room in rooms:
        count = room.bookings.count()
        print(f"  {room.name}: {count}")


if __name__ == "__main__":
    main()
