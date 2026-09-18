"""Seed a demo organization with sample data for portfolio reviewers.

Idempotent: a second run without flags is a no-op. ``--reset`` deletes the
demo org (cascading its rooms, bookings, and users) and recreates everything,
so a scheduled job can keep the public demo data clean without touching any
real organization. Room features are global — created if missing, never
deleted.

The demo password is read from DEMO_PASSWORD (or --password) so scheduled
resets keep the credentials published in the README valid.
"""

import datetime as dt
import secrets
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from rooms.models import Booking, Organization, Room, RoomFeature

User = get_user_model()

BERLIN = ZoneInfo("Europe/Berlin")
ORG_SLUG = "demo"
ORG_NAME = "Demo Workspaces"


class Command(BaseCommand):
    help = "Seed (or reset) the demo organization with sample rooms and bookings"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete the demo org (cascade) and recreate all demo data",
        )
        parser.add_argument(
            "--password",
            default=None,
            help="Password for demo accounts (default: DEMO_PASSWORD env, "
            "else a generated one printed once)",
        )

    def handle(self, *args, **options):
        reset = options["reset"]
        if Organization.objects.filter(slug=ORG_SLUG).exists():
            if not reset:
                self.stdout.write(
                    f"Org '{ORG_SLUG}' already seeded; use --reset to recreate."
                )
                return
            deleted, _ = Organization.objects.filter(slug=ORG_SLUG).delete()
            self.stdout.write(f"Reset: deleted demo org ({deleted} objects cascaded).")

        password = options["password"]
        if not password:
            from decouple import config

            password = config("DEMO_PASSWORD", default=None)
        generated = False
        if not password:
            password = secrets.token_urlsafe(12)
            generated = True

        org = Organization.objects.create(name=ORG_NAME, slug=ORG_SLUG)
        self._seed_features()
        self._seed_users(org, password)
        rooms = self._seed_rooms(org)
        self._seed_bookings(rooms)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded org '{ORG_NAME}' with {len(rooms)} rooms, "
                "users 'demo-reviewer' and 'demo-colleague'."
            )
        )
        if generated:
            self.stdout.write(f"Generated password (shown once): {password}")

    def _seed_features(self):
        for name, icon in [
            ("Projector", "projector"),
            ("Whiteboard", "whiteboard"),
            ("Wi-Fi", "wifi"),
            ("Coffee machine", "coffee"),
            ("TV screen", "tv"),
            ("Conference phone", "phone"),
        ]:
            RoomFeature.objects.get_or_create(name=name, defaults={"icon": icon})

    def _seed_users(self, org, password):
        for username, first, last, email in [
            ("demo-reviewer", "Demo", "Reviewer", "reviewer@example.com"),
            ("demo-colleague", "Demo", "Colleague", "colleague@example.com"),
        ]:
            User.objects.create_user(
                username=username,
                first_name=first,
                last_name=last,
                email=email,
                password=password,
                role="member",
                organization=org,
            )

    def _seed_rooms(self, org):
        feature = {f.name: f for f in RoomFeature.objects.all()}
        rooms = []
        for name, location, capacity, features in [
            ("Aurora", "Floor 2", 8, ["Projector", "Whiteboard"]),
            ("Borealis", "Floor 1", 4, ["Wi-Fi", "Coffee machine"]),
            ("Cascade", "Floor 3", 16, ["Projector", "TV screen", "Conference phone"]),
            ("Den", "Floor 1", 2, ["Coffee machine"]),
        ]:
            room = Room.objects.create(
                organization=org, name=name, location=location, capacity=capacity
            )
            room.features.set(feature[n] for n in features)
            rooms.append(room)
        return rooms

    def _seed_bookings(self, rooms):
        """Sample bookings around today, skipping weekends so the calendar
        always shows a realistic office week. Times are Berlin-local."""
        users = {
            u.username: u for u in User.objects.filter(username__startswith="demo")
        }
        aurora, borealis, cascade, den = rooms
        today = self._workday(0)
        plan = [
            (aurora, today, 9, 10.5, "demo-reviewer"),
            (borealis, today, 14, 15, "demo-colleague"),
            (cascade, self._workday(1), 10, 12, "demo-reviewer"),
            (aurora, self._workday(2), 16, 17.5, "demo-colleague"),
            (den, self._workday(-1), 9, 11, "demo-reviewer"),
        ]
        now = timezone.now()
        for room, day, start_h, end_h, username in plan:
            midnight = dt.datetime.combine(day, dt.time(0, 0), tzinfo=BERLIN)
            start = midnight + dt.timedelta(hours=start_h)
            end = start + dt.timedelta(hours=end_h - start_h)
            status = "completed" if end <= now else "ongoing"
            Booking.objects.create(
                organization=room.organization,
                room=room,
                user=users[username],
                start_time=start,
                end_time=end,
                date=start.date(),
                status=status,
            )
        # One cancelled booking so the profile history isn't uniformly green.
        cancelled_start = dt.datetime.combine(
            self._workday(-1), dt.time(13, 0), tzinfo=BERLIN
        )
        Booking.objects.create(
            organization=cascade.organization,
            room=cascade,
            user=users["demo-colleague"],
            start_time=cancelled_start,
            end_time=cancelled_start + dt.timedelta(hours=1),
            date=cancelled_start.date(),
            status="cancelled",
        )

    @staticmethod
    def _workday(offset):
        """Berlin-local date `offset` workdays from today (weekends skipped)."""
        day = dt.datetime.now(BERLIN).date()
        step = 1 if offset >= 0 else -1
        for _ in range(abs(offset)):
            day += dt.timedelta(days=step)
            while day.weekday() >= 5:
                day += dt.timedelta(days=step)
        return day
