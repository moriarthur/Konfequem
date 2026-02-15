# Konfequem - Room Booking System

A modern room booking system built with Django 4.2 (backend) and React 19 (frontend), featuring JWT authentication and office-hours-based booking validation.

## Quick Start

### Option 1: Docker Setup (Windows/WSL with Docker)

**Prerequisites:** Docker and Docker Compose installed

```bash
# 1. Clone the repository
git clone <repository-url>
cd Konfequem

# 2. Copy Docker environment file
cp .env.docker.example .env

# 3. Start services
docker compose up -d

# 4. Run migrations
docker compose exec backend python manage.py migrate

# 5. Create superuser (optional)
docker compose exec backend python manage.py createsuperuser

# 6. Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000/api
# Admin: http://localhost:8000/admin
```

### Option 2: Local Setup (macOS/Windows without Docker)

**Prerequisites:** Python 3.11+, Node.js 18+

```bash
# 1. Clone the repository
git clone <repository-url>
cd Konfequem

# 2. Copy Local environment file
cp .env.local.example .env

# 3. Backend Setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser  # Optional
python manage.py runserver

# 4. Frontend Setup (new terminal)
cd frontend
npm install
npm run dev

# 5. Access the application
# Same URLs as Docker mode
```

## Environment Configuration

The system supports two environments:

### Docker Mode (.env.docker.example)
- **Database:** PostgreSQL (containerized)
- **Connection:** `postgresql://admin:secret@db:5432/konfequem`
- **Services:** All containerized

### Local Mode (.env.local.example)
- **Database:** SQLite (file-based)
- **Connection:** `sqlite:///backend/db.sqlite3`
- **Services:** Run manually

## Standard Ports

- **Backend:** 8000
- **Frontend:** 5173
- **Database (Docker):** 5433 (mapped from container 5432)

## Timezone Handling

- **Storage:** UTC (backend database)
- **Display:** Europe/Berlin (frontend)
- **Office Hours:** 08:00-22:00 (Berlin time)
- **Booking Rules:** 15min minimum, 8 hours maximum, 90 days advance

## Development Notes

1. **Environment Files:**
   - Never commit `.env` files
   - Use `.env.docker.example` or `.env.local.example` as templates
   - Update example files when adding new variables

2. **Database:**
   - Docker: PostgreSQL in container
   - Local: SQLite file at `backend/db.sqlite3`

3. **Code Style:**
   - Backend: Black formatter (`make format`)
   - Frontend: ESLint + Prettier

4. **Testing:**
   - Backend: `cd backend && make test`
   - Frontend: `cd frontend && npm test`

## Windows/WSL Notes

- Docker Desktop must be running
- WSL2 backend recommended for better performance
- Use `cp .env.docker.example .env` for Docker setup