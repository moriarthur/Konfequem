import { describe, it, expect, vi, beforeEach } from 'vitest'
import ErrorHandler from '@/utils/errorHandler'

describe('ErrorHandler.parse', () => {
  it('returns default message for null', () => {
    expect(ErrorHandler.parse(null)).toBe('An unknown error occurred.')
  })

  it('returns default message for undefined', () => {
    expect(ErrorHandler.parse(undefined)).toBe('An unknown error occurred.')
  })

  it('returns the string as-is for string errors', () => {
    expect(ErrorHandler.parse('Something went wrong')).toBe('Something went wrong')
  })

  it('returns mapped message for known status codes', () => {
    expect(ErrorHandler.parse({ status: 400 })).toBe('Invalid request. Please check your input and try again.')
    expect(ErrorHandler.parse({ status: 401 })).toBe('Your session has expired. Please log in again.')
    expect(ErrorHandler.parse({ status: 403 })).toBe("You don't have permission to perform this action.")
    expect(ErrorHandler.parse({ status: 404 })).toBe('The requested resource was not found.')
    expect(ErrorHandler.parse({ status: 409 })).toContain('just booked')
    expect(ErrorHandler.parse({ status: 500 })).toBe('Server error. Please try again later.')
  })

  it('returns generic message for unknown status codes', () => {
    expect(ErrorHandler.parse({ status: 418 })).toBe('Error (418): Please try again.')
  })

  it('detects network errors from message', () => {
    expect(ErrorHandler.parse({ message: 'Network error' })).toBe(
      'Network error. Please check your connection and try again.'
    )
  })

  it('detects timeout errors from message', () => {
    expect(ErrorHandler.parse({ message: 'Request timeout' })).toBe('Request timed out. Please try again.')
  })

  it('detects abort errors from message', () => {
    expect(ErrorHandler.parse({ message: 'Request was aborted' })).toBe('Request was cancelled. Please try again.')
  })

  it('returns message directly for other errors with message', () => {
    expect(ErrorHandler.parse({ message: 'Custom error message' })).toBe('Custom error message')
  })

  it('handles general field as array', () => {
    expect(ErrorHandler.parse({ general: ['Error 1', 'Error 2'] })).toBe('Error 1. Error 2')
  })

  it('handles general field as string', () => {
    expect(ErrorHandler.parse({ general: 'Single error' })).toBe('Single error')
  })

  it('handles detail field', () => {
    expect(ErrorHandler.parse({ detail: 'Detailed error' })).toBe('Detailed error')
  })

  it('handles non_field_errors as array', () => {
    expect(ErrorHandler.parse({ non_field_errors: ['Field error 1', 'Field error 2'] })).toBe(
      'Field error 1. Field error 2'
    )
  })

  it('returns fallback message for unrecognized errors', () => {
    expect(ErrorHandler.parse({ foo: 'bar' })).toBe('An unexpected error occurred. Please try again.')
  })
})

describe('ErrorHandler.handle', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns ParsedError with message and status', () => {
    const result = ErrorHandler.handle({ status: 404, message: 'Not found' })
    expect(result.message).toBe('The requested resource was not found.')
    expect(result.userFriendly).toBe(true)
    expect(result.status).toBe(404)
  })

  it('returns unknown status when no status in error', () => {
    const result = ErrorHandler.handle({ message: 'Something' })
    expect(result.status).toBe('unknown')
  })

  it('includes context in log output', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ErrorHandler.handle({ message: 'test' }, 'booking')
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe('ErrorHandler.create', () => {
  it('creates an AppError with correct properties', () => {
    const error = ErrorHandler.create('Test error', 400, { field: 'value' })
    expect(error.message).toBe('Test error')
    expect(error.status).toBe(400)
    expect(error.details).toEqual({ field: 'value' })
    expect(error.userFriendly).toBe(true)
    expect(error).toBeInstanceOf(Error)
  })

  it('defaults status to 500', () => {
    const error = ErrorHandler.create('Error')
    expect(error.status).toBe(500)
  })
})

describe('ErrorHandler.isRecoverable', () => {
  it('returns true for 409 Conflict', () => {
    expect(ErrorHandler.isRecoverable({ status: 409 })).toBe(true)
  })

  it('returns true for 429 Too Many Requests', () => {
    expect(ErrorHandler.isRecoverable({ status: 429 })).toBe(true)
  })

  it('returns true for 500-level errors (except 501)', () => {
    expect(ErrorHandler.isRecoverable({ status: 500 })).toBe(true)
    expect(ErrorHandler.isRecoverable({ status: 502 })).toBe(true)
    expect(ErrorHandler.isRecoverable({ status: 503 })).toBe(true)
  })

  it('returns false for 501', () => {
    expect(ErrorHandler.isRecoverable({ status: 501 })).toBe(false)
  })

  it('returns false for 4xx errors', () => {
    expect(ErrorHandler.isRecoverable({ status: 400 })).toBe(false)
    expect(ErrorHandler.isRecoverable({ status: 401 })).toBe(false)
    expect(ErrorHandler.isRecoverable({ status: 404 })).toBe(false)
  })

  it('returns false for null/undefined', () => {
    expect(ErrorHandler.isRecoverable(null)).toBe(false)
    expect(ErrorHandler.isRecoverable(undefined)).toBe(false)
  })
})

describe('ErrorHandler.shouldLogout', () => {
  it('returns true for 401', () => {
    expect(ErrorHandler.shouldLogout({ status: 401 })).toBe(true)
  })

  it('returns true for 403', () => {
    expect(ErrorHandler.shouldLogout({ status: 403 })).toBe(true)
  })

  it('returns false for other status codes', () => {
    expect(ErrorHandler.shouldLogout({ status: 400 })).toBe(false)
    expect(ErrorHandler.shouldLogout({ status: 500 })).toBe(false)
  })

  it('returns false for null', () => {
    expect(ErrorHandler.shouldLogout(null)).toBe(false)
  })
})

describe('ErrorHandler.withErrorHandling', () => {
  it('returns the result on success', async () => {
    const result = await ErrorHandler.withErrorHandling(async () => 42)
    expect(result).toBe(42)
  })

  it('wraps errors in AppError', async () => {
    await expect(
      ErrorHandler.withErrorHandling(async () => {
        throw { status: 500, message: 'Server error' }
      })
    ).rejects.toThrow('Server error. Please try again later.')
  })
})
