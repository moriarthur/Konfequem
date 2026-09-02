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
- `/api/rooms/` — rooms (org-scoped, auth required; create/update/delete org_admin only,
  deletion blocked while future bookings exist; write serializer takes feature PKs)
- `/api/room-features/` — room features (read-only)
- `/api/bookings/` — bookings CRUD (authenticated, org-scoped)
- `POST /api/bookings/<id>/cancel/` — soft cancel (row stays for history, slot
  frees; future-only, idempotent; cancelled excluded from overlap checks + DB constraint)
- `GET /api/org/members/` — list org members (org_admin only)
- `POST /api/org/invite/regenerate/` — rotate invite key (org_admin only)

## Rate Limiting
Scoped via `ScopedRateThrottle` (`backend/config/settings.py` → `DEFAULT_THROTTLE_RATES`, scopes set in `backend/rooms/views.py`). Only auth/session-sensitive endpoints are throttled; data endpoints (rooms, bookings, users/me, org) are NOT — a global limit caused a bug where tab navigation exhausted the budget and pages rendered empty (429s swallowed).

| Scope | Endpoint | Rate |
|---|---|---|
| login | POST /api/token/ | 10/min |
| token_refresh | POST /api/token/refresh/ | 30/min |
| register | POST /api/register/ | 5/min |
| join | POST /api/join/ | 10/min |
| invite_preview | GET /api/invites/<key>/ | 30/min |
| change_password | POST /api/users/change-password/ | 10/min |
| regenerate_invite | POST /api/org/invite/regenerate/ | 10/min |
| token_blacklist | POST /api/token/blacklist/ | 30/min |

Caveats: throttle counters live in Django's default LocMemCache (per-process). Single gunicorn worker in `backend/entrypoint.sh`; verified on prod 2026-08-27 that effective limits on Render (free tier) still run ~2-4x softer than nominal — buckets split across infra instances/ident variability; a shared cache (Redis) is the real fix if limits ever matter for real. `NUM_PROXIES=1` is set in settings.py (env-overridable) so anon buckets key on the proxy-supplied client IP, not the spoofable full X-Forwarded-For header. In tests, mutate `SimpleRateThrottle.THROTTLE_RATES` in place (class-level snapshot — replacing the settings dict is invisible).

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
- MSW handlers in `frontend/__tests__/mocks/handlers.ts`

## TypeScript
- Fully typed: all files, zero `@ts-nocheck`
- Central types: `frontend/src/types.ts`
- Path aliases: @/*, @components/*, @utils/*, @context/*, @pages/*

## Git Conventions
- Conventional commits: feat/fix/refactor/test/chore
- English only, no AI attribution in commit messages

## Tool Usage

- Use Serena for semantic code navigation, symbols, references, implementations, and safe symbol-level edits.
- Use CodeGraph for dependency analysis, architecture, impact, callers/callees, and cross-module relationships.
- Use Context7 when implementing or debugging third-party libraries and current APIs.
- Prefer native Grep/Glob/Read for simple text and file searches.