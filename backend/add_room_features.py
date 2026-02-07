"""
Add room features to the database and assign them to rooms.
"""
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from rooms.models import Room, RoomFeature

# Define features with icons that match the frontend's FEATURE_ICONS
FEATURES_DATA = [
    ("Projector", "projector"),
    ("WiFi", "wifi"),
    ("Coffee Machine", "coffee"),
    ("Whiteboard", "whiteboard"),
    ("TV", "tv"),
    ("Video Conference", "videoconf"),
]

# Assign features to rooms (room name -> list of feature indices)
ROOM_FEATURES = {
    "Besprechungsraum A": [0, 1, 3],      # Projector, WiFi, Whiteboard
    "Besprechungsraum B": [0, 1, 2, 3],   # Projector, WiFi, Coffee Machine, Whiteboard
    "Kleinraum C": [1],                    # WiFi
    "Kleinraum D": [1, 3],                 # WiFi, Whiteboard
    "Vorstandszimmer": [0, 1, 2, 4, 5],   # Projector, WiFi, Coffee Machine, TV, Video Conference
    "Projektbüro 1": [0, 1, 3],           # Projector, WiFi, Whiteboard
    "Projektbüro 2": [0, 1, 3, 5],        # Projector, WiFi, Whiteboard, Video Conference
    "Schulungsraum": [0, 1, 2, 3, 4],     # Projector, WiFi, Coffee Machine, Whiteboard, TV
    "Workshopraum": [1, 2, 3],            # WiFi, Coffee Machine, Whiteboard
}


def main():
    print("Creating/Updating room features...")

    # Create or update features
    features = []
    for name, icon in FEATURES_DATA:
        feature, created = RoomFeature.objects.get_or_create(
            icon=icon,
            defaults={"name": name}
        )
        # Update name if feature already existed with different name
        if not created:
            feature.name = name
            feature.save()

        features.append(feature)
        print(f"  {'Created' if created else 'Updated'}: {name} ({icon})")

    print(f"\nTotal features: {len(features)}")

    # Assign features to rooms
    print("\nAssigning features to rooms...")
    rooms = Room.objects.all()
    room_lookup = {room.name: room for room in rooms}

    for room_name, feature_indices in ROOM_FEATURES.items():
        if room_name not in room_lookup:
            print(f"  WARNING: Room '{room_name}' not found")
            continue

        room = room_lookup[room_name]
        feature_objects = [features[i] for i in feature_indices]

        # Clear existing features and set new ones
        room.features.set(feature_objects)

        feature_names = [f.name for f in feature_objects]
        print(f"  {room_name}: {', '.join(feature_names)}")

    print("\nDone!")


if __name__ == "__main__":
    main()
