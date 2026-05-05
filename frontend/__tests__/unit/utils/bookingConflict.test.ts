import { describe, it, expect } from 'vitest'
import {
  checkBookingConflict,
  getConflictMessage,
  useFormConflict,
  type BookingConflictInput,
  type ConflictResult,
} from '@/utils/bookingConflict'
import { DateTime } from 'luxon'

// Helpers to create DateTime in office timezone
const dt = (hour: number, minute = 0) =>
  DateTime.fromObject({ year: 2025, month: 6, day: 15, hour, minute }, { zone: 'Europe/Berlin' })

const iso = (hour: number, minute = 0) =>
  dt(hour, minute).toISO()!

const makeBooking = (
  startHour: number,
  endHour: number,
  roomId = 1,
  id?: number
): BookingConflictInput => ({
  start_time: iso(startHour),
  end_time: iso(endHour),
  room: roomId,
  ...(id !== undefined ? { id } : {}),
})

describe('checkBookingConflict', () => {
  it('returns null when there are no bookings', () => {
    const result = checkBookingConflict(dt(9), dt(10), [], 1)
    expect(result).toBeNull()
  })

  it('returns null when bookings are for a different room', () => {
    const bookings = [makeBooking(9, 10, 2)]
    const result = checkBookingConflict(dt(9), dt(10), bookings, 1)
    expect(result).toBeNull()
  })

  it('returns null when bookings are on a different day', () => {
    const otherDay = makeBooking(9, 10)
    otherDay.start_time = dt(9).plus({ days: 1 }).toISO()!
    otherDay.end_time = dt(10).plus({ days: 1 }).toISO()!
    const result = checkBookingConflict(dt(9), dt(10), [otherDay], 1)
    expect(result).toBeNull()
  })

  it('detects completely_inside conflict', () => {
    // Slot 9:00-10:00, booking 8:00-11:00 → slot is inside booking
    const bookings = [makeBooking(8, 11)]
    const result = checkBookingConflict(dt(9), dt(10), bookings, 1)
    expect(result).not.toBeNull()
    expect(result!.conflictType).toBe('completely_inside')
  })

  it('detects completely_covers conflict', () => {
    // Slot 8:00-12:00, booking 9:00-10:00 → slot covers booking
    const bookings = [makeBooking(9, 10)]
    const result = checkBookingConflict(dt(8), dt(12), bookings, 1)
    expect(result).not.toBeNull()
    expect(result!.conflictType).toBe('completely_covers')
  })

  it('detects end_overlap conflict', () => {
    // Slot 9:00-10:30, booking 10:00-11:00 → slot end overlaps booking start
    const bookings = [makeBooking(10, 11)]
    const result = checkBookingConflict(dt(9), dt(10, 30), bookings, 1)
    expect(result).not.toBeNull()
    expect(result!.conflictType).toBe('end_overlap')
  })

  it('detects start_overlap conflict', () => {
    // Slot 9:30-11:00, booking 9:00-10:00 → slot start overlaps booking end
    const bookings = [makeBooking(9, 10)]
    const result = checkBookingConflict(dt(9, 30), dt(11), bookings, 1)
    expect(result).not.toBeNull()
    expect(result!.conflictType).toBe('start_overlap')
  })

  it('excludes booking by excludeBookingId', () => {
    const bookings = [makeBooking(9, 10, 1, 42)]
    const result = checkBookingConflict(dt(9), dt(10), bookings, 1, 42)
    expect(result).toBeNull()
  })

  it('handles room as object with id', () => {
    const bookings: BookingConflictInput[] = [{
      start_time: iso(9),
      end_time: iso(10),
      room: { id: 1 },
    }]
    const result = checkBookingConflict(dt(9), dt(10), bookings, 1)
    expect(result).not.toBeNull()
  })

  it('returns null for adjacent non-overlapping bookings', () => {
    const bookings = [makeBooking(9, 10)]
    // Slot ends exactly when booking starts → no overlap
    const result = checkBookingConflict(dt(8), dt(9), bookings, 1)
    expect(result).toBeNull()
  })

  it('returns null when slot starts exactly when booking ends', () => {
    const bookings = [makeBooking(9, 10)]
    const result = checkBookingConflict(dt(10), dt(11), bookings, 1)
    expect(result).toBeNull()
  })
})

describe('getConflictMessage', () => {
  it('returns null for no conflict', () => {
    expect(getConflictMessage(null)).toBeNull()
  })

  const booking = makeBooking(9, 10)
  const cases: [string, ConflictResult, RegExp][] = [
    ['completely_inside', { booking, conflictType: 'completely_inside' }, /overlaps/],
    ['completely_covers', { booking, conflictType: 'completely_covers' }, /cannot book over/],
    ['end_overlap', { booking, conflictType: 'end_overlap' }, /end during/],
    ['start_overlap', { booking, conflictType: 'start_overlap' }, /start during/],
  ]

  for (const [name, conflict, pattern] of cases) {
    it(`returns appropriate message for ${name}`, () => {
      const msg = getConflictMessage(conflict)
      expect(msg).not.toBeNull()
      expect(msg).toMatch(pattern)
    })
  }

  it('includes time range in message', () => {
    const conflict: ConflictResult = { booking: makeBooking(9, 10), conflictType: 'completely_inside' }
    const msg = getConflictMessage(conflict)
    expect(msg).toContain('09:00')
    expect(msg).toContain('10:00')
  })
})

describe('useFormConflict', () => {
  it('returns no conflict when inputs are incomplete', () => {
    const result = useFormConflict(null, null, [], null)
    expect(result).toEqual({ hasConflict: false, conflict: null, message: null })
  })

  it('returns no conflict when selectedSlot is null', () => {
    const result = useFormConflict(dt(9), null, [], 1)
    expect(result.hasConflict).toBe(false)
  })

  it('returns no conflict when bookings are empty', () => {
    const result = useFormConflict(
      dt(9),
      { start: dt(10), end: dt(11) },
      [],
      1
    )
    expect(result.hasConflict).toBe(false)
  })

  it('detects conflict with existing booking', () => {
    const bookings = [makeBooking(10, 11)]
    const result = useFormConflict(
      dt(15),
      { start: dt(10, 30), end: dt(11, 30) },
      bookings,
      1
    )
    expect(result.hasConflict).toBe(true)
    expect(result.conflict).not.toBeNull()
    expect(result.message).not.toBeNull()
  })
})
