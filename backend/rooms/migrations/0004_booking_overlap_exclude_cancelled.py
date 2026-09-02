"""Recreate the overlap exclusion constraint with a cancelled exclusion.

Since bookings can now be soft-cancelled (BookingViewSet.cancel), a
cancelled row must no longer block its slot — neither for the serializer
check (which now excludes cancelled) nor at the DB level. Partial
exclusion constraint: same columns, plus WHERE (status <> 'cancelled').

Raw SQL with a vendor guard for the same reason as migration 0002: the
test suite runs on SQLite, where exclusion constraints are unsupported.
0002 (unconditional constraint) is applied first on fresh databases and
immediately replaced here — never edit an applied migration.
"""

from django.db import connection, migrations

DROP_CONSTRAINT = "ALTER TABLE rooms_booking DROP CONSTRAINT IF EXISTS booking_room_no_overlap;"

ADD_CONSTRAINT = """
SELECT set_config('search_path', 'public, extensions', false);
ALTER TABLE rooms_booking
ADD CONSTRAINT booking_room_no_overlap
EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_time, end_time) WITH &&
)
WHERE (status <> 'cancelled');
"""


def postgres_only(operations):
    if connection.vendor != "postgresql":
        return []
    return operations


class Migration(migrations.Migration):
    dependencies = [("rooms", "0003_seed_room_features")]

    operations = postgres_only(
        [
            migrations.RunSQL(DROP_CONSTRAINT, reverse_sql=migrations.RunSQL.noop),
            migrations.RunSQL(ADD_CONSTRAINT, reverse_sql=DROP_CONSTRAINT),
        ]
    )
