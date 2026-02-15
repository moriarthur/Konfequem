# Backend Dockerfile for Django
# Usage: This file is used by docker-compose.yml
# For local development without Docker, see .env.local.example
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --upgrade pip
RUN pip install -r requirements.txt

COPY . .

# Run Django development server on port 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
