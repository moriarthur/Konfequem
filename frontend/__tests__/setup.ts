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
import { afterEach, vi, beforeAll, afterEach as afterEachHook } from 'vitest'
import { server } from './mocks/handlers'

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
afterEachHook(() => server.resetHandlers())

// Close server after all tests
afterEachHook(() => server.close())

// ============================================================================
// localStorage mock
// ============================================================================

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Clear localStorage before each test
beforeEach(() => {
  localStorageMock.getItem.mockClear()
  localStorageMock.setItem.mockClear()
  localStorageMock.removeItem.mockClear()
  localStorageMock.clear.mockClear()
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
