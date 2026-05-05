import { describe, it, expect } from 'vitest'
import { DateTime } from 'luxon'
import {
  TimeSlot,
  getSlotDurations,
  getAvailableDurationsForDate,
  isDayFullyBooked,
  getDaySlots,
  getAvailableSlots,
  groupSlotsByPeriod,
  TIME_PERIODS,
} from '@/utils/timeSlots'
import type { BookingData } from '@/utils/bookingUtils'

const TZ = 'Europe/Berlin'

const dt = (hour: number, minute = 0, day = 15) =>
  DateTime.fromObject({ year: 2025, month: 6, day, hour, minute, second: 0 }, { zone: TZ })

const makeBooking = (
  startHour: number,
  endHour: number,
  roomId = 1,
  date?: DateTime
): BookingData => ({
  id: Math.random(),
  room: roomId,
  start_time: (date || dt(startHour, 0)).set({ hour: startHour, minute: 0 }).toISO()!,
  end_time: (date || dt(endHour, 0)).set({ hour: endHour, minute: 0 }).toISO()!,
})

describe('TimeSlot', () => {
  it('creates from DateTime objects', () => {
    const slot = new TimeSlot(dt(9), dt(10))
    expect(slot.duration).toBe(60)
    expect(slot.status).toBe('available')
  })

  it('creates from string times', () => {
    const slot = new TimeSlot('09:00', '10:00')
    expect(slot.duration).toBe(60)
  })

  it('normalizes timezone for non-Berlin DateTime', () => {
    const utc = DateTime.utc(2025, 6, 15, 9, 0)
    const slot = new TimeSlot(utc, utc.plus({ hours: 1 }))
    expect(slot.start.zoneName).toContain('Berlin')
  })

  it('computes duration correctly', () => {
    const slot = new TimeSlot(dt(9), dt(10, 30))
    expect(slot.duration).toBe(90)
  })

  it('identifies morning period', () => {
    const slot = new TimeSlot(dt(9), dt(10))
    expect(slot.period).toBe('morning')
  })

  it('identifies afternoon period', () => {
    const slot = new TimeSlot(dt(13), dt(14))
    expect(slot.period).toBe('afternoon')
  })

  it('identifies evening period', () => {
    const slot = new TimeSlot(dt(18), dt(19))
    expect(slot.period).toBe('evening')
  })

  it('detects overlap with another slot', () => {
    const slot = new TimeSlot(dt(9), dt(11))
    expect(slot.overlaps({ start: dt(10), end: dt(12) })).toBe(true)
  })

  it('detects no overlap for adjacent slots', () => {
    const slot = new TimeSlot(dt(9), dt(10))
    expect(slot.overlaps({ start: dt(10), end: dt(11) })).toBe(false)
  })

  it('detects overlap with ISO strings', () => {
    const slot = new TimeSlot(dt(9), dt(11))
    expect(slot.overlaps({
      start: dt(10).toISO()!,
      end: dt(12).toISO()!,
    })).toBe(true)
  })

  it('canFitDuration returns true for smaller duration', () => {
    const slot = new TimeSlot(dt(9), dt(10))
    expect(slot.canFitDuration(45)).toBe(true)
  })

  it('canFitDuration returns false for larger duration', () => {
    const slot = new TimeSlot(dt(9), dt(10))
    expect(slot.canFitDuration(90)).toBe(false)
  })

  it('formats slot correctly', () => {
    const slot = new TimeSlot(dt(9), dt(10))
    const formatted = slot.format()
    expect(formatted.start).toBe('09:00')
    expect(formatted.end).toBe('10:00')
    expect(formatted.period).toBe('morning')
    expect(formatted.duration).toBe(60)
    expect(formatted.status).toBe('available')
  })

  it('creates slot from booking', () => {
    const booking = makeBooking(9, 10)
    const slot = TimeSlot.fromBooking(booking)
    expect(slot.status).toBe('booked')
    expect(slot.duration).toBe(60)
  })
})

describe('getSlotDurations', () => {
  it('returns only durations that fit in the slot', () => {
    const slot = new TimeSlot(dt(9), dt(9, 45))
    const durations = getSlotDurations(slot)
    expect(durations.every(d => d.minutes <= 45)).toBe(true)
  })

  it('returns all standard durations for a 4-hour slot', () => {
    const slot = new TimeSlot(dt(9), dt(13))
    const durations = getSlotDurations(slot)
    expect(durations.length).toBeGreaterThan(4)
  })
})

