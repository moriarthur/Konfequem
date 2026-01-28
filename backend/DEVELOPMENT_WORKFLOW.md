# Development Workflow and Commands

## Quick Start

### Backend Development

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run development server
python manage.py runserver

# Create migrations
python manage.py makemigrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Open Django shell
python manage.py shell
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Testing Commands

### Backend Tests

```bash
cd backend

# Install test dependencies (first time only)
pip install -r requirements-test.txt

# Run all tests
pytest tests/ -v
# OR
make test

# Unit tests only
pytest tests/unit/ -v
# OR
make test-unit

# Integration tests only
pytest tests/integration/ -v
# OR
make test-integration

# E2E tests (requires PostgreSQL)
pytest tests/e2e/ -v
# OR
make test-e2e

# With coverage
pytest tests/ -v --cov=rooms --cov-report=html
# OR
make test-cov

# Run specific test file
pytest tests/unit/test_models.py -v

# Run specific test
pytest tests/ -v -k "test_room_with_valid_minimum_capacity"

# Run tests in parallel (faster)
pytest tests/ -v -n auto

# Linting
make lint
# OR
flake8 rooms config tests --exclude=migrations --max-line-length=88

# Format code
make format
# OR
black rooms config tests --exclude=migrations

# Clean test artifacts
make clean
```

### Current Test Status (2026-01-28)

```
All Tests: 124/124 passing (100%) ✅
- Unit Tests: 68/68 passing (100%)
- Integration Tests: 47/47 passing (100%)
- E2E Tests: 9/9 passing (100%)

Coverage: 97% (exceeds 80% target)
```

### Frontend Tests

```bash
cd frontend

# Install test dependencies (first time only)
npm install

# Run all tests
npm test

# Watch mode
npm run test:watch

# UI mode (interactive test runner)
npm run test:ui

# Coverage
npm run test:coverage

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

## Docker Development

### Using docker-compose

```bash
# Start all services (backend + frontend + database)
docker-compose up

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up --build

# Run backend commands in container
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser
docker-compose exec backend pytest tests/
```

## Database Operations

```bash
cd backend

# Reset database (WARNING: Deletes all data)
python manage.py flush --noinput

# Create migrations after model changes
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Check for migrations without applying
python manage.py makemigrations --check --dry-run

# Populate with sample data
python populate_db.py
```

## Code Quality

### Backend Linting and Formatting

```bash
cd backend

# Check style with flake8
flake8 rooms config tests --exclude=migrations --max-line-length=88 --extend-ignore=E203,W503

# Auto-format with black
black rooms config tests --exclude=migrations

# Check formatting (no changes)
black rooms config tests --check --exclude=migrations
```

### Frontend Linting

```bash
cd frontend

# Run ESLint
npm run lint

# Fix auto-fixable issues
npx eslint . --fix
```

## Git Workflow

```bash
# Check status
git status

# Stage changes
git add .

# Commit
git commit -m "message"

# Push to remote
git push
```

## Environment Variables

Required `.env` file (create from `.env.example`):

```bash
# Backend
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_DEBUG=False
DATABASE_URL=postgres://konfequem:password@localhost:5432/konfequem
ALLOWED_HOSTS=localhost,127.0.0

# Frontend (usually Vite handles these automatically)
VITE_API_URL=/api
```

## CI/CD

### GitHub Actions

Tests run automatically on push to `main` or `develop` branches.

**Workflows**: `.github/workflows/test.yml`

**Jobs**:
1. **Backend Tests**: PostgreSQL + pytest with coverage
2. **Frontend Tests**: npm test with coverage

**Coverage Reports**: Uploaded to Codecov

### Local CI Testing

```bash
# Test backend as CI would
cd backend
pytest tests/ -v --cov

# Test frontend as CI would  
cd frontend
npm run test:coverage
```

## Troubleshooting

### Backend Won't Start

1. Check `.env` file exists and has correct values
2. Run migrations: `python manage.py migrate`
3. Check if port 8000 is available
4. Look at Django error messages for specific issues

### Frontend Won't Start

1. `rm -rf node_modules && npm install`
2. Check if port 5173 is available
3. Check API_URL is correct in environment
4. Look for import errors in browser console

### Tests Fail with Database Errors

1. Clear Python cache: `find . -type d -name "__pycache__" -exec rm -rf {} +`
2. Check DATABASE_URL in `.env`
3. Ensure migrations are applied: `python manage.py migrate`
4. For SQLite tests, settings_test.py must have correct configuration

### Port Conflicts

**Backend (default: 8000)**:
```bash
lsof -i :8000
kill -9 <PID>
```

**Frontend (default: 5173)**:
```bash
lsof -i :5173
kill -9 <PID>
```

**PostgreSQL (default: 5432)**:
```bash
lsof -i :5432
kill -9 <PID>
```
