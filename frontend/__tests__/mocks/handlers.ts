/**
 * MSW (Mock Service Worker) handlers for API mocking.
 * 
 * This module sets up mock responses for all backend API endpoints,
 * allowing tests to run without a real backend server.
 */

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

// Base URL for API requests
const API_URL = '/api'

// ============================================================================
// Helper Functions
// ============================================================================

const createJsonResponse = (data, status = 200) => {
  return HttpResponse.json(data, { status })
}

const createErrorResponse = (message, status = 400) => {
  return HttpResponse.json({ detail: message }, { status })
}

// ============================================================================
// Authentication Handlers
// ============================================================================

export const handlers = [
  // Token obtain (login)
  http.post(`${API_URL}/token/`, async ({ request }) => {
    const body = await request.json()
    
    if (body.username === 'testuser' && body.password === 'testpass123') {
      return createJsonResponse({
        access: 'mock-access-token',
        refresh: 'mock-refresh-token',
      })
    }
    
    if (body.username === 'erroruser') {
      return createErrorResponse('Invalid credentials', 401)
    }
    
    return createErrorResponse('Invalid username or password', 401)
  }),

  // Token refresh
  http.post(`${API_URL}/token/refresh/`, async ({ request }) => {
    const body = await request.json()
    
    if (body.refresh === 'expired-refresh-token') {
      return createErrorResponse('Token is invalid or expired', 401)
    }
    
    if (body.refresh === 'mock-refresh-token') {
      return createJsonResponse({
        access: 'new-mock-access-token',
      })
    }
    
    return createErrorResponse('Invalid refresh token', 401)
  }),

  // Current user
  http.get(`${API_URL}/users/me/`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse('Authentication credentials were not provided', 401)
    }
    
    const token = authHeader.split(' ')[1]
    
    if (token === 'expired-access-token') {
      return createErrorResponse('Given token not valid for any token type', 401)
    }
    
    return createJsonResponse({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      first_name: 'Test',
    })
  }),

  // ============================================================================
  // Room Handlers
  // ============================================================================

  // List rooms
  http.get(`${API_URL}/rooms/`, () => {
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
  http.get(`${API_URL}/rooms/:id/`, ({ params }) => {
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
  http.get(`${API_URL}/bookings/`, ({ request }) => {
    const url = new URL(request.url)
    const roomParam = url.searchParams.get('room')
    const dateParam = url.searchParams.get('date')
    const monthParam = url.searchParams.get('month')
    
    let bookings = [
      {
        id: 1,
        room: 1,
        room_name: 'Conference Room A',
        start_time: '2025-01-28T10:00:00+01:00',
        end_time: '2025-01-28T12:00:00+01:00',
        user: 1,
      },
      {
        id: 2,
        room: 1,
        room_name: 'Conference Room A',
        start_time: '2025-01-28T14:00:00+01:00',
        end_time: '2025-01-28T16:00:00+01:00',
        user: 1,
      },
      {
        id: 3,
        room: 2,
        room_name: 'Conference Room B',
        start_time: '2025-01-28T09:00:00+01:00',
        end_time: '2025-01-28T11:00:00+01:00',
        user: 1,
      },
    ]
    
    // Filter by room
    if (roomParam) {
      bookings = bookings.filter(b => b.room === parseInt(roomParam))
    }
    
    // Filter by date
    if (dateParam) {
      bookings = bookings.filter(b => b.start_time.startsWith(dateParam))
    }
    
    // Filter by month
    if (monthParam) {
      const [year, month] = monthParam.split('-').map(Number)
      bookings = bookings.filter(b => {
        const date = new Date(b.start_time)
        return date.getFullYear() === year && date.getMonth() + 1 === month
      })
    }
    
    return createJsonResponse(bookings)
  }),

  // Create booking
  http.post(`${API_URL}/bookings/`, async ({ request }) => {
    const body = await request.json()
    
    // Check for overlapping bookings
    if (body.room === 1 && body.start_time === '2025-01-28T10:00:00+01:00') {
      return createErrorResponse({
        general: ['This room is already booked for the selected time range.']
      }, 400)
    }
    
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
    const durationMinutes = (end - start) / (1000 * 60)
    
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
      room_name: 'Conference Room A',
      start_time: body.start_time,
      end_time: body.end_time,
      user: 1,
    }, 201)
  }),

  // Retrieve single booking
  http.get(`${API_URL}/bookings/:id/`, ({ params }) => {
    const { id } = params
    
    if (id === '1') {
      return createJsonResponse({
        id: 1,
        room: 1,
        room_name: 'Conference Room A',
        start_time: '2025-01-28T10:00:00+01:00',
        end_time: '2025-01-28T12:00:00+01:00',
        user: 1,
      })
    }
    
    return createErrorResponse('Not found', 404)
  }),

  // Update booking
  http.put(`${API_URL}/bookings/:id/`, async ({ params, request }) => {
    const { id } = params
    const body = await request.json()
    
    if (id === '1') {
      return createJsonResponse({
        id: 1,
        room: body.room || 1,
        room_name: 'Conference Room A',
        start_time: body.start_time || '2025-01-28T10:00:00+01:00',
        end_time: body.end_time || '2025-01-28T12:00:00+01:00',
        user: 1,
      })
    }
    
    return createErrorResponse('Not found', 404)
  }),

  // Partial update booking
  http.patch(`${API_URL}/bookings/:id/`, async ({ params, request }) => {
    const { id } = params
    const body = await request.json()
    
    if (id === '1') {
      return createJsonResponse({
        id: 1,
        room: 1,
        room_name: 'Conference Room A',
        start_time: body.start_time || '2025-01-28T10:00:00+01:00',
        end_time: body.end_time || '2025-01-28T12:00:00+01:00',
        user: 1,
      })
    }
    
    return createErrorResponse('Not found', 404)
  }),

  // Delete booking
  http.delete(`${API_URL}/bookings/:id/`, ({ params }) => {
    const { id } = params
    
    if (id === '1') {
      return new HttpResponse(null, { status: 204 })
    }
    
    return createErrorResponse('Not found', 404)
  }),

  // ============================================================================
  // Error Handlers
  // ============================================================================

  // Network error simulation
  http.get(`${API_URL}/network-error`, () => {
    return HttpResponse.error()
  }),

  // Server error simulation
  http.get(`${API_URL}/server-error`, () => {
    return createErrorResponse('Internal server error', 500)
  }),
]

// ============================================================================
// MSW Server Setup
// ============================================================================

export const server = setupServer(...handlers)
