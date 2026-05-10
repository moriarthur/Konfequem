/**
 * MSW (Mock Service Worker) handlers for API mocking.
 *
 * This module sets up mock responses for all backend API endpoints,
 * allowing tests to run without a real backend server.
 */

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

// ============================================================================
// Helper Functions
// ============================================================================

const createJsonResponse = (data: Record<string, unknown> | Record<string, unknown>[], status = 200) => {
  return HttpResponse.json(data, { status })
}

const createErrorResponse = (message: string | Record<string, string[]>, status = 400) => {
  return HttpResponse.json({ detail: message }, { status })
}

// Create valid-looking JWT tokens for testing
// Format: header.payload.signature
const createMockAccessJwt = () => {
  // Header: {"alg":"HS256","typ":"JWT"}
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // Payload with exp far in the future (year 2060)
  const payload = btoa(JSON.stringify({ exp: 2863311600 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // Mock signature (not actually validated in tests)
  const signature = 'mock-signature'

  return `${header}.${payload}.${signature}`
}

const createMockRefreshJwt = () => {
  // Header: {"alg":"HS256","typ":"JWT"}
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // Payload with exp far in the future (year 2060)
  const payload = btoa(JSON.stringify({ exp: 2863311600 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // Mock signature
  const signature = 'mock-refresh-signature'

  return `${header}.${payload}.${signature}`
}

const createExpiredJwt = () => {
  // Header: {"alg":"HS256","typ":"JWT"}
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // Payload with exp in the past (year 2000)
  const payload = btoa(JSON.stringify({ exp: 946684800 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // Mock signature
  const signature = 'mock-expired-signature'

  return `${header}.${payload}.${signature}`
}

// Export token helpers for tests
export const mockTokens = {
  access: createMockAccessJwt(),
  refresh: createMockRefreshJwt(),
  expired: createExpiredJwt(),
}

// ============================================================================
// Authentication Handlers
// ============================================================================

export const handlers = [
  // Token obtain (login) - handle both relative and absolute URLs
  http.post('/api/token/', async ({ request }) => {
    const body = await request.json() as { username: string; password: string }

    if (body.username === 'testuser' && body.password === 'testpass123') {
      return createJsonResponse({
        access: createMockAccessJwt(),
        refresh: createMockRefreshJwt(),
      })
    }

    if (body.username === 'erroruser') {
      return createErrorResponse('Invalid credentials', 401)
    }

    return createErrorResponse('Invalid username or password', 401)
  }),

  // Also handle absolute URL for tests that don't mock the API_URL
  http.post('http://127.0.0.1:8001/api/token/', async ({ request }) => {
    const body = await request.json() as { username: string; password: string }

    if (body.username === 'testuser' && body.password === 'testpass123') {
      return createJsonResponse({
        access: createMockAccessJwt(),
        refresh: createMockRefreshJwt(),
      })
    }

    return createErrorResponse('Invalid username or password', 401)
  }),

  // Token refresh
  http.post('/api/token/refresh/', async ({ request }) => {
    const body = await request.json() as { refresh: string }

    if (body.refresh === createExpiredJwt()) {
      return createErrorResponse('Token is invalid or expired', 401)
    }

    // Accept mock tokens (with mock-signature), old string format, and JWT format
    if (body.refresh === 'mock-refresh-token' ||
        body.refresh === createMockRefreshJwt() ||
        body.refresh.endsWith('.mock-refresh-signature') ||
        body.refresh.endsWith('.mock-signature') ||
        body.refresh.startsWith('eyJ')) {
      return createJsonResponse({
        access: createMockAccessJwt(),
      })
    }

    return createErrorResponse('Invalid refresh token', 401)
  }),

  http.post('http://127.0.0.1:8001/api/token/refresh/', async ({ request }) => {
    const body = await request.json() as { refresh: string }

    if (body.refresh === 'mock-refresh-token' ||
        body.refresh === createMockRefreshJwt() ||
        body.refresh.endsWith('.mock-refresh-signature') ||
        body.refresh.endsWith('.mock-signature') ||
        body.refresh.startsWith('eyJ')) {
      return createJsonResponse({
        access: createMockAccessJwt(),
      })
    }

    return createErrorResponse('Invalid refresh token', 401)
  }),

  // Current user
  http.get('/api/users/me/', ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse('Authentication credentials were not provided', 401)
    }

    const token = authHeader.split(' ')[1]

    if (token === createExpiredJwt() || token === 'expired-access-token') {
      return createErrorResponse('Given token not valid for any token type', 401)
    }

    // Accept mock access tokens
    if (token === createMockAccessJwt() ||
        token.endsWith('.mock-signature') ||
        token.startsWith('eyJ')) {
      return createJsonResponse({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        first_name: 'Test',
      })
    }

    return createErrorResponse('Invalid token', 401)
  }),

  http.get('http://127.0.0.1:8001/api/users/me/', ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse('Authentication credentials were not provided', 401)
    }

    const token = authHeader.split(' ')[1]

    if (token === createExpiredJwt() || token === 'expired-access-token') {
      return createErrorResponse('Given token not valid for any token type', 401)
    }

    // Accept mock access tokens
    if (token === createMockAccessJwt() ||
        token.endsWith('.mock-signature') ||
        token.startsWith('eyJ')) {
      return createJsonResponse({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        first_name: 'Test',
      })
    }

    return createErrorResponse('Invalid token', 401)
  }),

  // Handle localhost:8000 variant (default API_URL in tests)
  http.get('http://localhost:8000/api/users/me/', ({ request }) => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse('Authentication credentials were not provided', 401)
    }

    const token = authHeader.split(' ')[1]

    if (token === createMockAccessJwt() ||
        token.endsWith('.mock-signature') ||
        token.startsWith('eyJ')) {
      return createJsonResponse({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        first_name: 'Test',
      })
    }

    return createErrorResponse('Invalid token', 401)
  }),

  http.post('http://localhost:8000/api/token/refresh/', async ({ request }) => {
    const body = await request.json() as { refresh: string }

    if (body.refresh === createMockRefreshJwt() ||
        body.refresh.endsWith('.mock-refresh-signature') ||
        body.refresh.endsWith('.mock-signature') ||
        body.refresh.startsWith('eyJ')) {
      return createJsonResponse({ access: createMockAccessJwt() })
    }

    return createErrorResponse('Invalid refresh token', 401)
  }),

  // ============================================================================
  // Room Handlers
  // ============================================================================

  // List rooms
  http.get('/api/rooms/', () => {
    return createJsonResponse([
      {
        id: 1,
        name: 'Conference Room A',
        location: 'Floor 1',
        capacity: 10,
      },
      {
        id: 2,
        name: 'Conference Room B',
        location: 'Floor 1',
        capacity: 15,
      },
      {
        id: 3,
        name: 'Huddle Room',
        location: 'Floor 2',
        capacity: 4,
      },
      {
        id: 4,
        name: 'Main Hall',
        location: 'Ground Floor',
        capacity: 50,
      },
    ])
  }),

  // Retrieve single room
  http.get('/api/rooms/:id/', ({ params }) => {
    const { id } = params

    if (id === '1') {
      return createJsonResponse({
        id: 1,
        name: 'Conference Room A',
        location: 'Floor 1',
        capacity: 10,
      })
    }

    return createErrorResponse('Not found', 404)
  }),

  // ============================================================================
  // Booking Handlers
  // ============================================================================

  // List bookings
  http.get('/api/bookings/', () => {
    return createJsonResponse([
      {
        id: 1,
        room: 1,
        room_name: 'Conference Room A',
        start_time: '2025-01-28T10:00:00+01:00',
        end_time: '2025-01-28T12:00:00+01:00',
        user: 1,
      },
    ])
  }),

  // Create booking
  http.post('/api/bookings/', async ({ request }) => {
    const body = await request.json() as { room: number; start_time: string; end_time: string }

    // Check for office hours violation
    const startTime = new Date(body.start_time)
    const hour = startTime.getHours()

    if (hour < 8 || hour >= 22) {
      return createErrorResponse({
        general: ['Bookings must be within office hours (08:00-22:00).']
      }, 400)
    }

    // Check for duration violation
    const start = new Date(body.start_time)
    const end = new Date(body.end_time)
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60)

    if (durationMinutes < 15) {
      return createErrorResponse({
        general: ['Booking must be at least 15 minutes.']
      }, 400)
    }

    if (durationMinutes > 480) {
      return createErrorResponse({
        general: ['Booking cannot exceed 8 hours.']
      }, 400)
    }

    // Success - return created booking
    return createJsonResponse({
      id: 4,
      room: body.room,
      start_time: body.start_time,
      end_time: body.end_time,
      user: 1,
    }, 201)
  }),

  // Retrieve single booking
  http.get('/api/bookings/:id/', ({ params }) => {
    const { id } = params

    if (id === '1') {
      return createJsonResponse({
        id: 1,
        room: 1,
        start_time: '2025-01-28T10:00:00+01:00',
        end_time: '2025-01-28T12:00:00+01:00',
        user: 1,
      })
    }

    return createErrorResponse('Not found', 404)
  }),

  // Update booking
  http.put('/api/bookings/:id/', async ({ params, request }) => {
    const { id } = params
    const body = await request.json() as { room?: number; start_time?: string; end_time?: string }

    if (id === '1') {
      return createJsonResponse({
        id: 1,
        room: body.room || 1,
        start_time: body.start_time || '2025-01-28T10:00:00+01:00',
        end_time: body.end_time || '2025-01-28T12:00:00+01:00',
        user: 1,
      })
    }

    return createErrorResponse('Not found', 404)
  }),

  // Partial update booking
  http.patch('/api/bookings/:id/', async ({ params, request }) => {
    const { id } = params
    const body = await request.json() as { room?: number; start_time?: string; end_time?: string }

    if (id === '1') {
      return createJsonResponse({
        id: 1,
        room: 1,
        start_time: body.start_time || '2025-01-28T10:00:00+01:00',
        end_time: body.end_time || '2025-01-28T12:00:00+01:00',
        user: 1,
      })
    }

    return createErrorResponse('Not found', 404)
  }),

  // Delete booking
  http.delete('/api/bookings/:id/', ({ params }) => {
    const { id } = params

    if (id === '1') {
      return new HttpResponse(null, { status: 204 })
    }

    return createErrorResponse('Not found', 404)
  }),
]

// ============================================================================
// MSW Server Setup
// ============================================================================

export const server = setupServer(...handlers)
