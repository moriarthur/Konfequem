/**
 * Unit tests for bookingUtils.
 * 
 * Tests validate:
 * - Timezone conversion (toOfficeTime)
 * - Office hours validation (isWithinOfficeHours)
 * - Available slot calculation (findAvailableSlots)
 * - Duration calculation (getAvailableDurations)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DateTime } from 'luxon'
import {
  toOfficeTime,
  isWithinOfficeHours,
  findAvailableSlots,
  formatSlot,
  getAvailableDurations,
  toUTCString,
  hasDayAvailableSlots,
  OFFICE_TIMEZONE,
  OFFICE_HOURS,
} from '@/utils/bookingUtils'

describe('bookingUtils', () => {
  // ========================================================================
  // toOfficeTime Tests
  // ========================================================================

  describe('toOfficeTime', () => {
    it('should convert a JavaScript Date to Berlin timezone', () => {
      const date = new Date('2025-01-28T10:00:00Z')
      const result = toOfficeTime(date)
      
      expect(result).toBeInstanceOf(DateTime)
      expect(result.zoneName).toBe(OFFICE_TIMEZONE)
    })

    it('should handle summer time (CEST)', () => {
      const date = new Date('2025-07-15T10:00:00Z') // July is summer
      const result = toOfficeTime(date)
      
      expect(result.zoneName).toBe(OFFICE_TIMEZONE)
      expect(result.hour).toBeGreaterThan(10) // CEST is UTC+2
    })

    it('should handle winter time (CET)', () => {
      const date = new Date('2025-01-28T10:00:00Z') // January is winter
      const result = toOfficeTime(date)
      
      expect(result.zoneName).toBe(OFFICE_TIMEZONE)
      expect(result.hour).toBe(11) // CET is UTC+1
    })
  })

  // ========================================================================
  // isWithinOfficeHours Tests
  // ========================================================================

  describe('isWithinOfficeHours', () => {
    it('should return true for times within office hours', () => {
      const start = new Date('2025-01-28T09:00:00+01:00')
      const end = new Date('2025-01-28T11:00:00+01:00')
      
      expect(isWithinOfficeHours(start, end)).toBe(true)
    })

    it('should return true for booking starting at office open (08:00)', () => {
      const start = new Date('2025-01-28T08:00:00+01:00')
      const end = new Date('2025-01-28T10:00:00+01:00')
      
      expect(isWithinOfficeHours(start, end)).toBe(true)
    })

    it('should return true for booking ending at office close (22:00)', () => {
      const start = new Date('2025-01-28T20:00:00+01:00')
      const end = new Date('2025-01-28T22:00:00+01:00')
      
      expect(isWithinOfficeHours(start, end)).toBe(true)
    })

    it('should return false for booking starting before office hours', () => {
      const start = new Date('2025-01-28T07:00:00+01:00')
      const end = new Date('2025-01-28T09:00:00+01:00')
      
      expect(isWithinOfficeHours(start, end)).toBe(false)
    })

    it('should return false for booking ending after office hours', () => {
      const start = new Date('2025-01-28T21:00:00+01:00')
      const end = new Date('2025-01-28T23:00:00+01:00')
      
      expect(isWithinOfficeHours(start, end)).toBe(false)
    })

    it('should return false for booking starting at office close', () => {
      const start = new Date('2025-01-28T22:00:00+01:00')
      const end = new Date('2025-01-28T23:00:00+01:00')
      
      expect(isWithinOfficeHours(start, end)).toBe(false)
    })

    it('should return false for booking spanning across midnight', () => {
      const start = new Date('2025-01-28T22:00:00+01:00')
      const end = new Date('2025-01-29T02:00:00+01:00')
      
      expect(isWithinOfficeHours(start, end)).toBe(false)
    })
  })

  // ========================================================================
  // findAvailableSlots Tests
  // ========================================================================

  describe('findAvailableSlots', () => {
    let testDate

    beforeEach(() => {
      testDate = new Date('2025-01-28T00:00:00+01:00')
    })

    it('should return all slots when there are no bookings', () => {
      const slots = findAvailableSlots(testDate, [])
      
      // Office hours: 08:00 - 22:00 = 14 hours = 840 minutes
      // With 15 min increments: 840 / 15 = 56 slots
      expect(slots.length).toBeGreaterThan(50)
    })

    it('should return empty array when day is fully booked', () => {
      const allDayBooking = {
        start_time: '2025-01-28T08:00:00+01:00',
        end_time: '2025-01-28T22:00:00+01:00',
      }
      
      const slots = findAvailableSlots(testDate, [allDayBooking])
      
      expect(slots).toHaveLength(0)
    })

    it('should exclude time ranges with existing bookings', () => {
      const bookings = [
        {
          start_time: '2025-01-28T10:00:00+01:00',
          end_time: '2025-01-28T12:00:00+01:00',
        },
      ]
      
      const slots = findAvailableSlots(testDate, bookings)
      
      // Should have slots before and after the booking
      expect(slots.length).toBeGreaterThan(0)
      
      // None of the slots should overlap with the booking
      const bookingStart = DateTime.fromISO(bookings[0].start_time).setZone(OFFICE_TIMEZONE)
      const bookingEnd = DateTime.fromISO(bookings[0].end_time).setZone(OFFICE_TIMEZONE)
      
      slots.forEach(slot => {
        const slotEnd = slot.plus({ minutes: OFFICE_HOURS.minDuration })
        expect(slotEnd <= bookingStart || slot >= bookingEnd).toBe(true)
      })
    })

    it('should handle multiple bookings', () => {
      const bookings = [
        {
          start_time: '2025-01-28T09:00:00+01:00',
          end_time: '2025-01-28T11:00:00+01:00',
        },
        {
          start_time: '2025-01-28T14:00:00+01:00',
          end_time: '2025-01-28T16:00:00+01:00',
        },
      ]
      
      const slots = findAvailableSlots(testDate, bookings)
      
      expect(slots.length).toBeGreaterThan(0)
    })

    it('should handle overlapping bookings', () => {
      const bookings = [
        {
          start_time: '2025-01-28T10:00:00+01:00',
          end_time: '2025-01-28T12:00:00+01:00',
        },
        {
          start_time: '2025-01-28T11:00:00+01:00',
          end_time: '2025-01-28T13:00:00+01:00',
        },
      ]
      
      const slots = findAvailableSlots(testDate, bookings)
      
      // Should still find slots outside the combined booking period
      expect(slots.length).toBeGreaterThan(0)
    })

    it('should return slots at 15-minute intervals', () => {
      const slots = findAvailableSlots(testDate, [])
      
      // Check that consecutive slots are 15 minutes apart
      for (let i = 1; i < Math.min(slots.length, 10); i++) {
        const diff = slots[i].diff(slots[i - 1], 'minutes').minutes
        expect(diff).toBe(OFFICE_HOURS.minDuration)
      }
    })
  })

  // ========================================================================
  // formatSlot Tests
  // ========================================================================

  describe('formatSlot', () => {
    it('should format slot time in HH:mm format', () => {
      const dateTime = DateTime.fromISO('2025-01-28T10:30:00+01:00')
      const result = formatSlot(dateTime)
      
      expect(result).toBe('10:30')
    })

    it('should handle single-digit hours', () => {
      const dateTime = DateTime.fromISO('2025-01-28T08:05:00+01:00')
      const result = formatSlot(dateTime)
      
      expect(result).toBe('08:05')
    })

    it('should handle midnight', () => {
      const dateTime = DateTime.fromISO('2025-01-28T00:00:00+01:00')
      const result = formatSlot(dateTime)
      
      expect(result).toBe('00:00')
    })
  })

  // ========================================================================
  // getAvailableDurations Tests
  // ========================================================================

  describe('getAvailableDurations', () => {
    let testDate
    let startTime

    beforeEach(() => {
      testDate = new Date('2025-01-28T00:00:00+01:00')
      startTime = new Date('2025-01-28T09:00:00+01:00')
    })

    it('should return durations when no bookings exist', () => {
      const durations = getAvailableDurations(startTime, [], testDate)
      
      expect(durations.length).toBeGreaterThan(0)
      expect(durations[0].minutes).toBe(OFFICE_HOURS.minDuration)
    })

    it('should respect max duration of 8 hours', () => {
      const durations = getAvailableDurations(startTime, [], testDate)
      
      const maxDuration = durations[durations.length - 1]
      expect(maxDuration.minutes).toBeLessThanOrEqual(OFFICE_HOURS.maxDuration)
    })

    it('should return durations in 15-minute increments', () => {
      const durations = getAvailableDurations(startTime, [], testDate)
      
      for (let i = 1; i < durations.length; i++) {
        expect(durations[i].minutes).toBe(durations[i - 1].minutes + OFFICE_HOURS.minDuration)
      }
    })

    it('should limit durations based on next booking', () => {
      const nextBooking = {
        start_time: '2025-01-28T10:30:00+01:00',
        end_time: '2025-01-28T12:00:00+01:00',
      }
      
      const durations = getAvailableDurations(startTime, [nextBooking], testDate)
      
      // From 09:00 to 10:30 = 90 minutes max
      const maxDuration = durations[durations.length - 1]
      expect(maxDuration.minutes).toBeLessThanOrEqual(90)
    })

    it('should limit durations based on office hours end', () => {
      const lateStart = new Date('2025-01-28T20:00:00+01:00')
      const durations = getAvailableDurations(lateStart, [], testDate)
      
      // From 20:00 to 22:00 = 2 hours max
      const maxDuration = durations[durations.length - 1]
      expect(maxDuration.minutes).toBeLessThanOrEqual(120)
    })

    it('should format duration labels correctly', () => {
      const durations = getAvailableDurations(startTime, [], testDate)
      
      expect(durations[0].label).toBe('15 min')
      expect(durations[1].label).toBe('30 min')
      
      // Find 60 min (1 hour)
      const hourDuration = durations.find(d => d.minutes === 60)
      expect(hourDuration?.label).toBe('1h')
      
      // Find 90 min (1h 30m)
      const hourHalfDuration = durations.find(d => d.minutes === 90)
      expect(hourHalfDuration?.label).toBe('1h 30m')
    })

    it('should return empty array when no time available', () => {
      const startAtEnd = new Date('2025-01-28T22:00:00+01:00')
      const durations = getAvailableDurations(startAtEnd, [], testDate)
      
      expect(durations).toHaveLength(0)
    })
  })

  // ========================================================================
  // toUTCString Tests
  // ========================================================================

  describe('toUTCString', () => {
    it('should convert DateTime to UTC ISO string', () => {
      const dateTime = DateTime.fromISO('2025-01-28T10:00:00+01:00', { zone: OFFICE_TIMEZONE })
      const result = toUTCString(dateTime)
      
      expect(typeof result).toBe('string')
      expect(result).toContain('T')
      expect(result).toContain('Z')
    })

    it('should maintain correct time offset', () => {
      const berlinTime = DateTime.fromISO('2025-01-28T10:00:00', { zone: OFFICE_TIMEZONE })
      const utcString = toUTCString(berlinTime)
      const parsed = DateTime.fromISO(utcString)
      
      // The parsed UTC time should represent the same moment
      expect(parsed.toMillis()).toBe(berlinTime.toUTC().toMillis())
    })
  })

  // ========================================================================
  // hasDayAvailableSlots Tests
  // ========================================================================

  describe('hasDayAvailableSlots', () => {
    it('should return true when slots are available', () => {
      const date = new Date('2025-01-28T00:00:00+01:00')
      
      expect(hasDayAvailableSlots(date, [])).toBe(true)
    })

    it('should return false when no slots are available', () => {
      const date = new Date('2025-01-28T00:00:00+01:00')
      const fullDayBooking = {
        start_time: '2025-01-28T08:00:00+01:00',
        end_time: '2025-01-28T22:00:00+01:00',
      }
      
      expect(hasDayAvailableSlots(date, [fullDayBooking])).toBe(false)
    })

    it('should return true for partially booked days', () => {
      const date = new Date('2025-01-28T00:00:00+01:00')
      const bookings = [
        {
          start_time: '2025-01-28T09:00:00+01:00',
          end_time: '2025-01-28T11:00:00+01:00',
        },
      ]
      
      expect(hasDayAvailableSlots(date, bookings)).toBe(true)
    })
  })
})
