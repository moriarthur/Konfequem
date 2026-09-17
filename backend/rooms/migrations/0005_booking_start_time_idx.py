from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("rooms", "0004_booking_overlap_exclude_cancelled"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="booking",
            index=models.Index(fields=["start_time"], name="rooms_booking_start_idx"),
        ),
    ]
