"""
Test settings for Konfequam.

Imports from main settings and overrides database for SQLite testing.
"""

from config.settings import *  # noqa: F403,F405

# Allow test server host
ALLOWED_HOSTS = ["*"]

# Override database to use SQLite for local testing
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Use faster password hasher for tests
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Add form parsers for JWT token endpoints (they expect form data)
REST_FRAMEWORK["DEFAULT_PARSER_CLASSES"] = [  # noqa: F405
    "rest_framework.parsers.JSONParser",
    "rest_framework.parsers.FormParser",
    "rest_framework.parsers.MultiPartParser",
]
