# Generated manually to remove orphaned database fields

from django.db import migrations


def remove_orphaned_fields(apps, schema_editor):
    """Remove note and reminder_tags columns if they exist"""
    connection = schema_editor.connection
    vendor = connection.vendor

    with connection.cursor() as cursor:
        if vendor == "postgresql":
            cursor.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='rooms_booking'"
            )
            columns = {row[0] for row in cursor.fetchall()}
            if "note" in columns:
                cursor.execute("ALTER TABLE rooms_booking DROP COLUMN note")
            if "reminder_tags" in columns:
                cursor.execute("ALTER TABLE rooms_booking DROP COLUMN reminder_tags")
        elif vendor == "sqlite":
            cursor.execute("PRAGMA table_info(rooms_booking)")
            columns = {row[1] for row in cursor.fetchall()}
            if "note" in columns:
                cursor.execute(
                    "CREATE TABLE rooms_booking_new ("
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                    "date date NOT NULL, "
                    "start_time datetime NOT NULL, "
                    "end_time datetime NOT NULL, "
                    "created_at datetime NOT NULL, "
                    "room_id bigint NOT NULL REFERENCES rooms_room(id) DEFERRABLE INITIALLY DEFERRED, "
                    "user_id integer NOT NULL REFERENCES auth_user(id) DEFERRABLE INITIALLY DEFERRED"
                    ")"
                )
                cursor.execute(
                    "INSERT INTO rooms_booking_new "
                    "SELECT id, date, start_time, end_time, created_at, room_id, user_id "
                    "FROM rooms_booking"
                )
                cursor.execute("DROP TABLE rooms_booking")
                cursor.execute("ALTER TABLE rooms_booking_new RENAME TO rooms_booking")


def reverse_func(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0003_roomfeature_room_features"),
    ]

    operations = [
        migrations.RunPython(remove_orphaned_fields, reverse_func),
    ]
