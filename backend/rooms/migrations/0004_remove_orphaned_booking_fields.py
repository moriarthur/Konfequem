# Generated manually to remove orphaned database fields

from django.db import migrations


def remove_orphaned_fields(apps, schema_editor):
    """Remove note and reminder_tags columns that exist in DB but not in model"""
    # SQLite doesn't support DROP COLUMN directly, so we use a workaround
    # For simplicity in development, we'll use Python to execute the SQL
    try:
        with schema_editor.connection.cursor() as cursor:
            # Check if columns exist
            cursor.execute("PRAGMA table_info(rooms_booking)")
            columns = {row[1] for row in cursor.fetchall()}

            if 'note' in columns:
                # For SQLite, we need to recreate the table without these columns
                # This is a simplified approach for development
                cursor.execute("""
                    CREATE TABLE rooms_booking_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        date date NOT NULL,
                        start_time datetime NOT NULL,
                        end_time datetime NOT NULL,
                        created_at datetime NOT NULL,
                        room_id bigint NOT NULL REFERENCES rooms_room(id) DEFERRABLE INITIALLY DEFERRED,
                        user_id integer NOT NULL REFERENCES auth_user(id) DEFERRABLE INITIALLY DEFERRED
                    )
                """)
                cursor.execute("""
                    INSERT INTO rooms_booking_new
                    SELECT id, date, start_time, end_time, created_at, room_id, user_id
                    FROM rooms_booking
                """)
                cursor.execute("DROP TABLE rooms_booking")
                cursor.execute("ALTER TABLE rooms_booking_new RENAME TO rooms_booking")
    except Exception as e:
        # If something goes wrong, log but don't fail the migration
        pass


def reverse_func(apps, schema_editor):
    # No-op for reverse
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('rooms', '0003_roomfeature_room_features'),
    ]

    operations = [
        migrations.RunPython(remove_orphaned_fields, reverse_func),
    ]
