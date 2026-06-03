<div align="center">

# Konfequem

### Multi-Tenant Room Booking Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![Django](https://img.shields.io/badge/Django_4.2-092E20?style=flat&logo=django&logoColor=white)](https://djangoproject.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)](https://docker.com)

*Book rooms by the hour with real-time calendar views, JWT-secured API, and office-hours validation.*

</div>

---

## What it does

Konfequem is a room booking system for organizations that need to manage shared spaces — conference rooms, coworking desks, studios. Users browse available rooms, pick a time slot on a visual calendar, and book instantly. The backend enforces business rules: no double-bookings, office hours only (08:00–22:00), min 15 min / max 8 hours per booking.

## Key Features

- **Visual Calendar** — Interactive calendar view for room availability at a glance
- **Room Management** — Browse rooms, view details, filter by capacity and equipment
- **JWT Authentication** — Secure signup/login with access + refresh tokens (SimpleJWT)
- **Booking Validation** — Office hours enforcement, overlap detection, advance booking limits
- **User Profiles** — Account management and booking history
- **Timezone-Aware** — Stores UTC, displays Europe/Berlin; correct DST handling
- **Docker-Ready** — Full Docker Compose stack (Django + React + PostgreSQL)
- **Test Suite** — pytest on backend, testing infrastructure on frontend

## Architecture

```
konfequem/
├── backend/                  # Django 4.2 REST API
│   ├── config/               # Project settings, URLs, ASGI/WSGI
│   ├── rooms/                # Core app: models, views, serializers
│   │   ├── models.py         # Room & Booking models
│   │   ├── models_users.py   # Custom user model
│   │   ├── auth_serializers.py
│   │   └── management/       # Custom management commands
│   ├── admin-interface/      # Django admin customizations
│   ├── tests/                # pytest test suite
│   └── Dockerfile
├── frontend/                 # React 19 + Vite + TypeScript
│   └── src/
│       ├── pages/            # Calendar, Rooms, Home, Profile
│       ├── components/       # Reusable UI components
│       ├── context/          # React context providers
│       └── utils/            # Helpers and API clients
├── docker-compose.yml
└── .github/                  # CI/CD workflows
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| Backend | Django 4.2, Django REST Framework |
| Auth | SimpleJWT (access + refresh tokens) |
| Database | PostgreSQL (Docker) / SQLite (local) |
| Infra | Docker, Docker Compose |
| Testing | pytest, Django test runner |

## Getting Started

```bash
# Prerequisites: Docker & Docker Compose

# Clone
git clone https://github.com/moriarthur/Konfequem.git
cd Konfequem

# Configure
cp .env.docker.example .env

# Start all services
docker compose up -d

# Run migrations & create admin
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser

# Access
# Frontend:  http://localhost:5173
# API:       http://localhost:8000/api
# Admin:     http://localhost:8000/admin
```

## Booking Rules

| Rule | Value |
|------|-------|
| Operating hours | 08:00 – 22:00 (Berlin time) |
| Minimum booking | 15 minutes |
| Maximum booking | 8 hours |
| Advance booking | Up to 90 days |
| Overlap detection | Server-side validation |

---

<div align="center">

*Built with [Claude Code](https://claude.ai/code) — AI-native development workflow*

</div>
