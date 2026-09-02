import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'

import RoomFormModal from '@/components/RoomFormModal'
import { AlertProvider } from '@/context/AlertContext'
import { AuthProvider } from '@/context/AuthContext'
import { server } from '../../mocks/handlers'
import type { Room, Feature } from '@/types'

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

const features: Feature[] = [
  { id: 1, name: 'Projector', icon: 'projector' },
  { id: 2, name: 'Whiteboard', icon: 'whiteboard' },
  { id: 3, name: 'Phone', icon: 'phone' },
]

const existingRoom: Room = {
  id: 1,
  name: 'Conference Room A',
  location: 'Floor 1',
  capacity: 10,
  features: [{ id: 1, name: 'Projector', icon: 'projector' }],
}

function renderModal(props: Partial<Parameters<typeof RoomFormModal>[0]> = {}) {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const utils = render(
    <AlertProvider>
      <AuthProvider>
        <RoomFormModal
          room={props.room ?? null}
          features={props.features ?? features}
          onClose={onClose}
          onSaved={onSaved}
        />
      </AuthProvider>
    </AlertProvider>
  )
  return { onClose, onSaved, ...utils }
}

const user = userEvent.setup()

describe('RoomFormModal', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    server.resetHandlers()
    seedTokens()
  })

  it('renders empty fields in create mode', () => {
    renderModal()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Add Room' })).toBeInTheDocument()
    expect(screen.getByLabelText('Room name')).toHaveValue('')
    expect((screen.getByLabelText('Capacity') as HTMLInputElement).value).toBe('')
    expect(screen.getByLabelText('Room name')).not.toBeDisabled()
  })

  it('prefills fields and feature toggles in edit mode', () => {
    renderModal({ room: existingRoom })

    expect(screen.getByRole('heading', { name: 'Edit Room' })).toBeInTheDocument()
    expect(screen.getByLabelText('Room name')).toHaveValue('Conference Room A')
    expect(screen.getByLabelText('Location (optional)')).toHaveValue('Floor 1')
    expect(screen.getByLabelText('Capacity')).toHaveValue(10)
    expect(screen.getByRole('button', { name: /Projector/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: /Whiteboard/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('submits a create payload with the selected features', async () => {
    let postedBody: Record<string, unknown> | undefined
    server.use(
      http.post('/api/rooms/', async ({ request }) => {
        postedBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 5 }, { status: 201 })
      })
    )
    const { onSaved } = renderModal()

    await user.type(screen.getByLabelText('Room name'), 'Focus Room')
    await user.type(screen.getByLabelText('Capacity'), '6')
    await user.click(screen.getByRole('button', { name: /Whiteboard/ }))
    await user.click(screen.getByRole('button', { name: 'Add Room' }))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled()
    })
    expect(postedBody).toEqual({
      name: 'Focus Room',
      location: '',
      capacity: 6,
      features: [2],
    })
  })

  it('submits an update via PUT with feature replacement', async () => {
    let putBody: Record<string, unknown> | undefined
    server.use(
      http.put('/api/rooms/1/', async ({ request }) => {
        putBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 1 }, { status: 200 })
      })
    )
    const { onSaved } = renderModal({ room: existingRoom })

    await user.clear(screen.getByLabelText('Capacity'))
    await user.type(screen.getByLabelText('Capacity'), '12')
    // Deselect Projector (id 1), select Whiteboard (id 2)
    await user.click(screen.getByRole('button', { name: /Projector/ }))
    await user.click(screen.getByRole('button', { name: /Whiteboard/ }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled()
    })
    expect(putBody).toEqual({
      name: 'Conference Room A',
      location: 'Floor 1',
      capacity: 12,
      features: [2],
    })
  })

  it('shows a server error banner on 400', async () => {
    server.use(
      http.post('/api/rooms/', () =>
        HttpResponse.json(
          { name: ['Room name can only contain letters, numbers, spaces, hyphens, and periods.'] },
          { status: 400 }
        )
      )
    )
    renderModal()

    await user.type(screen.getByLabelText('Room name'), 'Focus Room')
    await user.type(screen.getByLabelText('Capacity'), '6')
    await user.click(screen.getByRole('button', { name: 'Add Room' }))

    const dialog = screen.getByRole('dialog')
    expect(
      await within(dialog).findByText(
        'Room name can only contain letters, numbers, spaces, hyphens, and periods.'
      )
    ).toBeInTheDocument()
  })
})
