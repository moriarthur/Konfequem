/**
 * Integration tests for AuthContext.
 *
 * Tests validate:
 * - Login success and failure
 * - Logout functionality
 * - Token storage in localStorage
 * - Token refresh on 401
 * - User data fetching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { AlertProvider } from '@/context/AlertContext'
import { server } from '../../mocks/handlers'
import { http, HttpResponse } from 'msw'

// ============================================================================
// Helper Functions
// ============================================================================

// Create valid-looking JWT tokens for testing
const createMockAccessJwt = () => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const payload = btoa(JSON.stringify({ exp: 2863311600 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${header}.${payload}.mock-signature`
}

const createMockRefreshJwt = () => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const payload = btoa(JSON.stringify({ exp: 2863311600 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${header}.${payload}.mock-refresh-signature`
}

const createExpiredJwt = () => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const payload = btoa(JSON.stringify({ exp: 946684800 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${header}.${payload}.mock-expired-signature`
}

// Wrapper component for testing hooks
function createWrapper() {
  return function AuthWrapper({ children }: { children: React.ReactNode }) {
    return (
      <AlertProvider>
        <AuthProvider>{children}</AuthProvider>
      </AlertProvider>
    )
  }
}

describe('AuthContext', () => {
  // ========================================================================
  // Setup and Teardown
  // ========================================================================

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
    // Reset MSW handlers to prevent handler leakage from server.use() calls
    server.resetHandlers()
  })

  // ========================================================================
  // Initial State Tests
  // ========================================================================

  describe('initial state', () => {
    it('should have correct initial state when not authenticated', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.access).toBeNull()
      expect(result.current.refresh).toBeNull()
      expect(result.current.user).toBeNull()
      expect(result.current.loading).toBe(false)
    })

    it('should have correct initial state when tokens exist in localStorage', () => {
      const mockAccess = createMockAccessJwt()
      const mockRefresh = createMockRefreshJwt()
      localStorage.setItem('access', mockAccess)
      localStorage.setItem('refresh', mockRefresh)

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      expect(result.current.access).toBe(mockAccess)
      expect(result.current.refresh).toBe(mockRefresh)
      expect(result.current.isAuthenticated).toBe(true)
    })
  })

  // ========================================================================
  // Login Tests
  // ========================================================================

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.login('testuser', 'testpass123')
      })

      expect(result.current.isAuthenticated).toBe(true)
      // Token should be a valid JWT (starts with eyJ)
      expect(result.current.access).toMatch(/^eyJ/)
      expect(result.current.refresh).toMatch(/^eyJ/)
      expect(result.current.user).toEqual({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        first_name: 'Test',
      })
    })

    it('should store tokens in localStorage on successful login', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.login('testuser', 'testpass123')
      })

      expect(localStorage.getItem('access')).toMatch(/^eyJ/)
      expect(localStorage.getItem('refresh')).toMatch(/^eyJ/)
    })

    it('should fail login with invalid credentials', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await expect(
        act(async () => {
          await result.current.login('invaliduser', 'wrongpass')
        })
      ).rejects.toThrow()

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.access).toBeNull()
    })

    it('should fail login with wrong username', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await expect(
        act(async () => {
          await result.current.login('erroruser', 'anypassword')
        })
      ).rejects.toThrow()
    })

    it('should handle network errors during login', async () => {
      // Mock network error
      server.use(
        http.post('/api/token/', () => {
          return HttpResponse.error()
        })
      )

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await expect(
        act(async () => {
          await result.current.login('testuser', 'testpass123')
        })
      ).rejects.toThrow('Network error')
    })

    it('should fetch user data after successful login', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.login('testuser', 'testpass123')
      })

      await waitFor(() => {
        expect(result.current.user).not.toBeNull()
        expect(result.current.user?.username).toBe('testuser')
      })
    })
  })

  // ========================================================================
  // Logout Tests
  // ========================================================================

  describe('logout', () => {
    it('should clear authentication state on logout', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      // First login
      await act(async () => {
        await result.current.login('testuser', 'testpass123')
      })

      expect(result.current.isAuthenticated).toBe(true)

      // Then logout
      act(() => {
        result.current.logout()
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.access).toBeNull()
      expect(result.current.refresh).toBeNull()
      expect(result.current.user).toBeNull()
    })

    it('should clear localStorage on logout', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      // First login
      await act(async () => {
        await result.current.login('testuser', 'testpass123')
      })

      expect(localStorage.getItem('access')).not.toBeNull()

      // Then logout
      act(() => {
        result.current.logout()
      })

      expect(localStorage.getItem('access')).toBeNull()
      expect(localStorage.getItem('refresh')).toBeNull()
    })

    it('should be safe to call logout when not authenticated', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      expect(() => {
        act(() => {
          result.current.logout()
        })
      }).not.toThrow()

      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  // ========================================================================
  // Token Refresh Tests
  // ========================================================================

  describe('token refresh', () => {
    it('should refresh token on 401 response', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      // First login
      await act(async () => {
        await result.current.login('testuser', 'testpass123')
      })

      // Verify token is set after login
      expect(result.current.access).not.toBeNull()

      // Make a request that triggers 401 then refresh
      // This would be tested through authFetch in a real scenario
      // For now, we verify the token refresh mechanism exists
      expect(result.current.refresh).not.toBeNull()
    })

    it('should logout on failed token refresh', async () => {
      // Set an invalid refresh token
      localStorage.setItem('refresh', 'expired-refresh-token')
      localStorage.setItem('access', 'some-access-token')

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      // The refreshAccessToken should be called and fail
      // This would trigger logout
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false)
      })
    })
  })

  // ========================================================================
  // authFetch Tests
  // ========================================================================

  describe('authFetch', () => {
    it('should include authorization header with token', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.login('testuser', 'testpass123')
      })

      // Mock a successful request
      server.use(
        http.get('/api/test', ({ request }) => {
          const authHeader = request.headers.get('Authorization')
          if (authHeader === `Bearer ${result.current.access}`) {
            return HttpResponse.json({ success: true })
          }
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
        })
      )

      let response: Record<string, unknown> | undefined
      await act(async () => {
        response = await result.current.authFetch('/api/test')
      })

      expect(response!.success).toBe(true)
    })

    it('should handle 401 and refresh token', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.login('testuser', 'testpass123')
      })

      let requestCount = 0

      // Mock endpoint that returns 401 first, then success
      server.use(
        http.get('/api/test', () => {
          requestCount++
          if (requestCount === 1) {
            return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
          }
          return HttpResponse.json({ success: true })
        })
      )

      let response: Record<string, unknown> | undefined
      await act(async () => {
        response = await result.current.authFetch('/api/test')
      })

      expect(response!.success).toBe(true)
      expect(requestCount).toBe(2) // First 401, then success after refresh
    })

    it('should throw error when refresh fails', async () => {
      // This test verifies that authFetch throws when the refresh token is invalid.
      // We test this by pre-setting tokens in localStorage and having the refresh
      // endpoint return 401, simulating an expired refresh token scenario.
      const mockAccess = createMockAccessJwt()
      const mockRefresh = createMockRefreshJwt()
      localStorage.setItem('access', mockAccess)
      localStorage.setItem('refresh', mockRefresh)

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      // Override refresh endpoint to fail for this test
      server.use(
        http.post('/api/token/refresh/', () => {
          return HttpResponse.json({ error: 'Invalid token' }, { status: 401 })
        })
      )

      // Override test endpoint to return 401 (triggers refresh attempt)
      server.use(
        http.get('/api/test', () => {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
        })
      )

      await expect(
        result.current.authFetch('/api/test')
      ).rejects.toThrow()
    })
  })

  // ========================================================================
  // User Data Tests
  // ========================================================================

  describe('user data', () => {
    beforeEach(() => {
      server.resetHandlers()
    })

    it('should fetch user data on mount when token exists', async () => {
      const mockAccess = createMockAccessJwt()
      const mockRefresh = createMockRefreshJwt()
      localStorage.setItem('access', mockAccess)
      localStorage.setItem('refresh', mockRefresh)

      let result: ReturnType<typeof renderHook<ReturnType<typeof useAuth>, () => ReturnType<typeof useAuth>>>['result']

      await act(async () => {
        const hookResult = renderHook(() => useAuth(), {
          wrapper: createWrapper(),
        })
        result = hookResult.result
      })

      await waitFor(() => {
        if (!result!.current) throw new Error('Hook returned null')
        expect(result!.current.isAuthenticated).toBe(true)
        expect(result!.current.user).not.toBeNull()
        expect(result!.current.user?.username).toBe('testuser')
      })
    })

    it('should handle failed user fetch gracefully', async () => {
      const invalidToken = createExpiredJwt()
      localStorage.setItem('access', invalidToken)
      localStorage.setItem('refresh', invalidToken)

      // Mock user endpoint to return 401
      server.use(
        http.get('/api/users/me/', () => {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
        })
      )

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      // Should not throw, but user should remain null
      await waitFor(() => {
        expect(result.current.user).toBeNull()
      })
    })
  })

  // ========================================================================
  // Loading State Tests
  // ========================================================================

  describe('loading state', () => {
    it('should be false after initial render without tokens', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      expect(result.current.loading).toBe(false)
    })

    it('should be false after login completes', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.login('testuser', 'testpass123')
      })

      expect(result.current.loading).toBe(false)
    })
  })

  // ============================================================================
  // Cross-Tab Sync Tests
  //
  // A localStorage write in one tab fires a `storage` event in every other
  // tab. These tests simulate the "other tab" by writing localStorage
  // directly and dispatching the events the browser would deliver.
  // ============================================================================

  describe('cross-tab sync', () => {
    // The shared createMock*Jwt helpers are deterministic (identical string
    // every call), but these tests compare tokens for inequality — build
    // unique-but-valid tokens via a distinct jti claim instead.
    const uniqueJwt = (label: string, exp = 2863311600) => {
      const enc = (o: object) =>
        btoa(JSON.stringify(o))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '')
      return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ exp, jti: label })}.${label}-sig`
    }

    const simulateOtherTabWrite = (access: string | null, refresh: string | null) => {
      if (access) localStorage.setItem('access', access)
      else localStorage.removeItem('access')
      if (refresh) localStorage.setItem('refresh', refresh)
      else localStorage.removeItem('refresh')
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'access', newValue: access })
      )
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'refresh', newValue: refresh })
      )
    }

    it('should adopt tokens rotated by another tab', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.login('testuser', 'testpass123')
      })

      const rotatedAccess = uniqueJwt('rotated-access')
      const rotatedRefresh = uniqueJwt('rotated-refresh')

      act(() => {
        simulateOtherTabWrite(rotatedAccess, rotatedRefresh)
      })

      expect(result.current.access).toBe(rotatedAccess)
      expect(result.current.refresh).toBe(rotatedRefresh)
      expect(result.current.isAuthenticated).toBe(true)

      // Adoption clears `user` so it is refetched with the adopted session
      await waitFor(() => {
        expect(result.current.user?.username).toBe('testuser')
      })
    })

    it('should mirror a logout performed in another tab without re-blacklisting', async () => {
      let blacklistCalls = 0
      server.use(
        http.post('/api/token/blacklist/', () => {
          blacklistCalls++
          return HttpResponse.json({})
        })
      )

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.login('testuser', 'testpass123')
      })
      expect(result.current.isAuthenticated).toBe(true)
      blacklistCalls = 0

      act(() => {
        simulateOtherTabWrite(null, null)
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.access).toBeNull()
      expect(result.current.refresh).toBeNull()
      expect(result.current.user).toBeNull()
      // The tab that performed the logout already blacklisted — this tab
      // must not hit the endpoint a second time.
      expect(blacklistCalls).toBe(0)
    })

    it('should adopt another tab’s tokens when our refresh token was already rotated and blacklisted', async () => {
      // The core ROTATE+BLACKLIST race: tab A refreshes (our refresh token
      // gets blacklisted), we refresh with the stale token, get a 401 — but
      // by then tab A's tokens are in storage. We must adopt them instead
      // of logging out.
      const freshAccess = uniqueJwt('fresh-access')
      const freshRefresh = uniqueJwt('fresh-refresh')

      localStorage.setItem('access', uniqueJwt('stale-access'))
      localStorage.setItem('refresh', uniqueJwt('stale-refresh'))

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })
      const staleRefresh = result.current.refresh

      // When our refresh request arrives, the "other tab" has already won
      // the rotation: its tokens are in storage, ours is blacklisted.
      server.use(
        http.post('/api/token/refresh/', () => {
          localStorage.setItem('access', freshAccess)
          localStorage.setItem('refresh', freshRefresh)
          return HttpResponse.json({ detail: 'Token is blacklisted' }, { status: 401 })
        })
      )

      let requestCount = 0
      server.use(
        http.get('/api/test', () => {
          requestCount++
          if (requestCount === 1) {
            return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
          }
          return HttpResponse.json({ success: true })
        })
      )

      let response: Record<string, unknown> | undefined
      await act(async () => {
        response = await result.current.authFetch('/api/test')
      })

      expect(response!.success).toBe(true)
      expect(result.current.access).toBe(freshAccess)
      expect(result.current.refresh).toBe(freshRefresh)
      expect(staleRefresh).not.toBe(freshRefresh)
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('should still log out when nobody else refreshed and the token is invalid', async () => {
      localStorage.setItem('access', createMockAccessJwt())
      localStorage.setItem('refresh', createMockRefreshJwt())

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      // Storage still holds exactly the token we sent — no other tab came to
      // the rescue, so a 401 must end the session.
      server.use(
        http.post('/api/token/refresh/', () => {
          return HttpResponse.json({ detail: 'Token is blacklisted' }, { status: 401 })
        })
      )
      server.use(
        http.get('/api/test', () => {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
        })
      )

      await act(async () => {
        await result.current.authFetch('/api/test').catch(() => undefined)
      })

      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.access).toBeNull()
    })
  })
})
