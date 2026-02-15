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

### Local Mode (macOS/Windows without Docker)
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
  - DATABASE_URL: `postgresql://admin:secret@db:5432/konfequem`
  - DOCKER: `true`

- **`.env.local.example`** - For local/SQLite setup
  - DATABASE_URL: `sqlite:///backend/db.sqlite3`
  - DOCKER: `false`

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

# Run tests
make test              # All tests
make test-unit         # Unit tests only
make test-cov          # With coverage
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
npm test               # All tests
npm run test:coverage  # With coverage
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
- `DJANGO_DEBUG`: True/False (development/production)
- `ALLOWED_HOSTS`: Comma-separated list of allowed hosts
- `DATABASE_URL`: Database connection string
- `DOCKER`: true/false (Docker detection)

### Frontend (Loaded from Root .env)
- `VITE_BACKEND_URL`: Backend API URL (default: http://localhost:8000)

### Example Configurations

**Docker (.env.docker.example):**
```bash
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DOCKER=true
DATABASE_URL=postgresql://admin:secret@db:5432/konfequem
VITE_BACKEND_URL=http://localhost:8000
```

**Local (.env.local.example):**
```bash
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DOCKER=false
DATABASE_URL=sqlite:///backend/db.sqlite3
VITE_BACKEND_URL=http://localhost:8000
```

## API Documentation

### Authentication
- Login: POST /api/token/
- Refresh: POST /api/token/refresh/
- Logout: DELETE /api/token/blacklist/

### Rooms
- List rooms: GET /api/rooms/
- Get room details: GET /api/rooms/{id}/

### Bookings
- List bookings: GET /api/bookings/
- Create booking: POST /api/bookings/
- Update booking: PUT /api/bookings/{id}/
- Delete booking: DELETE /api/bookings/{id}/

## Testing Notes
- No automated tests currently implemented
- Manual testing via admin interface and UI
- Consider adding unit/integration tests for future

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