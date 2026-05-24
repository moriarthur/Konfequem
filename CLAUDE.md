# Konfequem — Room Booking System

## Quick Start
```bash
docker compose up -d        # Start all services
docker compose logs -f      # View logs
```
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api
- Admin: http://localhost:8000/admin

## Tech Stack
- **Backend:** Django 4.2 + DRF + PostgreSQL 15 + SimpleJWT
- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS
- **Testing:** pytest (backend), Vitest + MSW (frontend)

## Commands
```bash
# Backend tests
cd backend && python3 -m pytest --tb=short -q

# Frontend tests
cd frontend && npx vitest run

# Frontend dev (outside Docker)
cd frontend && npm run dev
```

## Architecture
- Django app: `rooms` (models: Room, Booking, RoomFeature, Organization, User)
- Frontend pages: Home, RoomsPage, CalendarPage, ProfilePage
- Context API for state (AuthContext, AlertContext)
- Path aliases: @/*, @components/*, @utils/*, @context/*, @pages/*

## API Endpoints
- `POST /api/token/` / `POST /api/token/refresh/` — JWT auth
- `POST /api/register/` — create org + org_admin, returns JWT
- `POST /api/join/` — join org via invite key, returns JWT
- `GET /api/invites/<key>/` — org preview before joining
- `GET /api/users/me/` / `PUT /api/users/me/` — current user
- `POST /api/users/change-password/` — change password
- `/api/rooms/` — rooms (org-scoped, auth required)
- `/api/room-features/` — room features (read-only)
- `/api/bookings/` — bookings CRUD (authenticated, org-scoped)
- `GET /api/org/members/` — list org members (org_admin only)
- `POST /api/org/invite/regenerate/` — rotate invite key (org_admin only)

## Key Business Rules
- Office hours: 08:00–22:00 Europe/Berlin (CEST/CET aware)
- Min booking: 15 min, max: 8 hours, max advance: 90 days
- Overlap detection on both backend and frontend
- All data scoped to user's organization (except platform_admin)

## Multi-Org System
- Registration creates org + org_admin in one step
- Join via invite key (UUID on Organization model)
- Roles: platform_admin (is_staff), org_admin, member
- Rooms and bookings filtered by organization on all queries

## Testing Notes
- Timezone fixtures: use `berlin_tz`/`berlin_now` for DST-safe tests
- Never hardcode UTC offsets — Berlin observes CET/CEST
- MSW handlers in `frontend/src/__tests__/mocks/handlers.ts`

## TypeScript
- Fully typed: all files, zero `@ts-nocheck`
- Central types: `frontend/src/types.ts`
- Path aliases: @/*, @components/*, @utils/*, @context/*, @pages/*

## Git Conventions
- Conventional commits: feat/fix/refactor/test/chore
- English only, no AI attribution in commit messages
