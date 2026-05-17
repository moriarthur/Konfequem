#!/bin/bash
set -e
python manage.py collectstatic --noinput
python manage.py migrate
python manage.py create_superuser
exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}
