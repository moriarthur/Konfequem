/**
 * Global test setup file for Vitest.
 *
 * This file runs before each test file and configures:
 * - Global test cleanup
 * - MSW (Mock Service Worker) for API mocking
 * - localStorage mock
 * - IntersectionObserver mock
 * - Testing library globals
 */

import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { server } from './mocks/handlers'

// ============================================================================
// Mock modules
// ============================================================================

// Mock authConfig to return empty API_URL for MSW to intercept requests
// This must be done before any imports that use the config
vi.mock('../src/context/authConfig.js', () => ({
  API_URL: '',
  default: { API_URL: '' },
}))

// ============================================================================
// Cleanup after each test
// ============================================================================

afterEach(() => {
  cleanup()
})

// ============================================================================
// MSW (Mock Service Worker) setup
// ============================================================================

// Establish API mocking before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Reset handlers after each test
afterEach(() => server.resetHandlers())

// Close server after ALL tests (not after each test)
afterAll(() => server.close())

// ============================================================================
// localStorage mock - implements actual storage
// ============================================================================

const localStorageMock = (function () {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => {
      const keys = Object.keys(store)
      return keys[index] ?? null
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Clear localStorage before each test
beforeEach(() => {
  localStorage.clear()
})

// ============================================================================
// IntersectionObserver mock
// ============================================================================

class IntersectionObserverMock {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
})

// ============================================================================
// ResizeObserver mock
// ============================================================================

class ResizeObserverMock {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: ResizeObserverMock,
})

// ============================================================================
// MediaQuery mock
// ============================================================================

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// ============================================================================
// Global test utilities
// ============================================================================

// Helper to create a mock user
export const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  first_name: 'Test',
}

// Helper to create mock tokens
export const mockTokens = {
  access: 'mock-access-token',
  refresh: 'mock-refresh-token',
}

// Helper to create mock room
export const mockRoom = {
  id: 1,
  name: 'Conference Room A',
  location: 'Floor 1',
  capacity: 10,
}

// Helper to create mock booking
export const mockBooking = {
  id: 1,
  room: 1,
  room_name: 'Conference Room A',
  start_time: '2025-01-28T10:00:00+01:00',
  end_time: '2025-01-28T12:00:00+01:00',
  user: 1,
}
