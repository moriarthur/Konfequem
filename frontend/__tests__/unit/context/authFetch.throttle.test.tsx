/**
 * Tests for authFetch 429 handling and concurrent refresh dedupe.
 *
 * Regression background:
 * - 429 responses were thrown as plain errors and swallowed by pages,
 *   rendering empty lists with no feedback.
 * - The refresh dedupe stored the raw Response: on concurrent 401s both
 *   the initiator and the waiter called res.json() on the same object,
 *   so the second read threw and surfaced as Unauthorized.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor, screen } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { AlertProvider } from '@/context/AlertContext'
import { server } from '../../mocks/handlers'
import { http, HttpResponse } from 'msw'

// Valid-looking JWTs (exp far in the future) — see mocks/handlers.ts
const mockJwt = (signature: string) => {
  const part = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '/').replace(/=+$/, '')
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ exp: 2863311600 })}.${signature}`
}

const seedTokens = () => {
  localStorage.setItem('access', mockJwt('mock-access'))
  localStorage.setItem('refresh', mockJwt('mock-refresh'))
}

function createWrapper() {
  return function AuthWrapper({ children }: { children: React.ReactNode }) {
    return (
      <AlertProvider>
        <AuthProvider>{children}</AuthProvider>
      </AlertProvider>
    )
  }
}

const renderAuth = async () => {
  const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() })
  await waitFor(() => {
    expect(result.current.isAuthenticated).toBe(true)
  })
  return result
}

describe('authFetch throttling and refresh dedupe', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    server.resetHandlers()
  })

  it('shows a warning toast with wait time and throws a typed error on 429', async () => {
    seedTokens()
    server.use(
      http.get('/api/rooms/', () =>
        HttpResponse.json(
          { detail: 'Request was throttled. Expected available in 42 seconds.' },
          { status: 429, headers: { 'Retry-After': '42' } }
        )
      )
    )
    const result = await renderAuth()

    let caught: unknown
    await act(async () => {
      await result.current.authFetch('/api/rooms/').catch((e) => {
        caught = e
      })
    })

    expect(caught).toMatchObject({ status: 429, retryAfter: 42 })
    expect(await screen.findByText(/try again in 42s/i)).toBeTruthy()
    // Tokens untouched — a throttle is transient, not an auth failure
    expect(localStorage.getItem('access')).toBeTruthy()
    expect(localStorage.getItem('refresh')).toBeTruthy()
  })

  it('dedupes the throttle toast when several parallel requests all 429', async () => {
    seedTokens()
    server.use(
      http.get('/api/rooms/', () =>
        HttpResponse.json({ detail: 'throttled' }, { status: 429, headers: { 'Retry-After': '30' } })
      ),
      http.get('/api/room-features/', () =>
        HttpResponse.json({ detail: 'throttled' }, { status: 429, headers: { 'Retry-After': '30' } })
      ),
      http.get('/api/bookings/', () =>
        HttpResponse.json({ detail: 'throttled' }, { status: 429, headers: { 'Retry-After': '30' } })
      )
    )
    const result = await renderAuth()

    await act(async () => {
      await Promise.allSettled([
        result.current.authFetch('/api/rooms/'),
        result.current.authFetch('/api/room-features/'),
        result.current.authFetch('/api/bookings/'),
      ])
    })

    const toasts = await screen.findAllByText(/try again in 30s/i)
    expect(toasts).toHaveLength(1)
  })

  it('triggers exactly one refresh POST for concurrent 401s and retries both', async () => {
    seedTokens()
    let refreshCalls = 0
    let roomsCalls = 0
    let bookingsCalls = 0
    server.use(
      http.post('/api/token/refresh/', () => {
        refreshCalls++
        return HttpResponse.json({ access: mockJwt('rotated-access'), refresh: mockJwt('rotated-refresh') })
      }),
      http.get('/api/rooms/', () => {
        roomsCalls++
        if (roomsCalls === 1) return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
        return HttpResponse.json({ results: [] })
      }),
      http.get('/api/bookings/', () => {
        bookingsCalls++
        if (bookingsCalls === 1) return HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
        return HttpResponse.json({ results: [] })
      })
    )
    const result = await renderAuth()

    let rooms: unknown
    let bookings: unknown
    await act(async () => {
      ;[rooms, bookings] = await Promise.all([
        result.current.authFetch('/api/rooms/'),
        result.current.authFetch('/api/bookings/'),
      ])
    })

    // Both callers share the single refresh result and succeed on retry
    expect(rooms).toEqual({ results: [] })
    expect(bookings).toEqual({ results: [] })
    expect(refreshCalls).toBe(1)
    expect(roomsCalls).toBe(2)
    expect(bookingsCalls).toBe(2)
  })

  it('does not log out when the refresh endpoint itself is throttled', async () => {
    seedTokens()
    server.use(
      http.post('/api/token/refresh/', () =>
        HttpResponse.json(
          { detail: 'Request was throttled.' },
          { status: 429, headers: { 'Retry-After': '10' } }
        )
      ),
      http.get('/api/rooms/', () =>
        HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
      )
    )
    const result = await renderAuth()

    await act(async () => {
      await result.current.authFetch('/api/rooms/').catch(() => {
        // expected rejection
      })
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(localStorage.getItem('access')).toBeTruthy()
    expect(localStorage.getItem('refresh')).toBeTruthy()
  })
})
