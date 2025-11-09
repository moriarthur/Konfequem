# Konfequem - Room Booking System

## Quick Start

### Using Docker (recommended for development)
1. Clone the repository
2. Copy environment files:
   ```bash
   cp backend/.env.example backend/.env
   ```
3. Edit `.env` and uncomment Docker settings
4. Start services:
   ```bash
   docker compose up -d
   ```
5. Run migrations:
   ```bash
   docker compose exec backend python manage.py migrate
   ```
6. Create superuser:
   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```
7. Visit:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000/api
   - Admin: http://localhost:8000/admin

### Local Development (macOS/Linux)
1. Clone the repository

2. Backend Setup:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env and uncomment local development settings
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py runserver
   ```

3. Frontend Setup:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Visit:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000/api
   - Admin: http://localhost:8000/admin

## Environment Configuration

The system supports both Docker and local development through environment variables:

### Docker Mode
- Uses PostgreSQL container
- Backend connects to `db:5432`
- All services are containerized

### Local Mode
- Connects to local PostgreSQL
- Manual service management
- Flexibility for development

## Timezone Handling

The system uses:
- Backend: UTC for storage, Europe/Berlin for validation
- Frontend: Converts UTC to local timezone for display
- Office Hours: 08:00-22:00 (Berlin time)

## Development Notes

1. Committing:
   - Don't commit `.env` files
   - Update `.env.example` when adding new variables

2. Database:
   - Local dev uses port 5432
   - Docker uses mapped port 5433 to avoid conflicts

3. Code Style:
   - Backend: Black formatter
   - Frontend: ESLint + Prettier