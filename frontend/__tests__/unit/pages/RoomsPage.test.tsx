import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'

import RoomsPage from '@/pages/RoomsPage'
import { AlertProvider } from '@/context/AlertContext'
import { AuthProvider } from '@/context/AuthContext'
import { server } from '../../mocks/handlers'

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

const mockUserRole = (role: 'org_admin' | 'member') => {
  server.use(
    http.get('/api/users/me/', () =>
      HttpResponse.json({
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role,
        organization: { id: 1, name: 'Test Org', slug: 'test-org' },
      })
    )
  )
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AlertProvider>
        <AuthProvider>
          <RoomsPage />
        </AuthProvider>
      </AlertProvider>
    </MemoryRouter>
  )
}

const user = userEvent.setup()

describe('RoomsPage room management', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    server.resetHandlers()
    seedTokens()
  })

  it('shows management controls to org_admin', async () => {
    mockUserRole('org_admin')
    renderPage()

    await screen.findByText('Conference Room A')

    expect(screen.getByRole('button', { name: '+ Add Room' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit room Conference Room A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete room Conference Room A' })).toBeInTheDocument()
  })

  it('hides management controls from members', async () => {
    mockUserRole('member')
    renderPage()

    await screen.findByText('Conference Room A')

    expect(screen.queryByRole('button', { name: '+ Add Room' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit room/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete room/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /book this room/i }).length).toBeGreaterThan(0)
  })

  it('creates a room via the form modal', async () => {
    mockUserRole('org_admin')
    let postedBody: Record<string, unknown> | undefined
    server.use(
      http.post('/api/rooms/', async ({ request }) => {
        postedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          { id: 5, name: 'Focus Room', capacity: 6, features: [] },
          { status: 201 }
        )
      })
    )
    renderPage()

    await screen.findByText('Conference Room A')
    await user.click(screen.getByRole('button', { name: '+ Add Room' }))

    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Room name'), 'Focus Room')
    await user.type(within(dialog).getByLabelText('Capacity'), '6')
    await user.click(within(dialog).getByRole('button', { name: 'Add Room' }))

    await waitFor(() => {
      expect(screen.getByText('Room created')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(postedBody).toEqual({ name: 'Focus Room', location: '', capacity: 6, features: [] })
  })

  it('blocks submit on empty form without hitting the API', async () => {
    mockUserRole('org_admin')
    const postSpy = vi.fn()
    server.use(http.post('/api/rooms/', postSpy))
    renderPage()

    await screen.findByText('Conference Room A')
    await user.click(screen.getByRole('button', { name: '+ Add Room' }))

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Add Room' }))

    expect(await within(dialog).findByText('Room name is required')).toBeInTheDocument()
    expect(await within(dialog).findByText('Capacity is required')).toBeInTheDocument()
    expect(postSpy).not.toHaveBeenCalled()
  })

  it('deletes a room after confirmation', async () => {
    mockUserRole('org_admin')
    renderPage()

    await screen.findByText('Conference Room A')
    await user.click(screen.getByRole('button', { name: 'Delete room Conference Room A' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Conference Room A')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Delete Room' }))

    await waitFor(() => {
      expect(screen.getByText('Room deleted')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('keeps the confirm dialog open when deletion is blocked', async () => {
    mockUserRole('org_admin')
    renderPage()

    await screen.findByText('Conference Room B')
    await user.click(screen.getByRole('button', { name: 'Delete room Conference Room B' }))

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete Room' }))

    expect(
      await within(dialog).findByText('Room has upcoming bookings and cannot be deleted.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeInTheDocument()
  })

  it('shows an empty state with a create action to org_admin', async () => {
    mockUserRole('org_admin')
    server.use(http.get('/api/rooms/', () => HttpResponse.json([])))
    renderPage()

    expect(await screen.findByText('No rooms yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add your first room' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows the plain empty state to members', async () => {
    mockUserRole('member')
    server.use(http.get('/api/rooms/', () => HttpResponse.json([])))
    renderPage()

    expect(await screen.findByText('No rooms available')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add your first room' })).not.toBeInTheDocument()
  })
})
