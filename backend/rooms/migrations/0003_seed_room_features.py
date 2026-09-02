"""Seed the standard room feature list.

The prod DB was recreated on 2026-08-27 and room features were never
re-seeded (local dev got them manually), so the room form's feature
picker rendered empty. Icons match FEATURE_ICONS in
frontend/src/components/RoomFeatureBadges.tsx. get_or_create by name
keeps this idempotent on every backend.
"""

from django.db import migrations

FEATURES = [
    ("Projector", "projector"),
    ("Wi-Fi", "wifi"),
    ("Coffee Point", "coffee"),
    ("Whiteboard", "whiteboard"),
    ("TV Screen", "tv"),
    ("Video Conference", "videoconf"),
]


def seed(apps, schema_editor):
    RoomFeature = apps.get_model("rooms", "RoomFeature")
    for name, icon in FEATURES:
        RoomFeature.objects.get_or_create(name=name, defaults={"icon": icon})


def unseed(apps, schema_editor):
    RoomFeature = apps.get_model("rooms", "RoomFeature")
    RoomFeature.objects.filter(name__in=[name for name, _ in FEATURES]).delete()


class Migration(migrations.Migration):
    dependencies = [("rooms", "0002_booking_room_no_overlap")]

    operations = [migrations.RunPython(seed, unseed)]
