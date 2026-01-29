"""
Local development settings for Konfequam.

Imports from main settings and overrides database for persistent SQLite.
Used for local development without Docker/PostgreSQL.
"""

from config.settings import *

# Override database to use persistent SQLite for local development
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Keep test settings optimizations
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# Add form parsers for JWT token endpoints (they expect form data)
REST_FRAMEWORK['DEFAULT_PARSER_CLASSES'] = [
    'rest_framework.parsers.JSONParser',
    'rest_framework.parsers.FormParser',
    'rest_framework.parsers.MultiPartParser',
]
