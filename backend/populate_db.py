import os
import django
import random
from datetime import datetime, timedelta

# --- Django setup ---
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from rooms.models import Room, Booking

User = get_user_model()

# --- Users ---
users_data = [
    ("j.smith", "John", "Smith"),
    ("a.johnson", "Alice", "Johnson"),
    ("m.brown", "Michael", "Brown"),
    ("l.davis", "Laura", "Davis"),
    ("d.wilson", "David", "Wilson"),
    ("s.miller", "Sarah", "Miller"),
]

users = []
for username, first_name, last_name in users_data:
    user, created = User.objects.get_or_create(username=username, defaults={
        "first_name": first_name,
        "last_name": last_name,
        "email": f"{username}@example.com",
    })
    if created:
        user.set_password("123456")
        user.save()
    users.append(user)

# --- Bookings ---
rooms = list(Room.objects.all())
booking_count = 15

for _ in range(booking_count):
    user = random.choice(users)
    room = random.choice(rooms)
    
    # Рандомная дата в пределах 30 дней
    booking_date = datetime.today().date() + timedelta(days=random.randint(1, 30))
    
    # Рандомное время
    start_hour = random.choice([8, 9, 10, 11, 13, 14, 15])
    start_minute = random.choice([0, 30])
    start_time = datetime.combine(booking_date, datetime.min.time()) + timedelta(hours=start_hour, minutes=start_minute)
    
    duration_hours = random.choice([1, 1.5, 2])
    end_time = start_time + timedelta(hours=duration_hours)
    
    Booking.objects.get_or_create(
        user=user,
        room=room,
        date=booking_date,
        start_time=start_time,
        end_time=end_time
    )

print("✅ Users and random bookings created successfully.")
