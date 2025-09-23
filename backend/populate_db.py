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

# --- Superuser placeholder ---
superuser, created = User.objects.get_or_create(
    username="unlxud",  
    defaults={
        "is_staff": True,
        "is_superuser": True,
    }
)
if created:
    superuser.set_password("lnp909") 
    superuser.save()

# --- Rooms ---
rooms_data = [
    ("Konferenzraum A", "Erdgeschoss", 12),
    ("Konferenzraum B", "1. Stock", 20),
    ("Besprechungsraum C", "2. Stock", 6),
    ("Besprechungsraum D", "1. Stock", 8),
    ("Meetingraum E", "Erdgeschoss", 10),
    ("Meetingraum F", "2. Stock", 15),
    ("Raum G", "1. Stock", 18),
    ("Raum H", "2. Stock", 10),
]

rooms = []
for name, location, capacity in rooms_data:
    room, created = Room.objects.get_or_create(
        name=name,
        defaults={"location": location, "capacity": capacity}
    )
    rooms.append(room)

# --- Regular Users (German names) ---
users_data = [
    ("h.schmidt", "Hans", "Schmidt", "h.schmidt@example.com", "123456"),
    ("l.mueller", "Laura", "Müller", "l.mueller@example.com", "123456"),
    ("f.schneider", "Friedrich", "Schneider", "f.schneider@example.com", "123456"),
    ("s.fischer", "Sophie", "Fischer", "s.fischer@example.com", "123456"),
    ("t.weber", "Thomas", "Weber", "t.weber@example.com", "123456"),
    ("a.braun", "Anna", "Braun", "a.braun@example.com", "123456"),
]

users = []
for username, first_name, last_name, email, password in users_data:
    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
        }
    )
    if created:
        user.set_password(password)
        user.save()
    users.append(user)

# --- Bookings ---
booking_count = 20  # total random bookings

for _ in range(booking_count):
    user = random.choice(users)
    room = random.choice(rooms)
    
    # Random date within next 14 days (max allowed by Booking.clean)
    booking_date = datetime.today().date() + timedelta(days=random.randint(1, 14))
    
    # Random start time
    start_hour = random.choice([8, 9, 10, 11, 13, 14, 15])
    start_minute = random.choice([0, 30])
    start_time = datetime.combine(booking_date, datetime.min.time()) + timedelta(hours=start_hour, minutes=start_minute)
    
    duration_hours = random.choice([1, 1.5, 2])
    end_time = start_time + timedelta(hours=duration_hours)
    
    try:
        Booking.objects.create(
            user=user,
            room=room,
            start_time=start_time,
            end_time=end_time
        )
    except Exception as e:
        print(f"Skipping booking due to error: {e}")

print("✅ Superuser, rooms, users, and bookings created successfully.")
print("Users login info:")
for u in users:
    print(f"Username: {u.username}, Password: 123456")
