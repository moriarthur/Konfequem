# Development Guide - Konfequem

## Quick Start

### With Docker (Recommended)
```bash
# Start all services
docker-compose up --build

# Access applications
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# Admin: http://localhost:8000/admin/
```

### Local Development (Mac - PostgreSQL via brew)
1. Ensure PostgreSQL is running via Homebrew
2. Create database:
   ```bash
   createdb konfequem
   ```
3. Copy `.env` from `.env.example` if needed
4. Run backend:
   ```bash
   cd backend
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver
   ```
5. Run frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Common Commands

### Backend (Django)
```bash
# Make migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run tests (if any)
python manage.py test
```

### Frontend (React)
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

## Environment Variables

### Required
- `DJANGO_SECRET_KEY`: Django secret key
- `DJANGO_DEBUG`: True/False (development/production)
- `DATABASE_URL`: Database connection string
- `DOCKER`: true/false (Docker mode)
- `VITE_BACKEND_URL`: Backend API URL

### Example .env
```
# Backend
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=True
DATABASE_URL=postgres://admin:secret@localhost:5432/konfequem
DOCKER=false

# Frontend
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