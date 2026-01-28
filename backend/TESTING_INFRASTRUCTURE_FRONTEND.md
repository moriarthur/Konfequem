# Testing Infrastructure - Frontend

## Setup

**Test Dependencies** (added to package.json)
```json
{
  "@testing-library/jest-dom": "^6.6.5",
  "@testing-library/react": "^16.1.0",
  "@testing-library/user-event": "^14.5.2",
  "@vitest/coverage-v8": "^2.1.8",
  "@vitest/ui": "^2.1.8",
  "msw": "^2.7.0",
  "vitest": "^2.1.8"
}
```

Install: `npm install`

## Configuration

**vitest.config.ts**
- jsdom environment for DOM testing
- Setup files: `__tests__/setup.ts`
- Coverage thresholds: 80%
- Path aliases: @, @components, @utils, @context, @pages

**package.json scripts**
```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage",
  "test:unit": "vitest run __tests__/unit",
  "test:integration": "vitest run __tests__/integration",
  "test:e2e": "vitest run __tests__/e2e",
  "test:watch": "vitest watch"
}
```

## Test Structure

```
frontend/__tests__/
├── setup.ts                 # Global test setup
├── mocks/
│   └── handlers.ts          # MSW API handlers
├── unit/
│   ├── utils/
│   │   └── bookingUtils.test.ts
│   └── context/
│       └── AuthContext.test.tsx
└── integration/
    └── components/
        ├── LoginForm.test.tsx
        └── BookingForm.test.tsx
```

## MSW (Mock Service Worker)

**Handlers** (`__tests__/mocks/handlers.ts`)
- Mocks all backend API endpoints
- `/api/token/` - Login
- `/api/token/refresh/` - Token refresh
- `/api/users/me/` - Current user
- `/api/rooms/` - Room list/retrieve
- `/api/bookings/` - Booking CRUD operations

## Running Tests

```bash
cd frontend

# All tests
npm test

# Watch mode
npm run test:watch

# UI mode
npm run test:ui

# Coverage
npm run test:coverage

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

## Key Test Utilities

**setup.ts** provides:
- Global cleanup (afterEach)
- MSW server setup/listeners
- localStorage mock
- IntersectionObserver mock
- ResizeObserver mock
- MediaQuery mock

## Test Components Covered

### Unit Tests
- `bookingUtils.test.ts` - Timezone conversion, office hours validation, slot calculation

### Integration Tests  
- `AuthContext.test.tsx` - Login/logout, token refresh
- `LoginForm.test.tsx` - Form validation, error handling
- `BookingForm.test.tsx` - Date/time selection flow

## Important Notes

1. **MSW Usage**: All API calls are mocked - no real backend needed during tests
2. **localStorage**: Fully mocked for auth tokens
3. **Timezone**: Tests use Luxon for timezone-aware datetime testing
4. **React 19**: Testing Library v16.3.2 compatible with React 19

## Pending Work

Frontend tests created but **not yet executed**. Need to:
1. Install all dependencies: `npm install`
2. Run tests: `npm test`
3. Fix any import/compatibility issues
