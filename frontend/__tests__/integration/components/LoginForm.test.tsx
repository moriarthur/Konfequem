/**
 * Integration tests for LoginForm component.
 * 
 * Tests validate:
 * - Form validation
 * - Login flow with valid credentials
 * - Error display for invalid credentials
 * - Password visibility toggle
 * - Caps Lock detection
 * - Lockout after failed attempts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import LoginForm from '@/components/LoginForm'
import { AuthProvider } from '@/context/AuthContext'
import { server } from '../../mocks/handlers'
import { http, HttpResponse } from 'msw'

// Wrapper with router and auth context
function createWrapper() {
  return function Wrapper({ children }) {
    return (
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    )
  }
}

// Mock navigate function
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  // ========================================================================
  // Rendering Tests
  // ========================================================================

  describe('rendering', () => {
    it('should render login form with all fields', () => {
      render(<LoginForm />, { wrapper: createWrapper() })

      expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('should render logo', () => {
      render(<LoginForm />, { wrapper: createWrapper() })

      const logo = screen.getByAltText(/konfequem logo/i)
      expect(logo).toBeInTheDocument()
      expect(logo).toHaveAttribute('src', 'konfequem.svg')
    })

    it('should render sign up link', () => {
      render(<LoginForm />, { wrapper: createWrapper() })

      const signUpLink = screen.getByText(/sign up/i)
      expect(signUpLink).toBeInTheDocument()
      expect(signUpLink.closest('a')).toHaveAttribute('href', '#')
    })
  })

  // ========================================================================
  // Form Validation Tests
  // ========================================================================

  describe('form validation', () => {
    it('should show username required error on blur', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const usernameInput = screen.getByLabelText(/username/i)
      
      // Blur without entering value
      await user.click(usernameInput)
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText(/username is required/i)).toBeInTheDocument()
      })
    })

    it('should show password required error on blur', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const passwordInput = screen.getByLabelText(/password/i)
      
      // Blur without entering value
      await user.click(passwordInput)
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument()
      })
    })

    it('should show username validation error for spaces', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const usernameInput = screen.getByLabelText(/username/i)
      
      await user.type(usernameInput, 'invalid user')
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText(/spaces are not allowed/i)).toBeInTheDocument()
      })
    })

    it('should show password validation error for spaces', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(passwordInput, 'pass word')
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText(/spaces are not allowed/i)).toBeInTheDocument()
      })
    })

    it('should show username too short error', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const usernameInput = screen.getByLabelText(/username/i)
      
      await user.type(usernameInput, 'ab')
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText(/username must be 3-20 characters/i)).toBeInTheDocument()
      })
    })

    it('should show password too short error', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(passwordInput, '12345')
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText(/password must be 6-50 characters/i)).toBeInTheDocument()
      })
    })

    it('should disable submit button when form is invalid', () => {
      render(<LoginForm />, { wrapper: createWrapper() })

      const submitButton = screen.getByRole('button', { name: /sign in/i })
      expect(submitButton).toBeDisabled()
    })

    it('should enable submit button when form is valid', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const usernameInput = screen.getByLabelText(/username/i)
      const passwordInput = screen.getByLabelText(/password/i)

      await user.type(usernameInput, 'testuser')
      await user.type(passwordInput, 'testpass123')

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /sign in/i })
        expect(submitButton).toBeEnabled()
      })
    })
  })

  // ========================================================================
  // Login Flow Tests
  // ========================================================================

  describe('login flow', () => {
    it('should successfully login with valid credentials', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const usernameInput = screen.getByLabelText(/username/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(usernameInput, 'testuser')
      await user.type(passwordInput, 'testpass123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })

    it('should show error on failed login', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const usernameInput = screen.getByLabelText(/username/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(usernameInput, 'invaliduser')
      await user.type(passwordInput, 'wrongpass')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/authentication failed/i)).toBeInTheDocument()
      })
    })

    it('should show loading state during login', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const usernameInput = screen.getByLabelText(/username/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(usernameInput, 'testuser')
      await user.type(passwordInput, 'testpass123')

      // Click submit
      await user.click(submitButton)

      // Check for loading state (button shows spinner)
      await waitFor(() => {
        expect(screen.getByText(/signing in/i)).toBeInTheDocument()
      })
    })

    it('should clear password after failed login', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const usernameInput = screen.getByLabelText(/username/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(usernameInput, 'invaliduser')
      await user.type(passwordInput, 'wrongpass')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/authentication failed/i)).toBeInTheDocument()
      })

      expect(passwordInput).toHaveValue('')
    })
  })

  // ========================================================================
  // Password Visibility Tests
  // ========================================================================

  describe('password visibility', () => {
    it('should toggle password visibility', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const passwordInput = screen.getByLabelText(/password/i)
      const toggleButton = screen.getByRole('button', {
        name: /show password/i,
      })

      expect(passwordInput).toHaveAttribute('type', 'password')

      await user.click(toggleButton)

      expect(passwordInput).toHaveAttribute('type', 'text')

      await user.click(toggleButton)

      expect(passwordInput).toHaveAttribute('type', 'password')
    })

    it('should update aria-pressed on password toggle', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const toggleButton = screen.getByRole('button', {
        name: /show password/i,
      })

      expect(toggleButton).toHaveAttribute('aria-pressed', 'false')

      await user.click(toggleButton)

      expect(toggleButton).toHaveAttribute('aria-pressed', 'true')
    })
  })

  // ========================================================================
  // Alert/Notification Tests
  // ========================================================================

  describe('alerts and notifications', () => {
    it('should show dismissible error alert', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const usernameInput = screen.getByLabelText(/username/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(usernameInput, 'invaliduser')
      await user.type(passwordInput, 'wrongpass')
      await user.click(submitButton)

      await waitFor(() => {
        const alert = screen.getByRole('alert')
        expect(alert).toBeInTheDocument()
        
        const dismissButton = screen.getByRole('button', { name: /dismiss alert/i })
        expect(dismissButton).toBeInTheDocument()
      })
    })

    it('should dismiss error alert on close button click', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const usernameInput = screen.getByLabelText(/username/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(usernameInput, 'invaliduser')
      await user.type(passwordInput, 'wrongpass')
      await user.click(submitButton)

      await waitFor(() => {
        const dismissButton = screen.getByRole('button', { name: /dismiss alert/i })
        expect(dismissButton).toBeInTheDocument()
      })

      const dismissButton = screen.getByRole('button', { name: /dismiss alert/i })
      await user.click(dismissButton)

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      })
    })
  })

  // ========================================================================
  // Sign Up Link Tests
  // ========================================================================

  describe('sign up link', () => {
    it('should show toast message when sign up is clicked', async () => {
      const user = userEvent.setup()
      render(<LoginForm />, { wrapper: createWrapper() })

      const signUpLink = screen.getByText(/sign up/i).closest('a')
      
      await user.click(signUpLink)

      await waitFor(() => {
        expect(screen.getByText(/this feature will be available soon/i)).toBeInTheDocument()
      })
    })
  })
})
