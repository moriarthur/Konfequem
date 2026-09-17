# Development Guide - Konfequem

## Quick Start

### Docker Mode (Windows/WSL with Docker)
```bash
# Copy Docker environment file
cp .env.docker.example .env

# Start all services
docker compose up -d

# Run migrations
docker compose exec backend python manage.py migrate

# Create superuser (optional)
docker compose exec backend python manage.py createsuperuser

# Access applications
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000/api
# Admin: http://localhost:8000/admin
```

### Local Mode (without Docker)
Requires a reachable PostgreSQL — settings are Postgres-only. Easiest: start
just the compose `db` service (`docker compose up -d db`, reachable on
127.0.0.1:5433) or install Postgres locally.
```bash
# Copy Local environment file
cp .env.local.example .env

# Backend Setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser  # Optional
python manage.py runserver

# Frontend Setup (new terminal)
cd frontend
npm install
npm run dev

# Access applications (same URLs as Docker)
```

## Environment Switching

The project uses two environment templates:

- **`.env.docker.example`** - For Docker/PostgreSQL setup
  - DATABASE_URL: `postgresql://admin:<POSTGRES_PASSWORD>@db:5432/konfequem`
  - POSTGRES_PASSWORD: required by docker-compose (no fallback)
  - DOCKER: `true` (legacy, informational)

- **`.env.local.example`** - For local (non-Docker) backend runs
  - DATABASE_URL: PostgreSQL on `127.0.0.1:5433` (the compose `db` service)
    or any other local Postgres instance
  - DOCKER: `false` (legacy, informational)

To switch environments:
1. Stop any running services
2. Copy the appropriate example file: `cp .env.<environment>.example .env`
3. Start services with the new configuration

## Common Commands

### Backend (Django)
```bash
# Make migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver

# A Makefile lives in backend/ — run these from that directory
make test              # All tests
make test-unit         # Unit tests only
make test-cov          # With coverage
make lint              # flake8 (CI config)
make format            # black

# Or call the tools directly:
python3 -m pytest --tb=short -q
python3 -m flake8 rooms config tests --exclude=migrations --max-line-length=88 --extend-ignore=E203,W503
```

### Frontend (React)
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Run tests
npx vitest run          # All tests, single run
npm run test:unit       # Unit tests only
npm run lint            # ESLint
npx tsc --noEmit        # TypeScript check
```

### Docker Commands
```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f backend

# Run commands in container
docker compose exec backend python manage.py migrate
```

## Environment Variables

### Required (Root .env)
- `DJANGO_SECRET_KEY`: Django secret key (change in production)
- `DJANGO_DEBUG`: True/False (development/production; the wildcard
  ALLOWED_HOSTS fallback applies only while DEBUG=True)
- `ALLOWED_HOSTS`: Comma-separated list of allowed hosts
- `DATABASE_URL`: Database connection string
- `POSTGRES_PASSWORD`: local docker Postgres password (docker-compose
  requires it — no fallback)
- `DOCKER`: legacy, no longer read by the backend; harmless to keep

### Frontend (Loaded from Root .env)
- `VITE_BACKEND_URL`: Backend API URL (default: http://localhost:8000)

### Example Configurations

**Docker (.env.docker.example):**
```bash
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgresql://admin:<postgres-password>@db:5432/konfequem
POSTGRES_PASSWORD=<postgres-password>
VITE_BACKEND_URL=http://localhost:8000
```

**Local (.env.local.example):**
```bash
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DOCKER=false
POSTGRES_PASSWORD=change-me-local-only
DATABASE_URL=postgresql://admin:change-me-local-only@127.0.0.1:5433/konfequem
VITE_BACKEND_URL=http://localhost:8000
```

## API Documentation

All `/api/` endpoints return paginated lists (`{count, next, previous, results}`,
100/page) except `/api/availability/`. The frontend follows `next` links via
`fetchAllPages()` — do not read only `results` from list endpoints.

### Multi-org model
- Registration creates an organization + its org_admin in one step
- Joining is via invite key (UUID on Organization; rotatable by org_admin)
- All data is scoped to the user's organization; roles: platform_admin
  (`is_staff`, manages via Django admin — no API writes), org_admin, member

### Authentication
- Login: POST /api/token/ (throttled)
- Refresh (rotating + blacklist-on-rotation): POST /api/token/refresh/
- Logout: POST /api/token/blacklist/
- Register (creates org + org_admin): POST /api/register/ (throttled)
- Join via invite key: POST /api/join/ (throttled)
- Invite preview: GET /api/invites/{key}/
- Current user: GET /api/users/me/ · PUT /api/users/me/
- Change password: POST /api/users/change-password/ — blacklists ALL of the
  user's outstanding refresh tokens (access tokens stay valid up to 30 min)
- Org members (org_admin only): GET /api/org/members/
- Rotate invite key (org_admin only): POST /api/org/invite/regenerate/

### Rooms
- List rooms: GET /api/rooms/ (org-scoped)
- Get room details: GET /api/rooms/{id}/
- Create/update/delete: org_admin only; deletion blocked while active future
  bookings exist (cancelled ones don't block)

### Room features
- GET /api/room-features/ (read-only)

### Bookings
- List bookings: GET /api/bookings/?month=YYYY-MM | ?date=YYYY-MM-DD —
  personal only (user-scoped)
- Create booking: POST /api/bookings/ — room must belong to the user's org
- Update booking: PUT/PATCH /api/bookings/{id}/
- Cancel (soft, preferred): POST /api/bookings/{id}/cancel/ — row stays for
  history, slot frees; future-only, idempotent; cancelled bookings are
  excluded from overlap checks and the DB exclusion constraint
- Delete: DELETE /api/bookings/{id}/ — hard delete, kept for API completeness;
  the UI uses cancel
- Booking rules live in ONE place: `backend/rooms/validators.py`
  (office hours 08:00–22:00 Berlin, same-day end, 15 min–8 h duration,
  90-day advance) — enforced by both the serializer and `Booking.clean()`

### Availability (org-wide)
- GET /api/availability/?month=YYYY-MM[&room=<id>] — minimal non-personal
  fields (id, room, room_name, times, status) for every active booking in the
  org; cancelled excluded; strict month validation; foreign/unknown room → 404.
  The calendar and conflict pre-checks run on this, not on /api/bookings/

## Testing Notes
- Backend: 230+ tests (pytest; unit + integration + e2e). 2 tests skip on
  SQLite — the Postgres-only exclusion-constraint tests
- Frontend: 170+ tests (Vitest + MSW; handlers in
  `frontend/__tests__/mocks/handlers.ts`)
- CI runs flake8 + black --check + pytest + eslint + tsc + vitest on every push
- Timezone rule: use the `berlin_tz`/`berlin_now` fixtures and pin Berlin
  hours (`berlin_at()` in model tests) — never hardcode UTC offsets, and
  never build booking times from `now + timedelta` (drifts out of office hours)

## Troubleshooting

### Database Issues
- Check PostgreSQL is running
- Verify DATABASE_URL is correct
- Run migrations if tables missing

### CORS Issues
- Ensure django-cors-headers is installed
- Check CORS_ALLOWED_ORIGINS in settings

### Build Issues
- Clear Python cache: `find . -name '*.pyc' -delete`
- Clear Node cache: `npm cache clean --force`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## Project Structure Tips

- Backend uses Django apps for modular organization
- Frontend follows component-based React patterns
- Context API for state management (Auth, Alert)
- Custom hooks for authentication (useAuth, authFetch)
- Centralized API calls via authFetch utility