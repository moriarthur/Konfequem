"""PostgreSQL-only overlap backstop for bookings.

The serializer's overlap check (rooms/serializers.py) is the friendly
first line of defense; this exclusion constraint closes the race window
between two concurrent requests that both pass validation. It is raw SQL
rather than a model constraint on purpose: the test suite runs on SQLite
(config.settings_test), where exclusion constraints are unsupported —
this migration is a no-op there.

btree_gist is required to put an equality column (room_id) next to the
range in a GiST exclusion constraint. On Supabase it installs into the
`extensions` schema, hence the explicit search_path before the DDL.
"""

from django.db import connection, migrations

ADD_CONSTRAINT = """
SELECT set_config('search_path', 'public, extensions', false);
ALTER TABLE rooms_booking
ADD CONSTRAINT booking_room_no_overlap
EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_time, end_time) WITH &&
);
"""

DROP_CONSTRAINT = "ALTER TABLE rooms_booking DROP CONSTRAINT IF EXISTS booking_room_no_overlap;"


def postgres_only(operations):
    if connection.vendor != "postgresql":
        return []
    return operations


class Migration(migrations.Migration):
    dependencies = [("rooms", "0001_initial")]

    operations = postgres_only(
        [
            migrations.RunSQL(
                "CREATE EXTENSION IF NOT EXISTS btree_gist;",
                reverse_sql=migrations.RunSQL.noop,
            ),
            migrations.RunSQL(ADD_CONSTRAINT, reverse_sql=DROP_CONSTRAINT),
        ]
    )
