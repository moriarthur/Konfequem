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
- Single Django app: `rooms` (models: Room, Booking, RoomFeature)
- Frontend pages: Home, RoomsPage, CalendarPage, ProfilePage
- Context API for state (AuthContext, AlertContext)
- Path aliases: @/*, @components/*, @utils/*, @context/*, @pages/*

## Key Business Rules
- Office hours: 08:00–22:00 Europe/Berlin (CEST/CET aware)
- Min booking: 15 min, max: 8 hours, max advance: 90 days
- Overlap detection on both backend and frontend

## Testing Notes
- Timezone fixtures: use `berlin_tz`/`berlin_now` for DST-safe tests
- Never hardcode UTC offsets — Berlin observes CET/CEST
- MSW handlers in `frontend/src/__tests__/mocks/handlers.ts`

## TypeScript Status
- Fully typed: utils, context, all UI components, hooks
- @ts-nocheck remaining: BookingForm (745 lines), Home (567 lines), RoomsPage, ProfilePage, AvailabilityCalendar

## Git Conventions
- Conventional commits: feat/fix/refactor/test/chore
- English only, no AI attribution in commit messages
