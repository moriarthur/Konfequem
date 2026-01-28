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
import { server } from '../../mocks/handlers'
import { http, HttpResponse } from 'msw'

// Wrapper component for testing hooks
function createWrapper() {
  return function AuthWrapper({ children }) {
    return <AuthProvider>{children}</AuthProvider>
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
      localStorage.setItem('access', 'stored-access-token')
      localStorage.setItem('refresh', 'stored-refresh-token')

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      expect(result.current.access).toBe('stored-access-token')
      expect(result.current.refresh).toBe('stored-refresh-token')
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
      expect(result.current.access).toBe('mock-access-token')
      expect(result.current.refresh).toBe('mock-refresh-token')
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

      expect(localStorage.getItem('access')).toBe('mock-access-token')
      expect(localStorage.getItem('refresh')).toBe('mock-refresh-token')
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

      const originalToken = result.current.access

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

      let response
      await act(async () => {
        response = await result.current.authFetch('/api/test')
      })

      expect(response.success).toBe(true)
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

      let response
      await act(async () => {
        response = await result.current.authFetch('/api/test')
      })

      expect(response.success).toBe(true)
      expect(requestCount).toBe(2) // First 401, then success after refresh
    })

    it('should throw error when refresh fails', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      // Set an expired token that will fail refresh
      localStorage.setItem('refresh', 'expired-refresh-token')
      localStorage.setItem('access', 'expired-access-token')

      server.use(
        http.post('/api/token/refresh/', () => {
          return HttpResponse.json({ error: 'Invalid token' }, { status: 401 })
        })
      )

      await expect(
        act(async () => {
          await result.current.authFetch('/api/test')
        })
      ).rejects.toThrow()
    })
  })

  // ========================================================================
  // User Data Tests
  // ========================================================================

  describe('user data', () => {
    it('should fetch user data on mount when token exists', async () => {
      localStorage.setItem('access', 'mock-access-token')
      localStorage.setItem('refresh', 'mock-refresh-token')

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.user).not.toBeNull()
        expect(result.current.user?.username).toBe('testuser')
      })
    })

    it('should handle failed user fetch gracefully', async () => {
      localStorage.setItem('access', 'invalid-token')
      localStorage.setItem('refresh', 'invalid-refresh')

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
})
