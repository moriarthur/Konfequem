"""PostgreSQL-only tenant-integrity backstop for bookings.

Booking.clean() enforces organization == room.organization ==
user.organization on the admin/full_clean path, and the serializer
covers the API — but plain Booking.objects.create()/save() bypasses
model validation entirely. This trigger closes that window at the
database level: a cross-tenant row is rejected no matter who writes it
(a future background job, management command, raw SQL). No-op on
SQLite, where the test suite runs — the pg-specific tests skip there
(see TestBookingTenantTrigger).
"""

from django.db import connection, migrations

CREATE_TRIGGER = """
CREATE OR REPLACE FUNCTION rooms_booking_tenant_check() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM rooms_room r
        WHERE r.id = NEW.room_id AND r.organization_id <> NEW.organization_id
    ) THEN
        RAISE EXCEPTION 'booking room does not belong to the booking organization'
            USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
        SELECT 1 FROM rooms_user u
        WHERE u.id = NEW.user_id
          AND (u.organization_id IS NULL OR u.organization_id <> NEW.organization_id)
    ) THEN
        RAISE EXCEPTION 'booking user does not belong to the booking organization'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_tenant_check ON rooms_booking;
CREATE TRIGGER booking_tenant_check
BEFORE INSERT OR UPDATE ON rooms_booking
FOR EACH ROW EXECUTE FUNCTION rooms_booking_tenant_check();
"""

DROP_TRIGGER = """
DROP TRIGGER IF EXISTS booking_tenant_check ON rooms_booking;
DROP FUNCTION IF EXISTS rooms_booking_tenant_check();
"""


def postgres_only(operations):
    if connection.vendor != "postgresql":
        return []
    return operations


class Migration(migrations.Migration):
    dependencies = [("rooms", "0005_booking_start_time_idx")]

    operations = postgres_only(
        [migrations.RunSQL(CREATE_TRIGGER, reverse_sql=DROP_TRIGGER)]
    )
