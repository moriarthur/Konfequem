from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Create a superuser from env vars if it doesn't exist"

    def handle(self, *args, **options):
        from decouple import config

        username = config("SUPERUSER_USERNAME", default="admin")
        email = config("SUPERUSER_EMAIL", default="admin@example.com")
        password = config("SUPERUSER_PASSWORD", default=None)

        if not password:
            self.stdout.write("SUPERUSER_PASSWORD not set, skipping.")
            return

        if User.objects.filter(username=username).exists():
            self.stdout.write(f"User '{username}' already exists.")
            return

        User.objects.create_superuser(username=username, email=email, password=password)
        self.stdout.write(self.style.SUCCESS(f"Created superuser '{username}'"))