describe('getAvailableDurationsForDate', () => {
  it('returns all standard durations for null date', () => {
    const durations = getAvailableDurationsForDate(null)
    expect(durations.length).toBe(8)
  })

  it('returns durations for future dates', () => {
    const future = DateTime.now().plus({ days: 7 }).setZone(TZ)
    const durations = getAvailableDurationsForDate(future)
    // Office hours: 8-22 = 14h = 840 min, all 8 durations fit
    expect(durations.length).toBe(8)
  })
})

describe('isDayFullyBooked', () => {
  it('returns false for a day with no bookings', () => {
    expect(isDayFullyBooked(dt(9), [])).toBe(false)
  })

  it('returns false for a partially booked day', () => {
    const bookings = [makeBooking(9, 10)]
    expect(isDayFullyBooked(dt(9), bookings)).toBe(false)
  })
})

describe('getDaySlots', () => {
  it('generates slots for the full office day', () => {
    const futureDate = DateTime.now().plus({ days: 1 }).setZone(TZ).set({ hour: 0 })
    const slots = getDaySlots(futureDate, [])
    // Office hours 8-22 = 14 hours / 15 min slots = 56 slots
    expect(slots.length).toBe(56)
    expect(slots[0].start.hour).toBe(8)
  })

  it('marks booked slots', () => {
    const futureDate = DateTime.now().plus({ days: 1 }).setZone(TZ).set({ hour: 0 })
    const bookings = [makeBooking(9, 10, 1, futureDate)]
    const slots = getDaySlots(futureDate, bookings)
    const bookedSlots = slots.filter(s => s.status === 'booked')
    // 9:00-10:00 = 4 slots of 15min
    expect(bookedSlots.length).toBe(4)
  })
})

describe('getAvailableSlots', () => {
  it('returns full day slots when no bookings', () => {
    const date = dt(0, 0, 16) // use a future date
    const slots = getAvailableSlots(date, [])
    expect(slots.length).toBeGreaterThan(0)
    // Each slot should be at least 15 min
    slots.forEach(slot => {
      expect(slot.duration).toBeGreaterThanOrEqual(15)
    })
  })

  it('excludes time periods with bookings', () => {
    const date = dt(0, 0, 16)
    const bookings = [makeBooking(9, 10, 1, date)]
    const slots = getAvailableSlots(date, bookings)
    // No slot should overlap with 9:00-10:00
    slots.forEach(slot => {
      const overlapsBooking = slot.start < dt(10, 0, 16) && slot.end > dt(9, 0, 16)
      expect(overlapsBooking).toBe(false)
    })
  })
})

describe('groupSlotsByPeriod', () => {
  it('groups slots by time period', () => {
    const slots = [
      new TimeSlot(dt(9), dt(10)),
      new TimeSlot(dt(14), dt(15)),
      new TimeSlot(dt(19), dt(20)),
    ]
    const groups = groupSlotsByPeriod(slots)
    expect(groups.morning).toBeDefined()
    expect(groups.afternoon).toBeDefined()
    expect(groups.evening).toBeDefined()
  })

  it('handles slots spanning multiple periods', () => {
    // Slot from 11:00-13:00 spans morning and afternoon
    const slots = [new TimeSlot(dt(11), dt(13))]
    const groups = groupSlotsByPeriod(slots)
    expect(groups.morning.length).toBeGreaterThan(0)
    expect(groups.afternoon.length).toBeGreaterThan(0)
  })

  it('returns empty groups object for no slots', () => {
    const groups = groupSlotsByPeriod([])
    expect(Object.keys(groups).length).toBe(0)
  })
})

describe('TIME_PERIODS', () => {
  it('has morning, afternoon, and evening periods', () => {
    expect(TIME_PERIODS.morning).toBeDefined()
    expect(TIME_PERIODS.afternoon).toBeDefined()
    expect(TIME_PERIODS.evening).toBeDefined()
  })

  it('covers all office hours', () => {
    const start = TIME_PERIODS.morning.start
    const end = TIME_PERIODS.evening.end
    expect(start).toBe(8)
    expect(end).toBe(22)
  })
})
