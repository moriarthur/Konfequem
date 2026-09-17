"""PostgreSQL-only guards against post-hoc organization changes.

The booking tenant trigger (migration 0006) only fires on
rooms_booking writes. But moving a Room or a User to another
organization AFTER bookings exist silently turns those bookings
cross-tenant — again leaking foreign room names through availability.
These triggers forbid organization changes while any booking
references the row. Rooms/users without bookings can still be moved.

No-op on SQLite, where the test suite runs (pg-only tests cover the
behavior when pytest is pointed at PostgreSQL).
"""

from django.db import connection, migrations

CREATE_GUARDS = """
CREATE OR REPLACE FUNCTION rooms_room_org_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
       AND EXISTS (SELECT 1 FROM rooms_booking b WHERE b.room_id = NEW.id)
    THEN
        RAISE EXCEPTION 'room has bookings and cannot change organization'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS room_org_guard ON rooms_room;
CREATE TRIGGER room_org_guard
BEFORE UPDATE ON rooms_room
FOR EACH ROW EXECUTE FUNCTION rooms_room_org_guard();

CREATE OR REPLACE FUNCTION rooms_user_org_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
       AND EXISTS (SELECT 1 FROM rooms_booking b WHERE b.user_id = NEW.id)
    THEN
        RAISE EXCEPTION 'user has bookings and cannot change organization'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_org_guard ON rooms_user;
CREATE TRIGGER user_org_guard
BEFORE UPDATE ON rooms_user
FOR EACH ROW EXECUTE FUNCTION rooms_user_org_guard();
"""

DROP_GUARDS = """
DROP TRIGGER IF EXISTS room_org_guard ON rooms_room;
DROP FUNCTION IF EXISTS rooms_room_org_guard();
DROP TRIGGER IF EXISTS user_org_guard ON rooms_user;
DROP FUNCTION IF EXISTS rooms_user_org_guard();
"""


def postgres_only(operations):
    if connection.vendor != "postgresql":
        return []
    return operations


class Migration(migrations.Migration):
    dependencies = [("rooms", "0006_booking_tenant_trigger")]

    operations = postgres_only(
        [migrations.RunSQL(CREATE_GUARDS, reverse_sql=DROP_GUARDS)]
    )
