import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BookingCardInline from '@/components/calendar/BookingCardInline'
import type { CalendarBooking } from '@/components/calendar/useCalendarBookings'
import { DateTime } from 'luxon'

const OFFICE_TIMEZONE = 'Europe/Berlin'

const futureBase = { day: 20, hour: 10 }
const futureIso = (hour: number, minute = 0) =>
  DateTime.fromObject({ ...futureBase, hour, minute }, { zone: OFFICE_TIMEZONE })
    .plus({ months: 1 })
    .toISO()!

const noop = () => {}
const emptyProps = {
  isNext: false,
  isEditing: false,
  editForm: { start_time: '', end_time: '' },
  saving: false,
  validationErrors: {},
  onEdit: noop,
  onCancelEdit: noop,
  onSave: noop,
  onDeleteClick: noop,
  onEditFormChange: noop,
  onClearErrors: noop,
}

const futureBooking: CalendarBooking = {
  id: 1,
  room: 1,
  room_name: 'Conference Room A',
  start_time: futureIso(10),
  end_time: futureIso(11),
}

describe('BookingCardInline', () => {
  it('shows the Cancelled label for a cancelled booking', () => {
    render(
      <BookingCardInline
        {...emptyProps}
        booking={{ ...futureBooking, status: 'cancelled' }}
        canEdit={false}
      />
    )

    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByText('Conference Room A')).toBeInTheDocument()
  })

  it('is not clickable-to-edit for a cancelled booking even if canEdit is true', () => {
    render(
      <BookingCardInline
        {...emptyProps}
        booking={{ ...futureBooking, status: 'cancelled' }}
        canEdit={true}
      />
    )

    const card = screen.getByText('Conference Room A').closest('div.p-4')
    expect(card).not.toHaveClass('cursor-pointer')
  })

  it('renders a future booking without a Cancelled label', () => {
    render(<BookingCardInline {...emptyProps} booking={futureBooking} canEdit={true} />)

    expect(screen.queryByText('Cancelled')).not.toBeInTheDocument()
    expect(screen.getByText('Conference Room A')).toBeInTheDocument()
  })
})
