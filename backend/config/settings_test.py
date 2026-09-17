"""
Test settings for Konfequem.

Defaults to SQLite in-memory. Set TEST_DATABASE_URL to point the suite
at real PostgreSQL instead — that exercises the Postgres-only backstops
(overlap exclusion constraint, tenant triggers) whose tests otherwise
skip.
"""

import os
from urllib.parse import urlparse, unquote

from config.settings import *  # noqa: F403,F405

# Allow test server
ALLOWED_HOSTS = ["*"]

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")

if TEST_DATABASE_URL:
    parsed = urlparse(TEST_DATABASE_URL)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": parsed.path.lstrip("/"),
            "USER": parsed.username,
            "PASSWORD": unquote(parsed.password or ""),
            "HOST": parsed.hostname,
            "PORT": parsed.port or 5432,
        }
    }
else:
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
