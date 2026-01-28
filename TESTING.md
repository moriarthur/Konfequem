# Testing Guide for Konfequem

This guide covers how to run, write, and understand tests for the Konfequem room booking system.

## Table of Contents

- [Overview](#overview)
- [Backend Testing](#backend-testing)
- [Frontend Testing](#frontend-testing)
- [CI/CD](#cicd)
- [Writing Tests](#writing-tests)

## Overview

The Konfequem project uses a comprehensive testing setup:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | pytest + pytest-django | Unit and integration tests for Django models, serializers, and views |
| Frontend | Vitest + React Testing Library | Unit and integration tests for React components and utilities |
| API Mocking | MSW (Mock Service Worker) | Network-level API mocking for frontend tests |
| Coverage | pytest-cov + vitest-coverage-v8 | Coverage reporting with HTML output |

## Backend Testing

### Setup

```bash
cd backend
pip install -r requirements-test.txt
```

### Running Tests

```bash
# Run all tests
make test
# or
pytest tests/ -v

# Run unit tests only
make test-unit
# or
pytest tests/unit/ -v -m unit

# Run integration tests only
make test-integration

# Run with coverage
make test-cov
# or
pytest tests/ -v --cov=rooms --cov-report=html

# Run specific test file
pytest tests/unit/test_models.py -v

# Run specific test function
pytest tests/ -v -k "test_room_with_valid_minimum_capacity"

# Run tests in parallel (faster)
make test-parallel
```

### Test Structure

```
backend/tests/
├── conftest.py              # Shared fixtures
├── unit/
│   ├── test_models.py       # Room and Booking model tests
│   ├── test_serializers.py  # Serializer validation tests
│   └── test_booking_model.py
├── integration/
│   ├── test_views.py        # API endpoint tests
│   └── test_authentication.py  # JWT auth tests
└── e2e/
    └── test_booking_flow.py # End-to-end workflow tests
```

### Key Fixtures

Available in `conftest.py`:

- `user` - Standard test user
- `staff_user` - Admin user
- `room` - Standard test room
- `booking` - Valid test booking
- `authenticated_api_client` - API client with auth headers
- `berlin_now`, `utc_now` - Time-aware fixtures

### Coverage Goals

| Area | Target |
|------|--------|
| Models | 90% |
| Serializers | 85% |
| Views | 75% |

## Frontend Testing

### Setup

```bash
cd frontend
npm install
```

### Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

### Test Structure

```
frontend/__tests__/
├── setup.ts                 # Global test setup
├── mocks/
│   └── handlers.ts          # MSW API handlers
├── unit/
│   ├── utils/
│   │   └── bookingUtils.test.ts  # Utility function tests
│   └── context/
│       └── AuthContext.test.tsx  # Auth context tests
├── integration/
│   └── components/
│       ├── LoginForm.test.tsx    # Login component tests
│       └── BookingForm.test.tsx  # Booking form tests
└── e2e/
    └── userJourneys.test.tsx     # End-to-end user journeys
```

### MSW (Mock Service Worker)

MSW is used to mock API requests in tests. Handlers are defined in `__tests__/mocks/handlers.ts`:

```typescript
// Example: Mock a successful login
http.post('/api/token/', async ({ request }) => {
  const body = await request.json()
  if (body.username === 'testuser' && body.password === 'testpass123') {
    return HttpResponse.json({
      access: 'mock-access-token',
      refresh: 'mock-refresh-token',
    })
  }
  return HttpResponse.json({ detail: 'Invalid credentials' }, { status: 401 })
})
```

### Coverage Goals

| Area | Target |
|------|--------|
| Utils | 90% |
| Contexts | 85% |
| Components | 75% |

## CI/CD

### GitHub Actions Workflow

The `.github/workflows/test.yml` file defines the CI pipeline:

1. **Backend Tests Job**
   - Sets up Python 3.11
   - Runs PostgreSQL service
   - Installs dependencies
   - Runs flake8 linting
   - Runs black format check
   - Runs pytest with coverage
   - Uploads coverage to Codecov

2. **Frontend Tests Job**
   - Sets up Node.js 20
   - Installs dependencies
   - Runs ESLint
   - Runs Vitest with coverage
   - Uploads coverage to Codecov

### Running Tests Locally Before Push

```bash
# Backend
cd backend
make lint
make test-cov

# Frontend
cd frontend
npm run lint
npm run test:coverage
```

## Writing Tests

### Backend Test Example

```python
import pytest
from rooms.models import Room

@pytest.mark.unit
class TestRoomModel:
    def test_room_with_valid_minimum_capacity(self, db):
        """Test that room can be created with minimum capacity of 1."""
        room = Room.objects.create(
            name='Single Office',
            location='Floor 1',
            capacity=1
        )
        assert room.capacity == 1
```

### Frontend Test Example

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import LoginForm from '@/components/LoginForm'

describe('LoginForm', () => {
  it('should render login form with all fields', () => {
    render(
      <BrowserRouter>
        <LoginForm />
      </BrowserRouter>
    )

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })
})
```

### Test Markers (Backend)

- `@pytest.mark.unit` - Fast, isolated tests
- `@pytest.mark.integration` - Tests using database
- `@pytest.mark.e2e` - Full workflow tests
- `@pytest.mark.timezone` - Timezone-related tests

### Best Practices

1. **Keep tests independent** - Each test should set up its own data
2. **Use descriptive names** - Test names should explain what is being tested
3. **Mock external dependencies** - Use fixtures and mocks for external services
4. **Test edge cases** - Include boundary conditions and error scenarios
5. **Maintain coverage** - Keep coverage above the defined thresholds

## Troubleshooting

### Backend

**Issue**: Tests fail with database errors

```bash
# Solution: Ensure --reuse-db flag is used or create database
pytest tests/ -v --reuse-db
```

**Issue**: Import errors for modules

```bash
# Solution: Ensure DJANGO_SETTINGS_MODULE is set
export DJANGO_SETTINGS_MODULE=config.settings
```

### Frontend

**Issue**: Vitest can't find imports

```javascript
// Solution: Check vitest.config.ts has correct path aliases
resolve: {
  alias: {
    '@': '/src',
    '@components': '/src/components',
    // ...
  }
}
```

**Issue**: MSW handlers not matching requests

```typescript
// Solution: Ensure API URL matches (use relative paths)
http.get('/api/rooms/', () => {...})  // ✅ Correct
http.get('http://localhost:8000/api/rooms/', () => {...})  // ❌ Wrong
```
