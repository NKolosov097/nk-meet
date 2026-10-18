import type { LayoutChangeEvent } from "react-native"

import { act, renderHook } from "@testing-library/react-native"

import { AUTO_HIDE_DELAY_MS, useParticipantGrid } from "./useParticipantGrid"

const layoutEvent = (width: number, height: number): LayoutChangeEvent =>
  ({
    nativeEvent: { layout: { x: 0, y: 0, width, height } },
  }) as LayoutChangeEvent

const itemsOfLength = (length: number): number[] =>
  Array.from({ length }, (_, index) => index)

test("computes tile size from the measured container for a 2x2 grid", async () => {
  const { result } = await renderHook(() =>
    useParticipantGrid(itemsOfLength(4)),
  )

  await act(async () => {
    result.current.onContainerLayout(layoutEvent(650, 330))
  })

  expect(result.current.tileWidth).toBe(310)
  expect(result.current.tileHeight).toBe(150)
})

test("reports a single page when the count is within the page size", async () => {
  const { result } = await renderHook(() =>
    useParticipantGrid(itemsOfLength(8)),
  )

  expect(result.current.totalPages).toBe(1)
  expect(result.current.visibleItems).toEqual(itemsOfLength(8))
  expect(result.current.canGoNext).toBe(false)
  expect(result.current.canGoPrevious).toBe(false)
})

test("paginates nine participants across two pages", async () => {
  const { result } = await renderHook(() =>
    useParticipantGrid(itemsOfLength(9)),
  )

  expect(result.current.totalPages).toBe(2)
  expect(result.current.visibleItems).toEqual(itemsOfLength(8))
  expect(result.current.canGoNext).toBe(true)

  await act(async () => {
    result.current.goToNextPage()
  })

  expect(result.current.currentPage).toBe(1)
  expect(result.current.visibleItems).toEqual([8])
  expect(result.current.canGoNext).toBe(false)
  expect(result.current.canGoPrevious).toBe(true)

  await act(async () => {
    result.current.goToPreviousPage()
  })

  expect(result.current.currentPage).toBe(0)
})

test("does not go before the first page or past the last page", async () => {
  const { result } = await renderHook(() =>
    useParticipantGrid(itemsOfLength(9)),
  )

  await act(async () => {
    result.current.goToPreviousPage()
  })
  expect(result.current.currentPage).toBe(0)

  await act(async () => {
    result.current.goToNextPage()
    result.current.goToNextPage()
  })
  expect(result.current.currentPage).toBe(1)
})

test("clamps the current page back when the participant count shrinks", async () => {
  const { result, rerender } = await renderHook(
    ({ items }: { items: number[] }) => useParticipantGrid(items),
    { initialProps: { items: itemsOfLength(9) } },
  )

  await act(async () => {
    result.current.goToNextPage()
  })
  expect(result.current.currentPage).toBe(1)

  await rerender({ items: itemsOfLength(3) })

  expect(result.current.totalPages).toBe(1)
  expect(result.current.currentPage).toBe(0)
  expect(result.current.visibleItems).toEqual(itemsOfLength(3))
})

describe("pagination bar visibility", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test("shows the pagination bar as soon as a room needs more than one page", async () => {
    const { result } = await renderHook(() =>
      useParticipantGrid(itemsOfLength(9)),
    )

    expect(result.current.isPaginationVisible).toBe(true)
  })

  test("never starts an auto-hide timer when everyone fits on one page", async () => {
    const { result } = await renderHook(() =>
      useParticipantGrid(itemsOfLength(8)),
    )

    expect(result.current.totalPages).toBe(1)

    await act(async () => {
      jest.advanceTimersByTime(AUTO_HIDE_DELAY_MS)
    })

    expect(result.current.isPaginationVisible).toBe(true)
  })

  test("hides the pagination bar automatically after the timeout", async () => {
    const { result } = await renderHook(() =>
      useParticipantGrid(itemsOfLength(9)),
    )

    await act(async () => {
      jest.advanceTimersByTime(AUTO_HIDE_DELAY_MS)
    })

    expect(result.current.isPaginationVisible).toBe(false)
  })

  test("keeps the pagination bar visible before the timeout elapses", async () => {
    const { result } = await renderHook(() =>
      useParticipantGrid(itemsOfLength(9)),
    )

    await act(async () => {
      jest.advanceTimersByTime(AUTO_HIDE_DELAY_MS - 500)
    })

    expect(result.current.isPaginationVisible).toBe(true)
  })

  test("re-shows and resets the timer when navigating to another page", async () => {
    const { result } = await renderHook(() =>
      useParticipantGrid(itemsOfLength(9)),
    )

    await act(async () => {
      jest.advanceTimersByTime(AUTO_HIDE_DELAY_MS - 500)
    })
    expect(result.current.isPaginationVisible).toBe(true)

    await act(async () => {
      result.current.goToNextPage()
    })

    await act(async () => {
      jest.advanceTimersByTime(AUTO_HIDE_DELAY_MS - 500)
    })
    expect(result.current.isPaginationVisible).toBe(true)

    await act(async () => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current.isPaginationVisible).toBe(false)
  })

  test("shows the pagination bar even when the navigation attempt is a no-op at a boundary page", async () => {
    const { result } = await renderHook(() =>
      useParticipantGrid(itemsOfLength(9)),
    )

    await act(async () => {
      jest.advanceTimersByTime(AUTO_HIDE_DELAY_MS)
    })
    expect(result.current.isPaginationVisible).toBe(false)
    expect(result.current.currentPage).toBe(0)

    await act(async () => {
      result.current.goToPreviousPage()
    })

    expect(result.current.currentPage).toBe(0)
    expect(result.current.isPaginationVisible).toBe(true)
  })
})
