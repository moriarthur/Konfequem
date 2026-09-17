import { describe, it, expect, vi } from 'vitest'
import { fetchAllPages } from '@/utils/pagination'

function page(results: number[], next: string | null) {
  return { count: results.length, next, previous: null, results }
}

describe('fetchAllPages', () => {
  it('follows DRF next links and concatenates every page', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(page([1, 2], 'https://api.example.com/api/bookings/?page=2'))
      .mockResolvedValueOnce(page([3], null))

    const items = await fetchAllPages<number>(fetchFn, '/api/bookings/')

    expect(items).toEqual([1, 2, 3])
    expect(fetchFn).toHaveBeenCalledTimes(2)
    // Absolute next URLs are converted to relative paths + query
    expect(fetchFn).toHaveBeenLastCalledWith('/api/bookings/?page=2')
  })

  it('passes plain-array responses through untouched', async () => {
    const fetchFn = vi.fn().mockResolvedValue([1, 2, 3])

    const items = await fetchAllPages<number>(fetchFn, '/api/availability/')

    expect(items).toEqual([1, 2, 3])
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('handles a single page with next=null', async () => {
    const fetchFn = vi.fn().mockResolvedValue(page([1], null))

    const items = await fetchAllPages<number>(fetchFn, '/api/rooms/')

    expect(items).toEqual([1])
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('preserves the original query when following next', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        page([1], 'https://api.example.com/api/bookings/?month=2026-09&page=2')
      )
      .mockResolvedValueOnce(page([2], null))

    await fetchAllPages<number>(fetchFn, '/api/bookings/?month=2026-09')

    expect(fetchFn).toHaveBeenLastCalledWith('/api/bookings/?month=2026-09&page=2')
  })

  it('caps the loop instead of spinning forever on a bad next', async () => {
    const fetchFn = vi.fn().mockImplementation(async () =>
      page([], 'https://api.example.com/api/bookings/?page=2')
    )

    const items = await fetchAllPages<number>(fetchFn, '/api/bookings/')

    expect(items).toEqual([])
    expect(fetchFn.mock.calls.length).toBeLessThan(60)
  })

  it('treats a null response as empty', async () => {
    const fetchFn = vi.fn().mockResolvedValue(null)

    const items = await fetchAllPages<number>(fetchFn, '/api/rooms/')

    expect(items).toEqual([])
  })
})
