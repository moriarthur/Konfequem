import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchMonthBookings,
  shouldFetchMonth,
  getCachedBookings,
  subscribeToMonth,
  resetBookingCache,
} from '@/utils/bookingCache'
import type { BookingData } from '@/utils/bookingUtils'

// Mid-day UTC so the Berlin (OFFICE_TIMEZONE) conversion stays on the same
// calendar date.
const SEPT_15 = new Date('2026-09-15T12:00:00Z')
const SEPT_16 = new Date('2026-09-16T12:00:00Z')
const OCT_15 = new Date('2026-10-15T12:00:00Z')

const ROOM_A = 1
const ROOM_B = 2

function bookingFor(roomId: number, day: number): BookingData {
  return {
    id: roomId * 100 + day,
    room: roomId,
    room_name: `Room ${roomId}`,
    start_time: `2026-09-${String(day).padStart(2, '0')}T10:00:00+02:00`,
    end_time: `2026-09-${String(day).padStart(2, '0')}T11:00:00+02:00`,
    status: 'upcoming',
  }
}

const roomABookings = [bookingFor(ROOM_A, 16)]

beforeEach(() => {
  resetBookingCache()
  vi.restoreAllMocks()
})

describe('bookingCache room+month keying', () => {
  it('does not leak Room A slots into Room B in the same month', async () => {
    const authFetch = vi.fn().mockResolvedValue(roomABookings)

    await fetchMonthBookings(SEPT_15, ROOM_A, authFetch)

    // Room A is cached; Room B is not.
    expect(shouldFetchMonth(SEPT_15, ROOM_A)).toBe(false)
    expect(shouldFetchMonth(SEPT_15, ROOM_B)).toBe(true)
    expect(getCachedBookings(SEPT_16, ROOM_B)).toBeNull()

    const roomADay = getCachedBookings(SEPT_16, ROOM_A)
    expect(roomADay).toHaveLength(1)
    expect(roomADay![0].room).toBe(ROOM_A)
  })

  it('fetches Room B separately and keeps both rooms isolated', async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(roomABookings)
      .mockResolvedValueOnce([bookingFor(ROOM_B, 17)])

    await fetchMonthBookings(SEPT_15, ROOM_A, authFetch)
    await fetchMonthBookings(SEPT_15, ROOM_B, authFetch)

    expect(authFetch).toHaveBeenCalledTimes(2)
    expect(authFetch).toHaveBeenNthCalledWith(
      1,
      `/api/availability/?room=${ROOM_A}&month=2026-09`
    )
    expect(authFetch).toHaveBeenNthCalledWith(
      2,
      `/api/availability/?room=${ROOM_B}&month=2026-09`
    )

    const roomADay = getCachedBookings(SEPT_16, ROOM_A)
    const roomBDay16 = getCachedBookings(SEPT_16, ROOM_B)
    expect(roomADay).toHaveLength(1)
    expect(roomBDay16 ?? []).toHaveLength(0)
    expect(getCachedBookings(new Date('2026-09-17T12:00:00Z'), ROOM_B)).toHaveLength(1)
  })

  it('month cache hit is per room, other months still fetch', async () => {
    const authFetch = vi.fn().mockResolvedValue([])

    await fetchMonthBookings(SEPT_15, ROOM_A, authFetch)

    expect(shouldFetchMonth(SEPT_16, ROOM_A)).toBe(false)
    expect(shouldFetchMonth(OCT_15, ROOM_A)).toBe(true)
    expect(shouldFetchMonth(SEPT_15, ROOM_B)).toBe(true)
  })

  it('listeners are scoped to their room+month bucket', async () => {
    const roomBListener = vi.fn()
    const unsubscribe = subscribeToMonth(SEPT_15, ROOM_B, roomBListener)

    const authFetch = vi.fn().mockResolvedValue(roomABookings)
    await fetchMonthBookings(SEPT_15, ROOM_A, authFetch)
    expect(roomBListener).not.toHaveBeenCalled()

    await fetchMonthBookings(SEPT_15, ROOM_B, authFetch)
    expect(roomBListener).toHaveBeenCalledTimes(1)

    unsubscribe()
  })

  it('resetBookingCache clears every room bucket', async () => {
    const authFetch = vi.fn().mockResolvedValue(roomABookings)
    await fetchMonthBookings(SEPT_15, ROOM_A, authFetch)
    expect(shouldFetchMonth(SEPT_15, ROOM_A)).toBe(false)

    resetBookingCache()

    expect(shouldFetchMonth(SEPT_15, ROOM_A)).toBe(true)
    expect(getCachedBookings(SEPT_16, ROOM_A)).toBeNull()
  })
})
